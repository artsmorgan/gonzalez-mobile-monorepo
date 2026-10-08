import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Llaveros como formulario: el «Movimiento de llaveros» (SEG-F-030) del llavero, con los datos del llavero arriba (los del «Registro de llaveros»,
 * SEG-F-021). Tablas: `e_llavero` y `e_movimiento_llavero` (los movimientos salen del más nuevo al más viejo, como en el Excel). Las llaves que el
 * llavero contiene no se imprimen en el papel y no se incluyen.
 *
 * Las firmas de entrega y recibo son por movimiento y el contrato solo dibuja firmas sueltas: de cada movimiento se informa «Firmada» /
 * «Sin firma». La firma del responsable es un código de sesión (QR/GPS), no una imagen: se informa que existe y nunca se entrega.
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
const firmada = (v: unknown): string => (String(v ?? "").trim() ? "Firmada" : "Sin firma");

export type LlaveroCrudo = Record<string, any> & { movimientos?: any[] };

export function armarRegistro(raw: LlaveroCrudo, ubic: FormRecord["estructura"], _firmas: boolean): FormRecord {
    const movimientos = (raw.movimientos ?? []).map((m) => ({
        entrega: txt(m.nombre_persona_entrega), recibe: txt(m.nombre_persona_recibe), departamento: txt(m.departamento), telefono: txt(m.telefono),
        dia: diaMov(m), hora: horaMov(m), firma_entrega: firmada(m.firma_entrega), firma_recibe: firmada(m.firma_recibe),
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
                // Las firmas de cada movimiento solo se consultan para saber si existen (nunca se entregan).
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
