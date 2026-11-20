import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Control de entrega de puesto (SEG-F-023) como formulario (`e_registro_entrega_puesto`). Sigue la hoja del generador individual:
 * datos de entrada y salida, tabla de artículos del puesto, oficiales y observaciones. La tabla no tiene `isActive`: se lee igual que el módulo de lista.
 * NO se entregan las fotos (`image_delivery`/`image_receives`), los ids de marca ni la firma del responsable (cadena QR/GPS, no un dibujo).
 * Las firmas de quien entrega y de quien recibe sí existen en el registro y se entregan como firma (solo con `firmas`).
 */
const NA = "N/A"; // el generador imprime «N/A» donde quien entrega no llenó el dato
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const conNA = (v: string | null) => v ?? NA;

/** `YYYY-MM-DD` de una columna de fecha (Date o texto ISO). */
const dayOf = (v: unknown): string | null => { const s = fmtDt(v as any); return s ? s.slice(0, 10) : null; };

/** `HH:mm` de una columna `TIME` (Prisma la entrega como Date 1970-01-01 en UTC; por la API puede llegar como texto). */
export function hmOf(v: unknown): string | null {
    if (v == null || v === "") return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : `${String(v.getUTCHours()).padStart(2, "0")}:${String(v.getUTCMinutes()).padStart(2, "0")}`;
    const m = /(?:^|T)(\d{2}):(\d{2})/.exec(String(v).trim());
    return m ? `${m[1]}:${m[2]}` : null;
}

/** D / M / N → Diurno / Mixto / Nocturno, como el generador. */
export function turnoLegible(v: unknown): string | null {
    const t = txt(v);
    if (!t) return null;
    const u = t.toUpperCase();
    return u === "D" ? "Diurno" : u === "M" ? "Mixto" : u === "N" ? "Nocturno" : t;
}

const parseArticulos = (raw: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(raw)) return raw.filter((x) => x && typeof x === "object");
    try { const a = JSON.parse(String(raw ?? "")); return Array.isArray(a) ? a.filter((x) => x && typeof x === "object") : []; } catch { return []; }
};
/** Cantidad como número (0 es un dato válido); vacío → null. */
const cantidad = (v: unknown): number | string | null => {
    if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : txt(v);
};

/** Firma guardada como data URL o base64 suelto (igual que el generador); lo demás no es una imagen. */
export function firmaImagen(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return /^[A-Za-z0-9+/=\s]{100,}$/.test(s) ? `data:image/png;base64,${s.replace(/\s+/g, "")}` : null;
}

export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, hier: Hierarchy = {}): FormRecord {
    const fechaEntrada = dayOf(raw.fecha_entrada_entrega);
    const valores: FormRecord["valores"] = {
        corpo: ubic.sucursal,
        cliente: ubic.cliente,
        fecha_entrada: conNA(fechaEntrada),
        hora_entrada: conNA(hmOf(raw.hora_entrada_entrega)),
        fecha_salida: conNA(dayOf(raw.fecha_salida_entrega)),
        hora_salida: conNA(hmOf(raw.hora_salida_entrega)),
        turno: conNA(turnoLegible(raw.turno_entrega)),
        dia: conNA(fechaEntrada), // la hoja repite aquí la fecha de entrada
        oficial_entrega: conNA(txt(raw.oficial_entrega)),
        oficial_recibe: txt(raw.oficial_recibe),
        observaciones: txt(raw.observaciones),
    };
    const articulos = parseArticulos(raw.articulos_puesto).map((a) => ({
        nombre: txt(a.nombre), cantidad_requerida: cantidad(a.cantidad_requerida ?? a.cantidad), cantidad_real: cantidad(a.cantidad_real), estado: txt(a.estado), observaciones: txt(a.observaciones),
    }));
    const sign: Record<string, string> = {};
    for (const [clave, col] of [["firma_entrega", raw.firma_entrega], ["firma_recibe", raw.firma_recibe]] as const) {
        const img = firmaImagen(col);
        if (img) sign[clave] = img;
    }
    return {
        id: Number(raw.id), variante: null, creado: fmtDt(raw.created_at), estructura: ubic, valores,
        listas: { articulos },
        firmas: Object.fromEntries(Object.keys(sign).map((k) => [k, firmas ? sign[k]! : null])),
        firmasPresentes: Object.keys(sign),
        hier,
    };
}

export const entregaPuestoForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).e_registro_entrega_puesto.findMany({ where: { id: { in: ids } } });
        if (!rows.length) return [];
        // La fila solo trae cliente, corpo y puesto: contrato, división y empresa salen del puesto (igual que el alcance del módulo de lista).
        const [hiers, clientes] = await Promise.all([
            loadPuestoHierarchy(db as any, rows.map((r) => Number(r.puesto_id))),
            findByIds<{ empresa_id: number | null }>(db as any, "e_estructura_cliente", rows.map((r) => r.cliente_id), { empresa_id: true }),
        ]);
        const ubicIds = rows.map((r) => {
            const h = hiers.get(Number(r.puesto_id));
            return { empresa: clientes.get(Number(r.cliente_id))?.empresa_id ?? h?.empresa, cliente: r.cliente_id, division: h?.division, contrato: h?.contrato, corpo: r.corpo_id, puesto: r.puesto_id };
        });
        const ubic = await ubicacionTextos(db as any, ubicIds);
        return rows.map((r, i) => armarRegistro(r, ubic(ubicIds[i]!), firmas, hiers.get(Number(r.puesto_id)) ?? {}));
    },
};
