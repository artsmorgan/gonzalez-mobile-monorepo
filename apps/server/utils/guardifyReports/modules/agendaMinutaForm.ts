import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Agenda / minuta electrónica como formulario (`c_agenda_minuta`): el mismo contenido que el .docx de `buildAgendaMinutaDocxBuffer` (fecha y horas,
 * elaborada por, número de minuta, participantes con su firma, temas numerados y acuerdos numerados con responsable y fecha límite).
 * Las firmas de los participantes están dentro de la tabla del papel (columna de firma de la definición): la celda trae la imagen (data URL) solo con
 * `firmas=true`; sin ella, o si lo guardado no es una imagen, dice «Firmada»; sin firma, null. `firma_responsable` (firma digital con ubicación del QR) no es una imagen y el docx no la imprime: no se entrega.
 * Las imágenes opcionales de la minuta (`c_imagenes_agenda_minuta`) nunca salen.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

function firmaImagen(raw: unknown): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(s)) return s;
    if (s.startsWith("iVBOR")) return `data:image/png;base64,${s}`;
    if (s.startsWith("/9j/")) return `data:image/jpeg;base64,${s}`;
    return null;
}

/** Celda de firma de una tabla (contrato de Guardify): imagen solo si se pidió y es imagen de verdad; «Firmada» si existe; null si no hay. */
export function celdaFirma(raw: unknown, firmas: boolean): string | null {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    const img = firmaImagen(s);
    return img && firmas ? img : "Firmada";
}

function parseJson(raw: unknown): any {
    if (raw == null || String(raw).trim() === "") return null;
    if (typeof raw === "object") return raw;
    try { return JSON.parse(String(raw)); } catch { return null; }
}
/** Los acuerdos se guardan como `{ items: [...] }` (o una lista suelta, en registros viejos). */
const asArray = (v: any): any[] => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : []);

/** Hora de una columna `Time`: `HH:mm` en UTC, como `timeToHHmm` del generador (la base no guarda zona). */
export function horaHHmm(val: unknown): string | null {
    if (val == null || val === "") return null;
    const d = val instanceof Date ? val : new Date(String(val));
    if (Number.isNaN(d.getTime())) return null;
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Ubicación de una fila: sus ids propios y, donde vengan en 0 (registros antiguos), los que da su puesto (igual que el módulo de lista). */
export function rowHierarchy(r: any, fromPuesto: Hierarchy | undefined): Hierarchy {
    const pos = (v: unknown) => (Number(v) > 0 ? Number(v) : null);
    return {
        empresa: pos(r.empresa_id) ?? fromPuesto?.empresa ?? null,
        cliente: pos(r.cliente_id) ?? fromPuesto?.cliente ?? null,
        division: pos(r.division_id) ?? fromPuesto?.division ?? null,
        contrato: pos(r.contrato_id) ?? fromPuesto?.contrato ?? null,
        corpo: pos(r.corpo_id) ?? fromPuesto?.corpo ?? null,
        puesto: pos(r.puesto_id),
    };
}

/**
 * `raw` es la fila de `c_agenda_minuta`. `hier` es su ubicación ya completada con la del puesto (`rowHierarchy`); si se omite se usa la de la propia fila.
 * Los temas y acuerdos salen numerados como en el papel («1. tema», «1) acuerdo»).
 */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, hier?: Hierarchy): FormRecord {
    const creado = fmtDt(raw.created_at);
    const temas = asArray(parseJson(raw.temas_a_tratar)).map((t) => String(t ?? "").trim()).filter(Boolean);
    const participantes = asArray(parseJson(raw.participantes)).filter((p) => p && typeof p === "object").map((p) => ({
        nombre: txt(p.nombre), puesto: txt(p.puesto), firma: celdaFirma(p.firma, firmas),
    }));
    const acuerdos = asArray(parseJson(raw.acuerdos)).filter((a) => a && typeof a === "object" && txt(a.texto)).map((a, i) => ({
        acuerdo: `${i + 1}) ${txt(a.texto)}`, responsable: txt(a.responsable), fecha_limite: txt(a.fecha_limite),
    }));
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic,
        valores: {
            titulo: txt(raw.titulo),
            fecha: (fmtDt(raw.fecha) ?? "").slice(0, 10) || null,
            hora_inicio: horaHHmm(raw.hora_inicio),
            hora_fin: horaHHmm(raw.hora_fin),
            autor: txt(raw.autor),
            numero: raw.numero == null || raw.numero === "" ? null : Number(raw.numero),
            temas: temas.length ? temas.map((t, i) => `${i + 1}. ${t}`).join("\n") : null,
        },
        listas: { participantes, acuerdos },
        // Las firmas de los participantes viven dentro de la tabla (ver arriba); aquí no hay firmas sueltas.
        firmas: {}, firmasPresentes: [],
        hier: hier ?? rowHierarchy(raw, undefined),
    };
}

export const agendaMinutaForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Solo activas, como el módulo de lista.
        const rows: any[] = await (db as any).c_agenda_minuta.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        // Las minutas antiguas traen empresa, división o contrato en 0: se completan con la ubicación de su puesto (en lote).
        const incomplete = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
        const delPuesto = await loadPuestoHierarchy(db as any, incomplete.map((r) => Number(r.puesto_id)));
        const hiers = rows.map((r) => rowHierarchy(r, delPuesto.get(Number(r.puesto_id))));
        const ubic = await ubicacionTextos(db as any, hiers);
        return rows.map((r, i) => armarRegistro(r, ubic(hiers[i]!), firmas, hiers[i]));
    },
};
