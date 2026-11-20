import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { nombresEmpleado, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Producto no conforme (`c_producto_no_conforme`) como formulario «Registro de producto no conforme». Las mismas etiquetas del generador
 * individual (tabla de 12 columnas), repartidas en secciones.
 *
 * Firmas: la de quien identificó el PNC y la de quien lo originó son dibujadas (imagen, opcionales). La del responsable NO es una imagen:
 * es la firma digital de la app (base64 de `sesión:empleado:latitud:longitud:ms`); ese texto nunca se entrega (lleva sesión y ubicación),
 * solo se dice que existe y quién firmó y cuándo (`firma_responsable_digital`). Los adjuntos no se entregan.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;
const esImagen = (s: string) => s.startsWith("data:image/") || /^(iVBORw0KGgo|\/9j\/)/.test(s) || /^[A-Za-z0-9+/=\s]{400,}$/.test(s);
/** Texto libre: lo que parezca una imagen incrustada no se entrega nunca. */
const texto = (v: unknown): string | null => { const s = txt(v); return s && !esImagen(s) ? s : null; };
/** Imagen de firma como data URL; cualquier otra cosa (un nombre de archivo, basura) no cuenta como firma. */
const imagenFirma = (v: unknown): string | null => {
    const s = txt(v);
    if (!s || !esImagen(s)) return null;
    return s.startsWith("data:image/") ? s : `data:image/png;base64,${s.replace(/\s+/g, "")}`;
};

/** Firma digital de la app: solo el empleado y la hora (hora de Costa Rica, UTC-6 sin cambio de horario). */
export function firmaDigital(raw: unknown): { empleadoId: number; cuando: string | null } | null {
    const s = String(raw ?? "").trim();
    if (!s || esImagen(s)) return null;
    let partes: string[];
    try { partes = Buffer.from(s, "base64").toString("utf8").split(":"); } catch { return null; }
    if (partes.length !== 5) return null;
    const empleadoId = Number(partes[1]);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) return null;
    const ms = Number(partes[4]);
    return { empleadoId, cuando: Number.isFinite(ms) && ms > 0 ? new Date(ms - 6 * 3600_000).toISOString().slice(0, 16).replace("T", " ") : null };
}

export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, empleados: Map<number, string> = new Map()): FormRecord {
    const creado = fmtDt(raw.created_at);
    const digital = firmaDigital(raw.firma_responsable);
    const quien = digital ? empleados.get(digital.empleadoId) ?? null : null;
    const valores: FormRecord["valores"] = {
        responsable_cuenta: texto(raw.responsable_cuenta),
        fecha_identificacion: dia(raw.fecha_identificacion),
        tipo_servicio: texto(raw.tipo_servicio_no_conforme),
        persona_identifico: texto(raw.persona_identifico_pnc),
        descripcion: texto(raw.descripcion),
        persona_origino: texto(raw.persona_origino_pnc),
        accion_implementada: texto(raw.accion_implementada),
        fecha_solucion: dia(raw.fecha_solucion),
        responsable_aprobar: texto(raw.responsable_aprobar),
        firma_responsable_digital: digital ? `Firmada digitalmente${quien ? ` por ${quien}` : ""}${digital.cuando ? ` el ${digital.cuando}` : ""}` : null,
    };
    const imagenes: Record<string, string> = {};
    const identifico = imagenFirma(raw.firma_persona_identifico_pnc), origino = imagenFirma(raw.firma_persona_origino_pnc);
    if (identifico) imagenes.firma_persona_identifico_pnc = identifico;
    if (origino) imagenes.firma_persona_origino_pnc = origino;
    const firmasMap: Record<string, string | null> = Object.fromEntries(Object.keys(imagenes).map((k) => [k, firmas ? imagenes[k]! : null]));
    const presentes = Object.keys(imagenes);
    if (digital) { firmasMap.firma_responsable = null; presentes.push("firma_responsable"); } // digital: no hay imagen que dibujar
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic, valores, listas: {},
        firmas: firmasMap, firmasPresentes: presentes,
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const productoNoConformeForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_producto_no_conforme.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const ub = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        const ubic = await ubicacionTextos(db as any, rows.map(ub));
        const empleados = await nombresEmpleado(db as any, rows.map((r) => firmaDigital(r.firma_responsable)?.empleadoId));
        return rows.map((r) => armarRegistro(r, ubic(ub(r)), firmas, empleados));
    },
};
