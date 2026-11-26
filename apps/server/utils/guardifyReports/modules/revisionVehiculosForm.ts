import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";

/**
 * Revisión de vehículos como formulario (bicicleta, motocicleta o vehículo: la tabla es la misma, solo cambia el formato).
 * `informacion_general`, `informacion_revision` y `movimientos_vehiculos` ya se guardan como listas con sus etiquetas.
 */
const parseArr = (raw: unknown): any[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
/** Una imagen de verdad: data URL, o base64 que empieza como PNG o JPEG. La «firma» digital del móvil (sesión, empleado y GPS en base64) NO lo es y nunca sale. */
const isImage = (v: string) => v.startsWith("data:image/") || /^(iVBORw0KGgo|\/9j\/)[A-Za-z0-9+/=\s]{100,}$/.test(v.trim());

/** El tipo se guarda libre («Bicicleta», «Motocicleta», «Vehículo», a veces en minúsculas o sin tilde). */
export function varianteDe(tipo: unknown): string | null {
    const t = String(tipo ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (t.startsWith("bici")) return "Bicicleta";
    if (t.startsWith("moto")) return "Motocicleta";
    if (t.startsWith("veh") || t.startsWith("auto") || t.startsWith("carro")) return "Vehículo";
    return txt(tipo);
}

/** «Bueno» / «Malo» / «No está»: el generador de la app imprime «No está» también para «No existe». */
export function estadoLegible(v: unknown): string | null {
    const n = String(v ?? "").trim().toLowerCase();
    if (!n) return null;
    if (n === "bueno") return "Bueno";
    if (n === "malo") return "Malo";
    if (n === "no está" || n === "no esta" || n === "no existe") return "No está";
    return txt(v);
}

export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const general = parseArr(raw.informacion_general);
    const valores: FormRecord["valores"] = {};
    const sign: Record<string, string> = {};
    for (const it of general) {
        if (!it || typeof it !== "object") continue;
        const key = String(it.key ?? "").trim();
        if (!key || it.kind === "heading") continue;
        const v = String(it.value ?? "");
        if (it.kind === "signature" || (isImage(v) && /firma/i.test(key))) { if (v.trim()) sign[key] = v; continue; }
        if (isImage(v)) continue; // una imagen que no es firma nunca se entrega
        valores[key] = txt(v);
    }
    if (isImage(String(raw.firma_responsable ?? ""))) sign.firma_responsable = String(raw.firma_responsable);
    const creado = fmtDt(raw.created_at);
    valores.cliente ??= ubic.cliente;
    valores.sociedad ??= valores.corpo ?? valores.sucursal ?? ubic.sucursal;
    valores.fecha ??= creado ? creado.slice(0, 10) : null;
    valores.hora ??= creado ? creado.slice(11, 16) : null;
    valores.observaciones = txt(raw.observaciones);
    // El móvil guarda dentro de la revisión (no en la información general) estos datos sueltos; son campos del papel, no ítems de la lista.
    const SUELTOS = new Set(["llaves", "entregado_a", "fecha_entrega", "hora_entrega", "funciona_motor"]);
    const items = parseArr(raw.informacion_revision).filter((e) => e && typeof e === "object" && e.kind !== "heading");
    for (const e of items) {
        const k = String(e.key ?? "").trim();
        if (SUELTOS.has(k)) valores[k] = txt(e.value);
    }
    const revision = items.filter((e) => !SUELTOS.has(String(e.key ?? "").trim())).map((e) => ({
        clave: txt(e.key), item: txt(e.label), valor: estadoLegible(e.value), observacion: txt(e.observation),
    }));
    const movimientos = parseArr(raw.movimientos_vehiculos).filter((m) => m && typeof m === "object").map((m) => ({
        movimiento: txt(m.movimiento), fecha: txt(m.fecha), hora: txt(m.hora), realizado_por: txt(m.realizado_por), autorizado_por: txt(m.autorizado_por),
    }));
    return {
        id: Number(raw.id), variante: varianteDe(raw.tipo), creado, estructura: ubic, valores,
        listas: { revision, movimientos },
        firmas: Object.fromEntries(Object.keys(sign).map((k) => [k, firmas ? sign[k]! : null])),
        firmasPresentes: Object.keys(sign),
        hier: { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.sucursal_id, puesto: raw.puesto_id },
    };
}

export const revisionVehiculosForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_bitacora_vehiculo_detenido.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const ubic = await ubicacionTextos(db as any, rows.map((r) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.sucursal_id, puesto: r.puesto_id })));
        return rows.map((r) => armarRegistro(r, ubic({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.sucursal_id, puesto: r.puesto_id }), firmas));
    },
};
