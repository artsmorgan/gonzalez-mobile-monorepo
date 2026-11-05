import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { divisionPorContrato, findByIds, nombresEmpleado, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Maestro de quejas y reclamos (`c_maestro_quejas`) como formulario. El generador individual lo imprime en una fila (17 columnas); aquí se
 * entrega estructurado con las mismas etiquetas, más el tipo de queja (el generador lo une al motivo), el cliente y el estado de la pantalla.
 *
 * La «firma del responsable» NO es una imagen: la app guarda un texto en base64 con `sesión:empleado:latitud:longitud:marca de tiempo`
 * (firma digital por QR/sesión). Nunca se entrega ese texto (lleva la sesión y la ubicación); solo se dice que existe (`firmasPresentes`)
 * y quién firmó y cuándo (`firma_responsable_digital`). Si un registro antiguo trajera una imagen de verdad, esa sí sale con `firmas=1`.
 * Los anexos (fotos, audio, archivos) no se entregan.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
/** Las fechas de la queja se guardan como texto `YYYY-MM-DD` (a veces con hora): se entrega solo el día cuando es una fecha. */
const dia = (v: unknown): string | null => { const s = txt(v); const m = s ? /^(\d{4}-\d{2}-\d{2})/.exec(s) : null; return m ? m[1]! : s; };
const esImagen = (s: string) => s.startsWith("data:image/") || /^(iVBORw0KGgo|\/9j\/)/.test(s) || /^[A-Za-z0-9+/=\s]{400,}$/.test(s);

/** Firma digital de la app (base64 de `sesión:empleado:lat:lon:ms`): solo el empleado y la hora (hora de Costa Rica, UTC-6 sin cambio de horario). */
export function firmaDigital(raw: unknown): { empleadoId: number; cuando: string | null } | null {
    const s = String(raw ?? "").trim();
    if (!s || esImagen(s)) return null;
    let partes: string[];
    try { partes = Buffer.from(s, "base64").toString("utf8").split(":"); } catch { return null; }
    if (partes.length !== 5) return null;
    const empleadoId = Number(partes[1]);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) return null;
    const ms = Number(partes[4]);
    const cuando = Number.isFinite(ms) && ms > 0 ? new Date(ms - 6 * 3600_000).toISOString().slice(0, 16).replace("T", " ") : null;
    return { empleadoId, cuando };
}

export type QuejaFormExtra = { plaza?: string | null; empleados?: Map<number, string>; division?: string | null };

export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, x: QuejaFormExtra = {}): FormRecord {
    const creado = fmtDt(raw.created_at);
    const firmaRaw = String(raw.firma_responsable ?? "").trim();
    const digital = firmaDigital(firmaRaw);
    const imagen = !digital && firmaRaw && esImagen(firmaRaw) ? (firmaRaw.startsWith("data:image/") ? firmaRaw : `data:image/png;base64,${firmaRaw.replace(/\s+/g, "")}`) : null;
    const quien = digital ? x.empleados?.get(digital.empleadoId) ?? null : null;
    const valores: FormRecord["valores"] = {
        plaza: txt(x.plaza),
        sociedad: txt(raw.sociedad),
        recibida_por: txt(raw.nombre_realiza_queja),
        cliente_formulario: txt(raw.cliente),
        empresa_queja: txt(raw.empresa_presenta_queja),
        persona_queja: txt(raw.persona_presenta_queja),
        medio_recepcion: txt(raw.medio_recepcion_queja),
        tipo_cliente: txt(raw.tipo_cliente),
        tipo_queja: txt(raw.tipo_queja),
        ubicacion: txt(raw.ubicacion),
        nivel_queja: txt(raw.nivel_queja),
        fecha_queja: dia(raw.fecha_queja),
        motivo: txt(raw.motivo_queja),
        descripcion: txt(raw.descripcion_queja),
        estimacion_dannio: txt(raw.estimacion_dannio),
        fecha_atencion: dia(raw.fecha_inicio),
        fecha_realizacion: dia(raw.fecha_revision),
        resolucion: txt(raw.resolucion_queja),
        estado: txt(raw.estado),
        accion_correctiva: txt(raw.accion_correctiva_preventiva),
        firma_responsable_digital: digital ? `Firmada digitalmente${quien ? ` por ${quien}` : ""}${digital.cuando ? ` el ${digital.cuando}` : ""}` : null,
    };
    const presente = !!digital || !!imagen;
    return {
        id: Number(raw.id), variante: null, creado,
        estructura: { ...ubic, division: ubic.division ?? txt(x.division) },
        valores, listas: {},
        firmas: presente ? { firma_responsable: firmas ? imagen : null } : {},
        firmasPresentes: presente ? ["firma_responsable"] : [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

/** Plaza como la arma la consulta de la lista: «nro - código - nombre». */
const plazaTexto = (p: any): string | null => [p?.nro_plaza, p?.codigo_plaza, p?.nombre].map((v) => String(v ?? "").trim()).filter(Boolean).join(" - ") || null;
export const maestroQuejasForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_maestro_quejas.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const ubic = await ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id })));
        const plazas = await findByIds<any>(db as any, "e_estructura_plazas", rows.map((r) => r.plaza_id), { nombre: true, codigo_plaza: true, nro_plaza: true });
        const empleados = await nombresEmpleado(db as any, rows.map((r) => firmaDigital(r.firma_responsable)?.empleadoId));
        const ub = (r: any) => ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id });
        // La división del contrato solo se busca para las quejas que no guardaron la suya.
        const divisiones = await divisionPorContrato(db as any, rows.filter((r) => !ub(r).division).map((r) => r.contrato_id));
        return rows.map((r) => armarRegistro(r, ub(r), firmas, { plaza: plazaTexto(plazas.get(Number(r.plaza_id))), empleados, division: divisiones.get(Number(r.contrato_id)) ?? null }));
    },
};
