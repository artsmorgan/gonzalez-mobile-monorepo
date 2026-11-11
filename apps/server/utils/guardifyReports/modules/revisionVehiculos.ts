import { parseInformacionRevision, queryRevisionVehiculosRows } from "../../reports-functions/revisionVehiculosReport";
import { ejecutivoPorCorpo, findByIds, nombresEmpleado, ubicacionTextos, usuarioInserta, type UbicacionTextos } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";
import { revisionVehiculosForm } from "./revisionVehiculosForm";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};

/** Texto libre largo: máximo 500 caracteres. */
const clip = (v: unknown, max = 500): string | null => {
    const s = txt(v);
    if (s === null) return null;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

function parseArr(raw: unknown): any[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

/** Valor de texto de un campo de «información general» (no firmas: esas son imágenes). */
function infoValue(items: any[], key: string): string | null {
    const it = items.find((x) => x && typeof x === "object" && x.kind !== "signature" && String(x.key ?? "").toLowerCase() === key);
    if (!it) return null;
    const v = String(it.value ?? "");
    // Un valor con aspecto de imagen o de archivo no se expone nunca.
    if (v.startsWith("data:") || /\.(png|jpe?g|gif|webp)$/i.test(v)) return null;
    return clip(v, 200);
}

/** «Sí»/«No» a partir de un valor de texto o booleano (`true`/`false`, «Sí»/«No», 1/0); cualquier otra cosa o vacío → null. */
function yesNo(v: unknown): string | null {
    if (v === true || v === 1) return "Sí";
    if (v === false || v === 0) return "No";
    const s = String(v ?? "").trim().toLowerCase();
    if (["true", "1", "si", "sí"].includes(s)) return "Sí";
    if (["false", "0", "no"].includes(s)) return "No";
    return null;
}

/** Total de fotos adjuntas (solo el conteo; los nombres de archivo y las imágenes no se exponen). */
function countFotos(...lists: any[][]): number {
    let n = 0;
    for (const list of lists) for (const it of list) if (it && typeof it === "object" && Array.isArray(it.images)) n += it.images.length;
    return n;
}

/**
 * Último cambio de cada registro en el historial (`c_cambios_apps_modules`): cuándo y quién (id de empleado). Una consulta por bloque
 * de 1000 registros; si la base no tiene el historial, ningún registro tiene cambio.
 */
async function ultimosCambios(db: any, tabla: string, ids: unknown[]): Promise<Map<number, { id: number; at: string; by: number }>> {
    const all = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    const out = new Map<number, { id: number; at: string; by: number }>();
    try {
        for (let i = 0; i < all.length; i += 1000) {
            const rows = await db.c_cambios_apps_modules.findMany({ where: { nombre_tabla: tabla, registro_id: { in: all.slice(i, i + 1000) } }, select: { id: true, registro_id: true, created_by: true, created_at: true } });
            for (const c of rows) {
                const at = fmtDt(c.created_at);
                if (!at) continue;
                const prev = out.get(Number(c.registro_id));
                if (!prev || at > prev.at || (at === prev.at && Number(c.id) > prev.id)) out.set(Number(c.registro_id), { id: Number(c.id), at, by: Number(c.created_by) });
            }
        }
    } catch {
        /* sin historial */
    }
    return out;
}

/**
 * Revisión de vehículos (`c_bitacora_vehiculo_detenido`). Se omiten fotos, firmas (`firma_responsable` y las de los
 * oficiales) y los nombres de archivo; de las fotos queda el conteo.
 *
 * Columnas para los filtros: `modelo`, `titulo_propiedad`, `rtv` y `marchamo` salen de la «información general» de la
 * revisión y, si ahí no están, del vehículo corporativo vinculado (`veh_*`, que agrega `load`); `vin` solo de la
 * información general o, si ahí no está, del vehículo vinculado (`veh_vin`); `titulo_propiedad_num`, `rtv_num` y `marchamo_num` (texto) igual que `vin`; `corporativo` es «Sí» si la revisión está vinculada a un vehículo corporativo; `uso_vehiculo`
 * («conductor - fecha») es el uso vinculado (`uso_txt`); `ejecutivo_cuenta`, `creado_por` (quien hizo la revisión),
 * `modificado`/`modificado_por` (último cambio del historial `c_cambios_apps_modules`) y la ubicación («código - nombre», `ubicacion`) también los agrega `load`.
 */
export function mapRevisionVehiculoRow(r: any): OutRow {
    const general = parseArr(r.informacion_general);
    const revision = parseInformacionRevision(r.informacion_revision);
    const vehiculo = r.vehiculo_id ? txt(r.vehiculo_txt) : null;
    const ubic: Partial<UbicacionTextos> = r.ubicacion ?? {};
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        tipo: txt(r.tipo),
        vehiculo: vehiculo && vehiculo !== "—" && vehiculo !== String(r.vehiculo_id) ? vehiculo : null,
        placa: infoValue(general, "numero_placa"),
        marca: infoValue(general, "marca") ?? txt(r.veh_marca),
        color: infoValue(general, "color"),
        kilometraje: infoValue(general, "km"),
        combustible: infoValue(general, "combustible"),
        empresa: ubic.empresa ?? null,
        cliente: ubic.cliente ?? null,
        division: ubic.division ?? null,
        contrato: ubic.contrato ?? null,
        sucursal: ubic.sucursal ?? null,
        puesto: ubic.puesto ?? null,
        observaciones: clip(r.observaciones),
        puntos_revisados: revision.filter((it: any) => it && typeof it === "object" && it.kind !== "heading" && it.kind !== "signature").length,
        movimientos: Number(r.movimientos_count) || 0,
        fotos: countFotos(general, revision),
        modelo: infoValue(general, "modelo") ?? txt(r.veh_modelo),
        vin: infoValue(general, "vin") ?? txt(r.veh_vin),
        uso_vehiculo: txt(r.uso_txt),
        corporativo: Number(r.vehiculo_id) > 0 ? "Sí" : "No",
        titulo_propiedad: yesNo(infoValue(general, "titulo_propiedad")) ?? yesNo(r.veh_titulo_propiedad),
        rtv: yesNo(infoValue(general, "rtv")) ?? yesNo(r.veh_rtv),
        marchamo: yesNo(infoValue(general, "marchamo")) ?? yesNo(r.veh_marchamo),
        // Número o dato de cada documento (texto opcional, issue #143): el de la revisión y, si no lo trae, el del vehículo vinculado.
        titulo_propiedad_num: infoValue(general, "titulo_propiedad_num") ?? txt(r.veh_titulo_propiedad_num),
        rtv_num: infoValue(general, "rtv_num") ?? txt(r.veh_rtv_num),
        marchamo_num: infoValue(general, "marchamo_num") ?? txt(r.veh_marchamo_num),
        ejecutivo_cuenta: txt(r.ejecutivo_cuenta),
        creado_por: txt(r.creado_por),
        modificado: (r as any).updated_at ? fmtDt((r as any).updated_at) : (fmtDt(r.modificado_at)),
        modificado_por: (r as any).audit_modificado_por ?? (txt(r.modificado_por)),
    };
}

/**
 * Uso de vehículo vinculado a cada revisión («conductor - AAAA-MM-DD»), en lote: `uso_id` de cada revisión y luego esos usos.
 * Si la base no tiene la columna o la consulta falla, la revisión queda sin uso (no se rompe el reporte).
 */
export async function usoPorRevision(db: any, revisionIds: unknown[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    try {
        const revisiones = await findByIds<{ uso_id: number | null }>(db, "c_bitacora_vehiculo_detenido", revisionIds, { uso_id: true });
        const usos = await findByIds<{ nombre_conductor?: string | null; fecha?: Date | string | null }>(db, "c_usos_vehiculos_corporativos", [...revisiones.values()].map((x) => x.uso_id), { nombre_conductor: true, fecha: true });
        for (const [id, rev] of revisiones) {
            const u = usos.get(Number(rev.uso_id));
            if (!u) continue;
            const label = [txt(u.nombre_conductor), (fmtDt(u.fecha) ?? "").slice(0, 10) || null].filter(Boolean).join(" - ");
            if (label) out.set(id, label);
        }
    } catch {
        /* sin usos */
    }
    return out;
}

/**
 * Revisión de vehículos. Cada fila trae su ubicación completa en la estructura (empresa, cliente, división, contrato,
 * sucursal y puesto). El periodo (`from`/`to`) y la «hora del día» se aplican a la fecha y hora de la revisión (`creado`,
 * `created_at`), la «Fecha de creación» del Excel.
 */
export const revisionVehiculos: GuardifyReportModule = {
    id: "revision_vehiculos",
    supportsScope: true,
    searchKeys: ["vehiculo", "placa", "vin", "marca", "contrato", "sucursal", "puesto", "cliente", "observaciones"],
    filterKeys: ["tipo", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "creado", "vehiculo", "uso_vehiculo", "marca", "modelo", "vin", "corporativo", "titulo_propiedad", "rtv", "marchamo", "titulo_propiedad_num", "rtv_num", "marchamo_num", "ejecutivo_cuenta", "creado_por", "modificado", "modificado_por"],
    sortKeys: ["creado", "tipo", "vehiculo", "placa", "vin", "titulo_propiedad_num", "rtv_num", "marchamo_num", "marca", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "puntos_revisados", "movimientos", "fotos", "creado_por", "modificado", "modificado_por"],
    defaultSort: "creado",
    form: revisionVehiculosForm,
    async load(db, p) {
        const rows = await queryRevisionVehiculosRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.sucursal_id, puesto: r.puesto_id }, scope));
        if (!kept.length) return [];
        // Datos para los filtros, en lote (nunca por fila).
        const vehiculos = await findByIds<any>(db, "c_vehiculos_corporativos", kept.map((r) => r.vehiculo_id), { marca: true, modelo: true, titulo_propiedad: true, rtv: true, marchamo: true, vin: true, titulo_propiedad_num: true, rtv_num: true, marchamo_num: true });
        const usos = await usoPorRevision(db, kept.map((r) => r.id));
        const cambios = await ultimosCambios(db, "c_bitacora_vehiculo_detenido", kept.map((r) => r.id));
        const ubicOf = (r: any) => ({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.sucursal_id, puesto: r.puesto_id });
        const [ejecutivos, nombres, ubic] = await Promise.all([
            ejecutivoPorCorpo(db, kept.map((r) => r.sucursal_id)),
            nombresEmpleado(db, [...kept.map((r) => r.created_by), ...[...cambios.values()].map((c) => c.by)]),
            ubicacionTextos(db, kept.map(ubicOf)),
        ]);
        return kept.map((r) => {
            const v = vehiculos.get(Number(r.vehiculo_id));
            const c = cambios.get(Number(r.id));
            return mapRevisionVehiculoRow({
                ...r,
                veh_marca: v?.marca, veh_modelo: v?.modelo, veh_titulo_propiedad: v?.titulo_propiedad, veh_rtv: v?.rtv, veh_marchamo: v?.marchamo,
                veh_vin: v?.vin, veh_titulo_propiedad_num: v?.titulo_propiedad_num, veh_rtv_num: v?.rtv_num, veh_marchamo_num: v?.marchamo_num,
                uso_txt: usos.get(Number(r.id)),
                ejecutivo_cuenta: ejecutivos.get(Number(r.sucursal_id)),
                creado_por: usuarioInserta(r.created_by, nombres),
                modificado_at: c?.at, modificado_por: c ? usuarioInserta(c.by, nombres) : null,
                ubicacion: ubic(ubicOf(r)),
            });
        });
    },
};
