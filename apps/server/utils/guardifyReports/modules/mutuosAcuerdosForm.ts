import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { parseMarcaIdsArray, ymdFromFecha } from "../../mutuosAcuerdosMarcas";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { buildNombre } from "../names";

/**
 * Mutuo acuerdo (`e_mutuos_acuerdos`) como formulario «Boleta para mutuos acuerdos»: el oficial interesado (el ausente), el oficial que
 * colabora (el que lo reemplaza) y la autorización del ejecutivo de cuenta. Es el formulario de papel más fiel del sistema; el generador
 * individual ya imprime una hoja por registro con estas mismas etiquetas.
 *
 * Los roles se cruzan como en el generador: al oficial interesado le toca «normal» el rol que perdía (sus marcas) y «cambio» el del
 * colaborador, y al colaborador al revés. Las firmas son imágenes dibujadas (ausente, reemplaza y ejecutivo); la firma digital del ejecutivo
 * y la del responsable (QR/sesión) llevan sesión y ubicación: no se entregan, solo se informa que el ejecutivo firmó digitalmente.
 * No se entrega `file_name` (adjunto). Aceptaciones, estado y cambio de guardia no están en el papel y tampoco se entregan.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const esImagen = (s: string) => s.startsWith("data:image/") || /^(iVBORw0KGgo|\/9j\/)/.test(s) || /^[A-Za-z0-9+/=\s]{400,}$/.test(s);
const imagenFirma = (v: unknown): string | null => {
    const s = txt(v);
    if (!s || !esImagen(s)) return null;
    return s.startsWith("data:image/") ? s : `data:image/png;base64,${s.replace(/\s+/g, "")}`;
};

/** Pie fijo del papel. */
export const NOTA = "El permiso no se puede ejecutar si no está en Corpo 0 firmado por el Delta.";

type Empleado = { codigo?: string | null; nombre?: string | null; primer_apellido?: string | null; segundo_apellido?: string | null };
/** «código — nombre», como lo arma el generador. */
const nombreEmpleado = (e: Empleado | undefined): string | null => {
    if (!e) return null;
    const nombre = buildNombre(e), c = txt(e.codigo);
    return c ? `${c} — ${nombre}`.trim() : txt(nombre);
};
type Marca = { fecha?: unknown; tipo_turno?: unknown };
/** «2026-04-20 / D» (día, tarde o noche); si el registro no tiene marcas se usa la fecha suelta. */
const rolMarcas = (marcas: Marca[], fallback: string | null): string | null => {
    if (!marcas.length) return fallback;
    return marcas.map((m) => {
        const f = ymdFromFecha(m.fecha as any);
        if (!f) return fallback ?? "";
        const t = txt(m.tipo_turno)?.toUpperCase();
        return t ? `${f} / ${t}` : f;
    }).filter(Boolean).join("; ") || fallback;
};

export type MutuoFormExtra = { empleados?: Map<number, Empleado>; ejecutivo?: string | null; marcas?: Map<number, Marca> };

export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, x: MutuoFormExtra = {}): FormRecord {
    const creado = fmtDt(raw.created_at);
    const idsAusente = parseMarcaIdsArray(raw.marcas_ausente ?? raw.marcaDiaAusente_id), idsReemplaza = parseMarcaIdsArray(raw.marcas_reemplaza ?? raw.marcaDiaReemplaza_id);
    const marcasDe = (ids: number[]) => ids.map((id) => x.marcas?.get(id)).filter((m): m is Marca => !!m);
    const mAusente = marcasDe(idsAusente), mReemplaza = marcasDe(idsReemplaza);
    // Cuando no hay marcas, el generador cae a la fecha propia de cada lado (`fecha_ausente`/`fecha_reemplaza`) o a la de la primera marca.
    const rolAusente = rolMarcas(mAusente, ymdFromFecha(raw.fecha_ausente)), rolReemplaza = rolMarcas(mReemplaza, ymdFromFecha(raw.fecha_reemplaza));
    const ausente = x.empleados?.get(Number(raw.empleadoAusente_id)), reemplaza = x.empleados?.get(Number(raw.empleadoReemplaza_id));
    const valores: FormRecord["valores"] = {
        ejecutivo_cuenta: txt(x.ejecutivo),
        fecha: creado ? creado.slice(0, 10) : null,
        motivo: txt(raw.motivo),
        interesado_codigo: txt(ausente?.codigo) ?? txt(raw.empleadoAusente_id),
        interesado_nombre: nombreEmpleado(ausente),
        interesado_rol_normal: rolAusente,
        interesado_rol_cambio: rolReemplaza,
        colabora_codigo: txt(reemplaza?.codigo) ?? txt(raw.empleadoReemplaza_id),
        colabora_nombre: nombreEmpleado(reemplaza),
        colabora_rol_normal: rolReemplaza,
        colabora_rol_cambio: rolAusente,
        nota: NOTA,
    };
    const imagenes: Record<string, string> = {};
    for (const k of ["firma_ausente_manual", "firma_reemplaza_manual", "firma_ejecutivo_cuenta_manual"] as const) { const img = imagenFirma(raw[k]); if (img) imagenes[k] = img; }
    const firmasMap: Record<string, string | null> = Object.fromEntries(Object.entries(imagenes).map(([k, v]) => [k, firmas ? v : null]));
    const presentes = Object.keys(imagenes);
    if (txt(raw.firma_ejecutivo_cuenta_digital)) { firmasMap.firma_ejecutivo_cuenta_digital = null; presentes.push("firma_ejecutivo_cuenta_digital"); }
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic, valores, listas: {},
        firmas: firmasMap, firmasPresentes: presentes,
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const mutuosAcuerdosForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).e_mutuos_acuerdos.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const ub = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        const ubic = await ubicacionTextos(db as any, rows.map(ub));
        const empleados = await findByIds<Empleado>(db as any, "c_empleado", rows.flatMap((r) => [r.empleadoAusente_id, r.empleadoReemplaza_id]), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true });
        const ejecutivos = await findByIds<{ nombre?: string | null }>(db as any, "n_ejecutivo_cuenta", rows.map((r) => r.ejecutivo_cuenta), { nombre: true });
        const marcas = await findByIds<Marca>(db as any, "c_marca_dia", rows.flatMap((r) => [...parseMarcaIdsArray(r.marcas_ausente ?? r.marcaDiaAusente_id), ...parseMarcaIdsArray(r.marcas_reemplaza ?? r.marcaDiaReemplaza_id)]), { fecha: true, tipo_turno: true });
        return rows.map((r) => armarRegistro(r, ubic(ub(r)), firmas, { empleados, marcas, ejecutivo: txt(ejecutivos.get(Number(r.ejecutivo_cuenta))?.nombre) }));
    },
};
