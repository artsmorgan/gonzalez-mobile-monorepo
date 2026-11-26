import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Llaveros como formulario: el «Movimiento de llaveros» (SEG-F-030) del llavero, con los datos del llavero arriba (los del «Registro de llaveros»,
 * SEG-F-021). Tablas: `e_llavero` y `e_movimiento_llavero` (los movimientos salen del más nuevo al más viejo, como en el Excel). Las llaves que el
 * llavero contiene no se imprimen en el papel y no se incluyen.
 *
 * Las firmas de entrega y recibo son por movimiento y salen dentro de la tabla: la imagen con `firmas=1` (y solo si es una imagen de verdad),
 * «Firmada» si existe sin imagen y vacía si no hay. La firma del responsable es un código de sesión (QR/GPS), no una imagen: se informa que existe y nunca se entrega.
 * Las columnas «Entrega» y «Recibo» del papel son casillas que se marcan a mano; la app no guarda ese dato y no se incluyen.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

/** Fecha (`@db.Date`) y hora (`@db.Time`) de un movimiento: `YYYY-MM-DD` y `HH:mm`. */
export function diaMov(m: any): string | null { return fmtDt(m?.fecha)?.slice(0, 10) ?? null; }
export function horaMov(m: any): string | null {
    const h = m?.hora;
    const s = h instanceof Date ? (Number.isNaN(h.getTime()) ? "" : h.toISOString()) : String(h ?? "");
    return /(\d{2}:\d{2}):\d{2}/.exec(s)?.[1] ?? (/^\d{2}:\d{2}$/.test(s.trim()) ? s.trim() : null);
}
/**
 * Imagen de una firma: data URL, o base64 que empieza como PNG (`iVBORw0KGgo`) o JPEG (`/9j/`), que se normaliza a data URL. Cualquier otra cosa
 * (p. ej. la «firma» digital del móvil: sesión, empleado y GPS en base64) no es una imagen y nunca sale.
 */
export function imagenDeFirma(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (s.startsWith("data:image/")) return s;
    if (/^iVBORw0KGgo[A-Za-z0-9+/=\s]*$/.test(s)) return `data:image/png;base64,${s.replace(/\s+/g, "")}`;
    if (/^\/9j\/[A-Za-z0-9+/=\s]*$/.test(s)) return `data:image/jpeg;base64,${s.replace(/\s+/g, "")}`;
    return null;
}
/** Celda de firma de un renglón: la imagen (solo con `firmas`), «Firmada» si existe sin imagen o sin pedirla, y null si no hay firma. */
export const celdaFirma = (v: unknown, firmas: boolean): string | null => {
    if (!String(v ?? "").trim()) return null;
    return (firmas ? imagenDeFirma(v) : null) ?? "Firmada";
};

export type LlaveroCrudo = Record<string, any> & { movimientos?: any[] };

export function armarRegistro(raw: LlaveroCrudo, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const movimientos = (raw.movimientos ?? []).map((m) => ({
        entrega: txt(m.nombre_persona_entrega), recibe: txt(m.nombre_persona_recibe), departamento: txt(m.departamento), telefono: txt(m.telefono),
        dia: diaMov(m), hora: horaMov(m), firma_entrega: celdaFirma(m.firma_entrega, firmas), firma_recibe: celdaFirma(m.firma_recibe, firmas),
    }));
    const responsable = txt(raw.firma_responsable);
    return {
        id: Number(raw.id), variante: null, creado: fmtDt(raw.created_at), estructura: ubic,
        valores: { numero_llavero: txt(raw.numero_llavero), nombre_llavero: txt(raw.nombre_llavero), observaciones: txt(raw.observaciones) },
        listas: { movimientos },
        // El código de sesión del responsable no es una imagen: se informa que existe, nada más.
        firmas: responsable ? { firma_responsable: null } : {},
        firmasPresentes: responsable ? ["firma_responsable"] : [],
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const llaverosForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        // Igual que la lista: solo llaveros activos.
        const rows: any[] = await (db as any).e_llavero.findMany({
            where: { id: { in: ids }, isActive: true },
            select: { id: true, empresa_id: true, cliente_id: true, division_id: true, contrato_id: true, corpo_id: true, puesto_id: true, numero_llavero: true, nombre_llavero: true, observaciones: true, firma_responsable: true, created_at: true },
        });
        if (!rows.length) return [];
        const [movs, ubic] = await Promise.all([
            (db as any).e_movimiento_llavero.findMany({
                where: { llavero_id: { in: rows.map((r) => r.id) } }, orderBy: { id: "desc" },
                // Las firmas de cada movimiento se leen solo para la celda de firma (la imagen solo sale con `firmas`).
                select: { id: true, llavero_id: true, nombre_persona_entrega: true, nombre_persona_recibe: true, departamento: true, telefono: true, fecha: true, hora: true, firma_entrega: true, firma_recibe: true },
            }),
            ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }))),
        ]);
        const porLlavero = new Map<number, any[]>();
        for (const m of movs as any[]) { const k = Number(m.llavero_id); (porLlavero.get(k) ?? porLlavero.set(k, []).get(k)!).push(m); }
        return rows.map((r) => armarRegistro(
            { ...r, movimientos: porLlavero.get(Number(r.id)) ?? [] },
            ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }),
            firmas,
        ));
    },
};
