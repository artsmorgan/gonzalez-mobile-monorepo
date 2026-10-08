import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { flattenTemasForDocx, getCheckedTemaIds, getTemaNodesForDivision, TEMAS_DIV_SEG } from "../../reports-functions/registroInduccionGeneralTemas";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Registro de inducción general como formulario. Hay dos formatos según la división (el mismo criterio que el .docx de la app):
 * «Aseo y limpieza» y «Seguridad», cada uno con su catálogo de temas. Los temas se entregan TODOS (marcados o no) con el texto del
 * catálogo; la lista de colaboradores y la de capacitadores salen de sus tablas. Nunca se entregan las fotos del registro.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const dia = (v: unknown): string | null => fmtDt(v as any)?.slice(0, 10) ?? null;

/** El papel marca el tema con «√» en una sola columna; aquí un tema marcado sale como «Sí» y uno sin marcar como «No». */
export const MARCA = "Sí";

/** Una firma de imagen (data URL o base64 de PNG/JPG) se entrega con `firmas=1`; la firma digital de la app (sesión + empleado + GPS en base64) no es una imagen. */
export function clasificarFirma(v: unknown): { imagen: string | null } | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (/^data:image\//i.test(s)) return { imagen: s };
    if (/^(iVBORw0KGgo|\/9j\/)/.test(s)) return { imagen: `data:image/${s.startsWith("/9j/") ? "jpeg" : "png"};base64,${s.replace(/\s+/g, "")}` };
    return { imagen: null };
}

/** Celda de firma de un renglón de tabla: la imagen (data URL) solo con `firmas=1`; «Firmada» si existe sin pedir la imagen o si no es una imagen (firma digital); null si no hay. */
export function celdaFirma(v: unknown, firmas: boolean): string | null {
    const f = clasificarFirma(v);
    if (!f) return null;
    return firmas && f.imagen ? f.imagen : "Firmada";
}

/** Mismo criterio que el .docx: división 4 = Seguridad, 5 = Aseo; si no, el texto de la división. */
export function varianteDe(divisionId: unknown, division: unknown): "Aseo y limpieza" | "Seguridad" {
    return getTemaNodesForDivision(Number(divisionId ?? 0), txt(division) ?? undefined) === TEMAS_DIV_SEG ? "Seguridad" : "Aseo y limpieza";
}

/** El texto de cada tema tal como lo imprime el papel: «número texto» (la definición del formulario usa los mismos). */
export const etiquetaTema = (id: string, text: string) => `${id} ${text}`;

/**
 * `raw` = fila de `c_registro_induccion_general` con `colaboradores` y `capacitadores` (listas de { nombre, cedula, puesto_text, firma }) ya cargadas
 * de sus tablas, como las deja `queryRegistroInduccionGeneralRows`.
 */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const variante = varianteDe(raw.division_id, raw.division);
    const marcados = getCheckedTemaIds(typeof raw.temas_a_tratar === "string" ? raw.temas_a_tratar : raw.temas_a_tratar == null ? null : JSON.stringify(raw.temas_a_tratar));
    const temas = flattenTemasForDocx(getTemaNodesForDivision(Number(raw.division_id ?? 0), txt(raw.division) ?? undefined))
        .filter((t) => t.kind === "leaf")
        .map((t) => ({ clave: `tema_${t.id}`, item: etiquetaTema(t.id, t.text), valor: marcados.has(t.id) ? MARCA : "No", observacion: null }));
    const lista = (v: unknown): any[] => (Array.isArray(v) ? v : []);
    const colaboradores = lista(raw.colaboradores);
    const puestos = [...new Set(colaboradores.map((c) => txt(c?.puesto_text)).filter((x): x is string => !!x))];
    const firma = clasificarFirma(raw.firma_responsable);
    return {
        id: Number(raw.id), variante, creado: fmtDt(raw.created_at), estructura: ubic,
        valores: { fecha: dia(raw.fecha), puesto_colaboradores: txt(puestos.join(", ")) },
        listas: {
            temas,
            // Firma de cada persona: la imagen dentro de la celda (solo con firmas=1) o «Firmada».
            capacitadores: lista(raw.capacitadores).map((p) => ({ nombre: txt(p?.nombre), cedula: txt(p?.cedula), firma: celdaFirma(p?.firma, firmas) })),
            colaboradores: colaboradores.map((p) => ({ nombre: txt(p?.nombre), firma: celdaFirma(p?.firma, firmas), cedula: txt(p?.cedula) })),
        },
        firmas: firma ? { firma_responsable: firmas ? firma.imagen : null } : {},
        firmasPresentes: firma ? ["firma_responsable"] : [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

const porRegistro = (rows: any[]): Map<number, any[]> => {
    const m = new Map<number, any[]>();
    for (const r of [...rows].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))) {
        const k = Number(r.registro_id);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(r);
    }
    return m;
};

export const registroInduccionGeneralForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Mismo `select` explícito que la consulta del reporte: `colaboradores` y `capacitadores` ya no son columnas de esta tabla.
        const rows: any[] = await (db as any).c_registro_induccion_general.findMany({
            where: { id: { in: ids }, isActive: true },
            select: {
                id: true, empresa_id: true, cliente_id: true, corpo_id: true, division: true, fecha: true, temas_a_tratar: true, firma_responsable: true,
                created_at: true, created_by: true, division_id: true, contrato_id: true, puesto_id: true, isActive: true,
            },
        });
        if (!rows.length) return [];
        const found = rows.map((r) => Number(r.id));
        const [colabs, caps, ubic] = await Promise.all([
            (db as any).c_colaboradores_induccion_general.findMany({ where: { registro_id: { in: found } } }),
            (db as any).c_capacitadores_induccion_general.findMany({ where: { registro_id: { in: found } } }),
            ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }))),
        ]);
        const colabPor = porRegistro(colabs), capPor = porRegistro(caps);
        const porId = new Map(rows.map((r) => [Number(r.id), r]));
        return ids.filter((id) => porId.has(id)).map((id) => {
            const r = porId.get(id)!;
            return armarRegistro(
                { ...r, colaboradores: colabPor.get(id) ?? [], capacitadores: capPor.get(id) ?? [] },
                ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }),
                firmas,
            );
        });
    },
};
