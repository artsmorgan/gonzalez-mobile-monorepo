import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { prisma } from "./prismaClient";

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
