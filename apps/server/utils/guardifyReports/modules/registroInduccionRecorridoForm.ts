import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Registro de inducción y recorrido como formulario (un solo formato: «Registro de inducción y recorrido al misceláneo»). Los temas y los
 * aspectos específicos se guardan como listas de { tema | aspecto, respuesta (SI / NO / NA), comentarios }; cada registro puede traer
 * temas distintos a los predefinidos, por eso el formulario toma los que traiga el registro. Los participantes salen de su tabla.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;
const parseArr = (raw: unknown): any[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};

/** Una firma de imagen (data URL o base64 de PNG/JPG) se entrega con `firmas=1`; la firma digital de la app (sesión + empleado + GPS en base64) no es una imagen. */
export function clasificarFirma(v: unknown): { imagen: string | null } | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (/^data:image\//i.test(s)) return { imagen: s };
    if (/^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR)/.test(s)) return { imagen: `data:image/${s.startsWith("/9j/") ? "jpeg" : "png"};base64,${s.replace(/\s+/g, "")}` };
    return { imagen: null };
}

/** SI / NO / NA como las marca el papel; el generador compara en mayúsculas y la pantalla solo guarda esas tres. */
export function respuestaLegible(v: unknown): string | null {
    const s = String(v ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!s) return null;
    if (s === "SI" || s === "YES") return "SI";
    if (s === "NO") return "NO";
    if (s === "NA" || s === "N/A") return "NA";
    return txt(v);
}

/** `raw` = fila de `c_registro_induccion_recorrido` con `participantes` (lista de { nombre_completo, cedula, firma }) ya cargada de su tabla. */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const fila = (clave: "tema" | "aspecto") => (e: any) => ({ clave: null, item: txt(e?.[clave]), valor: respuestaLegible(e?.respuesta), observacion: txt(e?.comentarios) });
    const sup = clasificarFirma(raw.firma_supervisor);
    const resp = clasificarFirma(raw.firma_responsable);
    const firmasFila: [string, { imagen: string | null } | null][] = [["firma_supervisor", sup], ["firma_responsable", resp]];
    const presentes = firmasFila.filter(([, f]) => f);
    return {
        id: Number(raw.id), variante: null, creado: fmtDt(raw.created_at), estructura: ubic,
        valores: { fecha: dia(raw.fecha), renglon_edificio: txt(raw.renglon_edificio), supervisor_cliente: txt(raw.supervisor_cliente), supervisor_corporacion: txt(raw.supervisor_corporacion) },
        listas: {
            temas: parseArr(raw.temas_desarrollados).filter((t) => t && typeof t === "object").map(fila("tema")),
            aspectos: parseArr(raw.aspectos_especificos).filter((a) => a && typeof a === "object").map(fila("aspecto")),
            // La imagen de la firma de cada participante no cabe en una celda de tabla: se indica si firmó.
            participantes: parseArr(raw.participantes).filter((p) => p && typeof p === "object").map((p) => ({ nombre_completo: txt(p.nombre_completo), firma: clasificarFirma(p.firma) ? "Firmada" : null, cedula: txt(p.cedula) })),
        },
        firmas: Object.fromEntries(presentes.map(([k, f]) => [k, firmas ? f!.imagen : null])),
        firmasPresentes: presentes.map(([k]) => k),
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const registroInduccionRecorridoForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Mismo `select` explícito que la consulta del reporte: `participantes`, `empleado_id` y `firma_empleado` ya no son columnas de esta tabla.
        const rows: any[] = await (db as any).c_registro_induccion_recorrido.findMany({
            where: { id: { in: ids }, isActive: true },
            select: {
                id: true, empresa_id: true, cliente_id: true, contrato_id: true, corpo_id: true, puesto_id: true, plaza_id: true, fecha: true, renglon_edificio: true,
                supervisor_cliente: true, supervisor_corporacion: true, temas_desarrollados: true, aspectos_especificos: true, firma_supervisor: true,
                created_at: true, created_by: true, division: true, firma_responsable: true, isActive: true, division_id: true,
            },
        });
        if (!rows.length) return [];
        const [partes, ubic] = await Promise.all([
            (db as any).c_participantes_induccion_recorrido.findMany({ where: { registro_id: { in: rows.map((r) => Number(r.id)) } } }) as Promise<any[]>,
            ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }))),
        ]);
        const porRegistro = new Map<number, any[]>();
        for (const p of [...partes].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))) {
            const k = Number(p.registro_id);
            if (!porRegistro.has(k)) porRegistro.set(k, []);
            porRegistro.get(k)!.push(p);
        }
        const porId = new Map(rows.map((r) => [Number(r.id), r]));
        return ids.filter((id) => porId.has(id)).map((id) => {
            const r = porId.get(id)!;
            return armarRegistro({ ...r, participantes: porRegistro.get(id) ?? [] }, ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }), firmas);
        });
    },
};
