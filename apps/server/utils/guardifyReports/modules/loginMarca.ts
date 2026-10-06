import { queryLoginMarcaRows } from "../../reports-functions/loginMarcaReport";
import { mapLoginMarcaRow } from "../mappers";
import { addDays } from "../params";
import { loadPuestoHierarchy, matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

/** Login de marca (`c_login_marca_almuerzo`). Solo guarda `puesto_id`: la estructura se deduce del puesto. */
export const loginMarca: GuardifyReportModule = {
    id: "login_marca",
    supportsScope: true,
    searchKeys: ["empleado", "cedula", "puesto"],
    filterKeys: ["puesto"],
    sortKeys: ["fecha", "cedula", "empleado", "puesto", "entrada_real", "salida_real"],
    defaultSort: "fecha",
    async load(db, p) {
        const rows = await queryLoginMarcaRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha_hora");
        if (!p.scope) return rows.map(mapLoginMarcaRow);
        const scope = p.scope;
        const hier = await loadPuestoHierarchy(db as any, rows.map((r: any) => Number(r.puesto_id)));
        return rows.filter((r: any) => {
            const h = hier.get(Number(r.puesto_id));
            return !!h && matchesScope(h, scope);
        }).map(mapLoginMarcaRow);
    },
};
