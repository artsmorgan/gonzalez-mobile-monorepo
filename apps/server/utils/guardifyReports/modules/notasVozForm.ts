import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Nota de voz como formulario. El contenido real es un audio con su transcripción; el papel lleva el título, la descripción, la
 * transcripción y solo un indicador de si hay audio. NUNCA se entrega la ruta ni el nombre del archivo de audio.
 */
const MAX_TEXTO = 20000;

/** ¿Parece una imagen incrustada (data URI o base64 largo)? Un texto así no es una nota: se descarta. */
function esImagen(s: string): boolean {
    if (/^data:[a-z]+\/[^;,]+[;,]/i.test(s) || /^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR|PHN2Zy)/.test(s)) return true;
    const head = s.slice(0, 200);
    return s.length > 1000 && /^[A-Za-z0-9+/=_-]+$/.test(head) && /[A-Z]/.test(head) && /[a-z]/.test(head) && /\d/.test(head);
}
const texto = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    if (!s || esImagen(s)) return null;
    return s.length > MAX_TEXTO ? `${s.slice(0, MAX_TEXTO - 1)}…` : s;
};

/** Una firma de imagen (data URL o base64 de PNG/JPG) se entrega con `firmas=1`; la firma digital de la app (sesión + empleado + GPS en base64) no es una imagen. */
export function clasificarFirma(v: unknown): { imagen: string | null } | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (/^data:image\//i.test(s)) return { imagen: s };
    if (/^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR)/.test(s)) return { imagen: `data:image/${s.startsWith("/9j/") ? "jpeg" : "png"};base64,${s.replace(/\s+/g, "")}` };
    return { imagen: null };
}

/** «código nombre apellidos», como lo imprime el consolidado en «Creado por». */
const empleadoLabel = (e: any): string | null => {
    if (!e) return null;
    return [e.codigo, e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ").trim() || null;
};

/** `raw` = fila de `c_notas_voz` con `creador_label` (el empleado que la grabó, ya resuelto). */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const firma = clasificarFirma(raw.firma_responsable);
    return {
        id: Number(raw.id), variante: null, creado: fmtDt(raw.created_at), estructura: ubic,
        valores: {
            titulo: texto(raw.titulo), descripcion: texto(raw.descripcion), transcripcion: texto(raw.transcripcion),
            con_audio: String(raw.path ?? "").trim() ? "Sí" : "No", creado_por: texto(raw.creador_label),
        },
        listas: {},
        firmas: firma ? { firma_responsable: firmas ? firma.imagen : null } : {},
        firmasPresentes: firma ? ["firma_responsable"] : [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const notasVozForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_notas_voz.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const [ubic, empleados] = await Promise.all([
            ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }))),
            findByIds<any>(db as any, "c_empleado", rows.map((r) => r.created_by), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true }),
        ]);
        const porId = new Map(rows.map((r) => [Number(r.id), r]));
        return ids.filter((id) => porId.has(id)).map((id) => {
            const r = porId.get(id)!;
            return armarRegistro({ ...r, creador_label: empleadoLabel(empleados.get(Number(r.created_by))) }, ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }), firmas);
        });
    },
};
