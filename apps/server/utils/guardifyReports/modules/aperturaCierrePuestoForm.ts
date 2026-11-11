import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Apertura/Cierre del puesto como formulario (`c_apertura_cierre_puesto`). La hoja individual del generador trae: datos generales, la lista de
 * actividades (OK / NA con observaciones), el inventario de activos y equipos, otras observaciones y tres representantes con su firma.
 * Las actividades cambian según la división del contrato (Seguridad o Aseo y limpieza) y se guardan con su texto, por eso el formato no
 * lleva ítems fijos: salen las que trae el registro. NO se entregan las fotos de las instalaciones ni la firma del responsable (QR/GPS).
 */
const parseArr = (raw: unknown): any[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
};
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };

/** Firma guardada como data URL o como base64 suelto (igual que el generador); cualquier otra cosa corta no es una imagen. */
export function firmaImagen(v: unknown): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (s.startsWith("data:image/")) return s;
    return /^[A-Za-z0-9+/=\s]{100,}$/.test(s) ? `data:image/png;base64,${s.replace(/\s+/g, "")}` : null;
}

/** El móvil guarda «Ok» y «N/A»; el papel marca OK o NA. */
export function respuestaLegible(v: unknown): string | null {
    const n = String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!n) return null;
    if (n === "ok") return "OK";
    if (n === "na" || n === "nd") return "NA";
    return txt(v);
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

/** `raw` es la fila de la tabla; `puesto` trae el código y el nombre del puesto por separado (la hoja imprime «Número» y «Nombre»). */
export function armarRegistro(raw: any, ubic: FormRecord["estructura"], firmas: boolean, puesto: { codigo?: string | null; nombre?: string | null } = {}, hier?: Hierarchy): FormRecord {
    const creado = fmtDt(raw.created_at);
    const fecha = fmtDt(raw.fecha);
    const tipo = txt(raw.tipo)?.toLowerCase();
    const esApertura = tipo?.includes("apertura") ?? false;
    const esCierre = tipo?.includes("cierre") ?? false;
    const valores: FormRecord["valores"] = {
        cliente: ubic.cliente,
        corpo: ubic.sucursal,
        numero_puesto: txt(puesto.codigo) ?? ubic.puesto,
        nombre_puesto: txt(puesto.nombre) ?? ubic.puesto,
        fecha: fecha ? fecha.slice(0, 10) : null,
        tipo: tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : null,
        // Como lo imprime el generador: «( X ) Apertura    (   ) Cierre».
        tipo_marcado: tipo ? `( ${esApertura ? "X" : " "} ) Apertura    ( ${esCierre ? "X" : " "} ) Cierre` : null,
        nombre_representante_cliente: txt(raw.nombre_representante_cliente),
        nombre_representante_saliente: txt(raw.nombre_representante_empresa_saliente),
        nombre_representante_entrante: txt(raw.nombre_representante_empresa_entrante),
        otras_observaciones: txt(raw.otras_observaciones),
    };
    const actividades = parseArr(raw.actividades).filter((a) => a && typeof a === "object").map((a) => ({
        item: txt(a.pregunta), valor: respuestaLegible(a.respuesta), observacion: txt(a.observaciones),
    }));
    const inventario = parseArr(raw.inventario).filter((i) => i && typeof i === "object").map((i) => ({
        activos_equipos: txt(i.activos_equipos), tipo: txt(i.tipo_nombre), numero_activo: txt(i.numero_activo), numero_serie: txt(i.numero_serie), marca: txt(i.marca), modelo: txt(i.modelo),
    }));
    const sign: Record<string, string> = {};
    for (const [clave, col] of [["firma_cliente", raw.firma_representante_cliente], ["firma_saliente", raw.firma_representante_empresa_saliente], ["firma_entrante", raw.firma_representante_empresa_entrante]] as const) {
        const img = firmaImagen(col);
        if (img) sign[clave] = img;
    }
    return {
        id: Number(raw.id), variante: null, creado, estructura: ubic, valores,
        listas: { actividades, inventario },
        firmas: Object.fromEntries(Object.keys(sign).map((k) => [k, firmas ? sign[k]! : null])),
        firmasPresentes: Object.keys(sign),
        hier: hier ?? { empresa: raw.empresa_id, cliente: raw.cliente_id, division: raw.division_id, contrato: raw.contrato_id, corpo: raw.corpo_id, puesto: raw.puesto_id },
    };
}

export const aperturaCierrePuestoForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const rows: any[] = await (db as any).c_apertura_cierre_puesto.findMany({ where: { id: { in: ids }, isActive: true } });
        if (!rows.length) return [];
        const incompletas = rows.filter((r) => !(Number(r.empresa_id) > 0 && Number(r.division_id) > 0 && Number(r.contrato_id) > 0));
        const [desdePuesto, puestos] = await Promise.all([
            loadPuestoHierarchy(db as any, incompletas.map((r) => Number(r.puesto_id))),
            findByIds<{ codigo: string | null; nombre: string | null }>(db as any, "e_estructura_puesto", rows.map((r) => r.puesto_id), { codigo: true, nombre: true }),
        ]);
        const ubicIds = rows.map((r) => ubicacionDe(r, desdePuesto.get(Number(r.puesto_id))));
        const ubic = await ubicacionTextos(db as any, ubicIds);
        return rows.map((r, i) => armarRegistro(r, ubic(ubicIds[i]!), firmas, puestos.get(Number(r.puesto_id)) ?? {}, ubicIds[i]));
    },
};
