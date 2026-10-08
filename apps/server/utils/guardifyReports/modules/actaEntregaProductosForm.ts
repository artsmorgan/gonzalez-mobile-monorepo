import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Acta de entrega de producto como formulario (`c_acta_entre_producto`). El papel del generador individual: fecha y tipo de entrega, cliente y
 * «mensual» arriba, la tabla de productos de limpieza (descripción, unidad de medida, cantidad, devolución, faltantes), observaciones y las
 * firmas de quien ENTREGA y de quien RECIBE (nombre, cédula, fecha y firma).
 *
 * Nunca salen las imágenes adjuntas del acta (`c_imagenes_acta_entrega_producto`) ni `firma_responsable` (código de sesión QR/GPS).
 * Las firmas de entrega y recibo son imágenes reales y solo viajan con `firmas`.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

/** `detalle` es un JSON `[{ descripcion, unidad_medida, cantidad, devolucion, faltantes }]` (todo texto). */
export function parseDetalle(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** Las firmas del acta se guardan como data URL o como base64 suelto; cualquier otro texto no es una imagen. */
export function imagenDeFirma(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    if (/^[A-Za-z0-9+/=\s]{200,}$/.test(s)) return `data:image/${s.startsWith("/9j/") ? "jpeg" : "png"};base64,${s.replace(/\s+/g, "")}`;
    return null;
}

export function armarRegistro(raw: Record<string, any>, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    // El generador pone la fecha del acta en la cabecera y también en la fecha de quien entrega y de quien recibe.
    const fecha = fmtDt(raw.fecha)?.slice(0, 10) ?? null;
    const productos = parseDetalle(raw.detalle).filter((p) => p && typeof p === "object").map((p) => ({
        descripcion: txt(p.descripcion), unidad_medida: txt(p.unidad_medida), cantidad: txt(p.cantidad), devolucion: txt(p.devolucion), faltantes: txt(p.faltantes),
    }));
    const sign: Record<string, string> = {};
    const entrega = imagenDeFirma(raw.firma_entrega), recibe = imagenDeFirma(raw.firma_recibe);
    if (entrega) sign.firma_entrega = entrega;
    if (recibe) sign.firma_recibe = recibe;
    return {
        id: Number(raw.id), variante: null, creado: fmtDt(raw.fecha), estructura: ubic,
        valores: {
            fecha, tipo_entrega: txt(raw.tipo_entrega), mensual: txt(raw.mensual), observaciones: txt(raw.observaciones),
            nombre_entrega: txt(raw.nombre_entrega), cedula_entrega: txt(raw.cedula_entrega), nombre_recibe: txt(raw.nombre_recibe), cedula_recibe: txt(raw.cedula_recibe),
        },
        listas: { productos },
        firmas: Object.fromEntries(Object.keys(sign).map((k) => [k, firmas ? sign[k]! : null])),
        firmasPresentes: Object.keys(sign),
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const actaEntregaProductosForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Igual que la lista: solo actas activas. Sin `firma_responsable`.
        const rows: any[] = await (db as any).c_acta_entre_producto.findMany({
            where: { id: { in: ids }, isActive: true },
            select: {
                id: true, empresa_id: true, cliente_id: true, division_id: true, contrato_id: true, corpo_id: true, puesto_id: true,
                fecha: true, tipo_entrega: true, mensual: true, detalle: true, observaciones: true,
                nombre_entrega: true, cedula_entrega: true, firma_entrega: true, nombre_recibe: true, cedula_recibe: true, firma_recibe: true,
            },
        });
        if (!rows.length) return [];
        const ubic = await ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id })));
        return rows.map((r) => armarRegistro(r, ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }), firmas));
    },
};
