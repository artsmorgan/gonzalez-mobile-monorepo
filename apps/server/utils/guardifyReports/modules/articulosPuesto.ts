import { queryArticulosPuestoRows } from "../../reports-functions/articulosPuestoReport";
import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ejecutivoPorCorpo } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { matchesScope, NIVELES, type Nivel, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";
import { articulosPuestoForm } from "./articulosPuestoForm";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const idOrNull = (v: unknown): number | null => (Number(v) > 0 ? Number(v) : null);

/** Estado y tipo de acción del último mantenimiento de un artículo (issue #140). */
export type UltimoMantenimiento = { estado: string | null; accion: string | null };

const claveArticulo = (origen: unknown, id: unknown): string => `${String(origen) === "Asignado" ? "a" : "p"}:${Number(id)}`;
const CHUNK = 1000;

/**
 * Último mantenimiento (el de `id` mayor, igual que la ruta de mantenimiento) de cada artículo. Una consulta por tanda de 1000
 * artículos del plan y otra por tanda de asignados, nunca una por artículo. `c_articulo_mantenimiento` está en la base del servicio dinámico:
 * del artículo (tablas de Planillas, solo lectura) solo se usa el id.
 */
export async function cargarUltimoMantenimiento(db: ReportDataAccess, rows: OutRow[]): Promise<Map<string, UltimoMantenimiento>> {
    const planIds = [...new Set(rows.filter((r) => r.origen !== "Asignado").map((r) => Number(r.id)).filter((n) => n > 0))];
    const asignadoIds = [...new Set(rows.filter((r) => r.origen === "Asignado").map((r) => Number(r.id)).filter((n) => n > 0))];
    const latest = new Map<string, { id: number } & UltimoMantenimiento>();
    const guardar = (key: string, m: any) => {
        const id = Number(m.id);
        const prev = latest.get(key);
        if (!prev || id > prev.id) latest.set(key, { id, estado: txt(m.estado), accion: txt(m.accion) });
    };
    const select = { id: true, articulo_plan_id: true, articulo_asignado_id: true, estado: true, accion: true };
    for (let i = 0; i < planIds.length; i += CHUNK) {
        const ms: any[] = await (db as any).c_articulo_mantenimiento.findMany({ where: { articulo_plan_id: { in: planIds.slice(i, i + CHUNK) } }, select });
        for (const m of ms) if (m.articulo_plan_id) guardar(claveArticulo("Plan", m.articulo_plan_id), m);
    }
    for (let i = 0; i < asignadoIds.length; i += CHUNK) {
        const ms: any[] = await (db as any).c_articulo_mantenimiento.findMany({ where: { articulo_asignado_id: { in: asignadoIds.slice(i, i + CHUNK) } }, select });
        for (const m of ms) if (m.articulo_asignado_id) guardar(claveArticulo("Asignado", m.articulo_asignado_id), m);
    }
    return new Map([...latest].map(([k, v]) => [k, { estado: v.estado, accion: v.accion }]));
}

/** Agrega `estado` y `accion` a cada fila (vacíos si el artículo nunca tuvo mantenimiento). */
export function aplicarUltimoMantenimiento(rows: OutRow[], mant: Map<string, UltimoMantenimiento>): OutRow[] {
    return rows.map((r) => {
        const m = mant.get(claveArticulo(r.origen, r.id));
        return { ...r, estado: m?.estado ?? null, accion: m?.accion ?? null };
    });
}

/** Filtro de la consulta original por nivel de la estructura (para traer solo los puestos del alcance). */
const FILTRO_POR_NIVEL: Record<Nivel, "empresaIds" | "clienteIds" | "divisionIds" | "contratoIds" | "corpoIds" | "puestoIds"> = {
    empresa: "empresaIds", cliente: "clienteIds", division: "divisionIds", contrato: "contratoIds", corpo: "corpoIds", puesto: "puestoIds",
};

/**
 * Un artículo de un puesto (plan o entregado) con la ubicación del puesto. `puesto` es la fila de la consulta original
 * (un puesto con sus artículos). Nunca se exponen firmas ni movimientos de mantenimiento (solo su cantidad). `estado` y `accion` los completa `load` con el último mantenimiento.
 * `ejecutivo` = ejecutivo de cuenta de la sucursal del puesto (se carga en lote en `load`).
 */
export function mapArticuloPuestoRow(puesto: any, a: any, ejecutivo: string | null = null): OutRow {
    const origen = String(a.origen ?? "");
    return {
        id: Number(a.registro_id),
        // Ni el plan (`e_estructura_articulo_corpo_puesto_plan`) ni lo entregado (`..._entrega`) guardan fecha/usuario de alta ni de
        // modificación (solo `fechaEntrega`, que es la fecha del hecho): las cuatro columnas estándar salen null (brecha).
        creado: null,
        creado_por: null,
        modificado: null,
        modificado_por: null,
        articulo: txt(a.articulo_nombre),
        origen: origen === "Asignado" ? "Asignado" : "Plan",
        cantidad: a.cantidad == null || a.cantidad === "" || !Number.isFinite(Number(a.cantidad)) ? null : Number(a.cantidad),
        marca: txt(a.marca),
        modelo: txt(a.modelo),
        serie: txt(a.serie),
        fecha_entrega: fmtDt(a.fecha_entrega_raw),
        combo: txt(a.combo_nombre),
        movimientos: Number(a.movimientos_count ?? 0),
        estado: null,
        accion: null,
        empresa: txt(puesto.empresa_txt),
        cliente: txt(puesto.cliente_txt),
        division: txt(puesto.division_txt),
        contrato: txt(puesto.contrato_txt),
        sucursal: txt(puesto.corpo_txt),
        puesto: txt(puesto.puesto_txt),
        ejecutivo_cuenta: txt(ejecutivo),
    };
}

/**
 * Filas del reporte: una por artículo. Los artículos del plan no tienen fecha, así que se muestran siempre; los asignados
 * (entregados) se filtran por `fecha_entrega` dentro del periodo. Puestos sin artículos no generan filas.
 */
export function buildArticulosPuestoRows(puestos: any[], from: string, to: string, scope: ScopeItem[] | null, ejecutivos: Map<number, string> = new Map()): OutRow[] {
    const out: OutRow[] = [];
    for (const pu of puestos) {
        if (scope && !matchesScope({ empresa: idOrNull(pu.empresa_id), cliente: idOrNull(pu.cliente_id), division: idOrNull(pu.division_id), contrato: idOrNull(pu.contrato_id), corpo: idOrNull(pu.corpo_id), puesto: idOrNull(pu.puesto_id) }, scope)) continue;
        for (const a of pu.articulos ?? []) {
            if (a.origen === "Asignado") {
                const day = fmtDt(a.fecha_entrega_raw)?.slice(0, 10);
                if (!day || day < from || day >= to) continue;
            }
            out.push(mapArticuloPuestoRow(pu, a, ejecutivos.get(Number(pu.corpo_id)) ?? null));
        }
    }
    return out;
}

/**
 * Artículos del puesto: plan de artículos (incluye combos) y artículos entregados, por puesto. Cada puesto trae su ubicación
 * completa, así que admite alcance. Con alcance se consulta solo por los niveles pedidos (una consulta por nivel) en vez de
 * recorrer todos los puestos. Periodo: `fecha_entrega` (los artículos del plan no tienen fecha y salen siempre). Los artículos no
 * guardan quién ni cuándo los registró o modificó (las cuatro columnas de auditoría salen null).
 * `estado` y `accion` son los del ÚLTIMO mantenimiento del artículo (`c_articulo_mantenimiento`, el de id mayor); vacíos si nunca tuvo uno.
 */
export const articulosPuesto: GuardifyReportModule = {
    id: "articulos_puesto",
    supportsScope: true,
    searchKeys: ["articulo", "marca", "modelo", "serie", "puesto", "sucursal", "combo"],
    filterKeys: ["origen", "articulo", "estado", "accion", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por"],
    sortKeys: ["articulo", "origen", "estado", "accion", "cantidad", "marca", "modelo", "serie", "fecha_entrega", "movimientos", "empresa", "cliente", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "creado", "creado_por", "modificado", "modificado_por"],
    defaultSort: "fecha_entrega",
    form: articulosPuestoForm,
    async load(db, p) {
        let puestos: any[];
        if (!p.scope) {
            puestos = await queryArticulosPuestoRows(db, {}, "puesto_id");
        } else {
            const byPuesto = new Map<number, any>();
            for (const nivel of NIVELES) {
                const ids = p.scope.filter((s) => s.nivel === nivel).map((s) => s.id);
                if (!ids.length) continue;
                for (const row of await queryArticulosPuestoRows(db, { [FILTRO_POR_NIVEL[nivel]]: ids }, "puesto_id")) byPuesto.set(Number(row.puesto_id), row);
            }
            puestos = [...byPuesto.values()];
        }
        const ejecutivos = await ejecutivoPorCorpo(db, puestos.map((pu) => pu.corpo_id));
        const rows = buildArticulosPuestoRows(puestos, p.from, p.to, p.scope, ejecutivos);
        return aplicarUltimoMantenimiento(rows, await cargarUltimoMantenimiento(db, rows));
    },
};
