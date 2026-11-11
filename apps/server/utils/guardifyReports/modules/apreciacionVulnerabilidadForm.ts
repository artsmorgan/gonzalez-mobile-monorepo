import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Boleta de apreciación de vulnerabilidad como formulario (`c_boleta_apreciacion_vulnerabilidad`). Sigue la hoja del generador individual:
 * datos generales, seis bloques de preguntas SI/NO, nivel de vulnerabilidad, el detalle de métricas y la firma del solicitante.
 * Cada bloque de la boleta (`entorno`, `transito_accesos`, `perimetro`, `seguridad_electronica`, `estructura_instalaciones_1` y `_2`) viaja
 * como una lista con su `key`; los ítems salen tal como los guardó la boleta (la app permite agregar ítems, así que no se fijan en el formato).
 * NO se entregan las fotos de los ítems, la descripción libre de cada ítem ni `firma_responsable` (cadena QR/GPS, no un dibujo).
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const parseArr = (raw: unknown): any[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};

/** Firma guardada como data URL o base64 suelto (igual que el generador); lo demás no es una imagen. */
export function firmaImagen(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return /^[A-Za-z0-9+/=\s]{100,}$/.test(s) ? `data:image/png;base64,${s.replace(/\s+/g, "")}` : null;
}

/** La app guarda `si` / `no`; el papel marca SI o NO. */
export function respuestaLegible(v: unknown): string | null {
    const n = String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return n === "si" ? "SI" : n === "no" ? "NO" : null;
}

/** «baja» / «media» / «alta» → «Baja» / «Media» / «Alta». */
export function nivelLegible(v: unknown): string | null {
    const n = String(v ?? "").trim().toLowerCase();
    return n === "baja" || n === "media" || n === "alta" ? n.charAt(0).toUpperCase() + n.slice(1) : null;
}

/** Ubicación de la fila: sus ids propios y, donde vengan en 0 (registros antiguos), los que da su puesto (como el módulo de lista). */
export function ubicacionDe(r: any, fromPuesto?: Hierarchy) {
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

export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, hier?: Hierarchy): FormRecord {
    const fecha = fmtDt(raw.fecha);
    const secciones = parseArr(raw.boleta).filter((s) => s && typeof s === "object");
    const nivel = secciones.find((s) => s.key === "porcentaje_vulnerabilidad");
    const metricas = parseArr(raw.metricas_vulnerablidad).filter((m) => typeof m === "string" || typeof m === "number").map((m) => String(m).trim()).filter(Boolean);
    const valores: FormRecord["valores"] = {
        enlace: txt(raw.enlace),
        solicitante: txt(raw.nombre_solicitante),
        fecha: fecha ? fecha.slice(0, 10) : null,
        nivel_vulnerabilidad: nivelLegible(nivel?.vulnerabilityLevel),
        // Como la hoja: lista numerada de lo que influye en el nivel.
        metricas: metricas.length ? metricas.map((m, i) => `${i + 1}. ${m}`).join("\n") : null,
        observaciones: txt(raw.observaciones),
    };
    const listas: FormRecord["listas"] = {};
    for (const s of secciones) {
        const key = txt(s.key);
        if (!key || key === "porcentaje_vulnerabilidad") continue;
        let items: any[] = Array.isArray(s.items) ? s.items : parseArr(s.items);
        items = items.filter((it) => it && typeof it === "object");
        listas[key] = items.map((it) => ({ item: txt(it.label), valor: respuestaLegible(it.answer), observacion: null }));
    }
    const img = firmaImagen(raw.firma_solicitante);
    return {
        id: Number(raw.id), variante: null, creado: fecha, estructura: ubic, valores, listas,
        firmas: img ? { firma_solicitante: firmas ? img : null } : {},
        firmasPresentes: img ? ["firma_solicitante"] : [],
        hier: hier ?? { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const apreciacionVulnerabilidadForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_boleta_apreciacion_vulnerabilidad.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const incompletas = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
        const desdePuesto = await loadPuestoHierarchy(db as any, incompletas.map((r) => Number(r.puesto_id)));
        const ubicIds = rows.map((r) => ubicacionDe(r, desdePuesto.get(Number(r.puesto_id))));
        const ubic = await ubicacionTextos(db as any, ubicIds);
        return rows.map((r, i) => armarRegistro(r, ubic(ubicIds[i]!), firmas, ubicIds[i]));
    },
};
