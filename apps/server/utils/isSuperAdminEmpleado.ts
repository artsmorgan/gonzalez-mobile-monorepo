import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { prisma } from "./prismaClient";
import { guardifyAdmin } from "./guardifyPermissions";
import { serverPermissionDeps } from "./guardifyPermissionDeps";

/** Verifica si el empleado figura en `n_employees_superadmin` por cédula. */
export async function isSuperAdminEmpleado(req: NextRequest, empleadoId: number): Promise<boolean> {
  if (!Number.isFinite(empleadoId) || empleadoId <= 0) return false;

  const empleado = await prisma.c_empleado.findUnique({
    where: { id: empleadoId },
    select: { cedula: true },
  });
  const cedula = String(empleado?.cedula ?? "").trim();
  if (!cedula) return false;

  const row = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "n_employees_superadmin",
      operation: "findFirst",
      where: { employee_cedula: cedula },
    },
  });

  return Boolean(row);
}

/**
 * ¿Puede administrar esto? Con `GUARDIFY_PERMISSIONS=on` lo decide el permiso de Guardify (fase 3 de roles); sin la variable, o si Guardify no
 * tiene a la persona, sigue siendo «figura en `n_employees_superadmin`» (ver `utils/guardifyPermissions.ts`).
 */
export function isAdminFor(req: NextRequest, empleadoId: number, permission: string): Promise<boolean> {
  return guardifyAdmin({ empleadoId, permission, legacy: () => isSuperAdminEmpleado(req, empleadoId), route: req.nextUrl?.pathname }, serverPermissionDeps);
}
