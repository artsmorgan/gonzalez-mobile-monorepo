import { mapIngresoUsuarioRow } from "../mappers";
import { addDays } from "../params";
import type { GuardifyReportModule } from "../types";

/**
 * Ingresos de usuario (`refresh_token`). No tiene ubicación en la estructura, así que no admite alcance por unidad:
 * con un alcance pedido responde 403 y Guardify exige permiso sobre toda la empresa.
 *
 * Trae a cada empleado solo con las columnas que muestra (nombre y cédula): así el reporte no depende de columnas
 * recientes de `c_empleado` que una base sin migrar todavía no tenga.
 */
export const ingresosUsuario: GuardifyReportModule = {
    id: "ingresos_usuario",
    supportsScope: false,
    searchKeys: ["empleado", "cedula", "id_sesion"],
    filterKeys: ["revocado"],
    sortKeys: ["creado", "expira", "empleado", "cedula", "dispositivos"],
    defaultSort: "creado",
    async load(db, p) {
        const desde = new Date(`${p.from}T00:00:00`);
        const hasta = new Date(`${addDays(p.to, -1)}T23:59:59`);
        const rows = await db.refresh_token!.findMany({ where: { createdAt: { gte: desde, lte: hasta } }, orderBy: { id: "desc" }, take: 50_000 });
        const ids = [...new Set(rows.map((r: any) => Number(r.empleadoId)).filter((n) => Number.isFinite(n) && n > 0))];
        const emps = ids.length ? await db.c_empleado!.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, primer_apellido: true, segundo_apellido: true, cedula: true } }) : [];
        const byId = new Map(emps.map((e: any) => [Number(e.id), e]));
        return rows.map((r: any) => mapIngresoUsuarioRow({ ...r, c_empleado: byId.get(Number(r.empleadoId)) ?? null }));
    },
};
