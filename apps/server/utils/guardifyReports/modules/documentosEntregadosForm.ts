import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Documentos entregados al cliente como formulario. Un registro es UN documento entregado; el papel es la hoja «Control de documentos
 * entregados al cliente» (una tabla con mínimo 10 renglones), así que el registro sale como el primer renglón de esa tabla y el resto queda
 * en blanco. La firma del representante del cliente es un garabato (imagen); la del oficial que entrega es la firma digital de la app.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;

/** Una firma de imagen (data URL o base64 de PNG/JPG) se entrega con `firmas=1`; la firma digital de la app (sesión + empleado + GPS en base64) no es una imagen. */
export function clasificarFirma(v: unknown): { imagen: string | null } | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (/^data:image\//i.test(s)) return { imagen: s };
    if (/^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR)/.test(s)) return { imagen: `data:image/${s.startsWith("/9j/") ? "jpeg" : "png"};base64,${s.replace(/\s+/g, "")}` };
    return { imagen: null };
}

/** `raw` = fila de `e_control_documento_entregado_cliente`. */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const fecha = dia(raw.fecha);
    const firmasFila: [string, { imagen: string | null } | null][] = [["firma_representante_cliente", clasificarFirma(raw.firma_representante_cliente)], ["firma_responsable", clasificarFirma(raw.firma_responsable)]];
    const presentes = firmasFila.filter(([, f]) => f);
    const doc = { fecha, tipo_documento: txt(raw.tipo_documento), descripcion: txt(raw.descripcion), oficial_entrega: txt(raw.nombre_oficial_entrega), oficial_recibe: txt(raw.nombre_oficial_recibe) };
    return {
        id: Number(raw.id), variante: null,
        // La tabla solo guarda la fecha (sin hora): igual que la lista, a medianoche.
        creado: fecha ? `${fecha}T00:00:00` : null,
        estructura: ubic,
        valores: { ...doc },
        listas: { documentos: [{ numero: "1", ...doc }] },
        firmas: Object.fromEntries(presentes.map(([k, f]) => [k, firmas ? f!.imagen : null])),
        firmasPresentes: presentes.map(([k]) => k),
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const documentosEntregadosForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).e_control_documento_entregado_cliente.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const ubic = await ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id })));
        const porId = new Map(rows.map((r) => [Number(r.id), r]));
        return ids.filter((id) => porId.has(id)).map((id) => {
            const r = porId.get(id)!;
            return armarRegistro(r, ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }), firmas);
        });
    },
};
