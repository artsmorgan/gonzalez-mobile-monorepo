import { queryArticulosPuestoRows } from "../../reports-functions/articulosPuestoReport";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { matchesScope, NIVELES, type Nivel, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const idOrNull = (v: unknown): number | null => (Number(v) > 0 ? Number(v) : null);

/** Filtro de la consulta original por nivel de la estructura (para traer solo los puestos del alcance). */
const FILTRO_POR_NIVEL: Record<Nivel, "empresaIds" | "clienteIds" | "divisionIds" | "contratoIds" | "corpoIds" | "puestoIds"> = {
    empresa: "empresaIds", cliente: "clienteIds", division: "divisionIds", contrato: "contratoIds", corpo: "corpoIds", puesto: "puestoIds",
};

/**
 * Un artículo de un puesto (plan o entregado) con la ubicación del puesto. `puesto` es la fila de la consulta original
 * (un puesto con sus artículos). Nunca se exponen firmas ni movimientos de mantenimiento (solo su cantidad).
 */
export function mapArticuloPuestoRow(puesto: any, a: any): OutRow {
    const origen = String(a.origen ?? "");
    return {
        id: Number(a.registro_id),
        articulo: txt(a.articulo_nombre),
        origen: origen === "Asignado" ? "Asignado" : "Plan",
        cantidad: a.cantidad == null || a.cantidad === "" || !Number.isFinite(Number(a.cantidad)) ? null : Number(a.cantidad),
        marca: txt(a.marca),
        modelo: txt(a.modelo),
        serie: txt(a.serie),
        fecha_entrega: fmtDt(a.fecha_entrega_raw),
        combo: txt(a.combo_nombre),
        movimientos: Number(a.movimientos_count ?? 0),
        empresa: txt(puesto.empresa_txt),
        cliente: txt(puesto.cliente_txt),
        division: txt(puesto.division_txt),
        contrato: txt(puesto.contrato_txt),
        sucursal: txt(puesto.corpo_txt),
        puesto: txt(puesto.puesto_txt),
    };
}

/**
 * Filas del reporte: una por artículo. Los artículos del plan no tienen fecha, así que se muestran siempre; los asignados
 * (entregados) se filtran por `fecha_entrega` dentro del periodo. Puestos sin artículos no generan filas.
 */
export function buildArticulosPuestoRows(puestos: any[], from: string, to: string, scope: ScopeItem[] | null): OutRow[] {
    const out: OutRow[] = [];
    for (const pu of puestos) {
        if (scope && !matchesScope({ empresa: idOrNull(pu.empresa_id), cliente: idOrNull(pu.cliente_id), division: idOrNull(pu.division_id), contrato: idOrNull(pu.contrato_id), corpo: idOrNull(pu.corpo_id), puesto: idOrNull(pu.puesto_id) }, scope)) continue;
        for (const a of pu.articulos ?? []) {
            if (a.origen === "Asignado") {
                const day = fmtDt(a.fecha_entrega_raw)?.slice(0, 10);
                if (!day || day < from || day >= to) continue;
            }
            out.push(mapArticuloPuestoRow(pu, a));
        }
    }
    return out;
}

/**
 * Artículos del puesto: plan de artículos (incluye combos) y artículos entregados, por puesto. Cada puesto trae su ubicación
 * completa, así que admite alcance. Con alcance se consulta solo por los niveles pedidos (una consulta por nivel) en vez de
 * recorrer todos los puestos.
 */
export const articulosPuesto: GuardifyReportModule = {
    id: "articulos_puesto",
    supportsScope: true,
    searchKeys: ["articulo", "marca", "modelo", "serie", "puesto", "sucursal", "combo"],
    filterKeys: ["origen", "articulo", "empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["articulo", "origen", "cantidad", "marca", "modelo", "serie", "fecha_entrega", "movimientos", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    defaultSort: "fecha_entrega",
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
        return buildArticulosPuestoRows(puestos, p.from, p.to, p.scope);
    },
};
