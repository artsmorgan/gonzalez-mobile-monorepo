import { queryRefreshTokensUserLogin } from "../../reports-functions/userLogin";
import { mapIngresoUsuarioRow } from "../mappers";
import { addDays } from "../params";
import type { GuardifyReportModule } from "../types";

/**
 * Ingresos de usuario (`refresh_token`). No tiene ubicación en la estructura, así que no admite alcance por unidad:
 * con un alcance pedido responde 403 y Guardify exige permiso sobre toda la empresa.
 */
export const ingresosUsuario: GuardifyReportModule = {
    id: "ingresos_usuario",
    supportsScope: false,
    searchKeys: ["empleado", "cedula", "id_sesion"],
    filterKeys: ["revocado"],
    sortKeys: ["creado", "expira", "empleado", "cedula", "dispositivos"],
    defaultSort: "creado",
    async load(db, p) {
        const rows = await queryRefreshTokensUserLogin(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "createdAt");
        return rows.map(mapIngresoUsuarioRow);
    },
};
