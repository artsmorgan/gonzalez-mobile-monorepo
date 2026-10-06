import { queryTiempoAlmuerzoRows } from "../../reports-functions/tiempoAlmuerzoReport";
import { mapTiempoAlmuerzoRow } from "../mappers";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

/** Tiempo de almuerzo (`c_empleado_almuerzo`). Cada fila ya trae su ubicación completa en la estructura. */
export const tiempoAlmuerzo: GuardifyReportModule = {
    id: "tiempo_almuerzo",
    supportsScope: true,
    searchKeys: ["empleado", "cedula", "puesto", "sucursal"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "manual"],
    sortKeys: ["inicio", "fin", "empleado", "cedula", "minutos", "empresa", "cliente", "contrato", "sucursal", "puesto", "pausas"],
    defaultSort: "inicio",
    async load(db, p) {
        const rows = await queryTiempoAlmuerzoRows(db, { inicioDesde: `${p.from}T00:00:00`, finHasta: `${addDays(p.to, -1)}T23:59:59` }, "inicio");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        return kept.map(mapTiempoAlmuerzoRow);
    },
};
