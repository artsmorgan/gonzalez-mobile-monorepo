import { prisma } from "./prismaClient";
import type { PermissionDeps } from "./guardifyPermissions";

/** Cédula del empleado (su id en Guardify). */
async function cedulaOf(empleadoId: number): Promise<string | null> {
  const e = await prisma.c_empleado.findUnique({ where: { id: empleadoId }, select: { cedula: true } });
  const cedula = String(e?.cedula ?? "").trim();
  return cedula || null;
}

/** Dependencias reales de `utils/guardifyPermissions.ts` en el servidor. */
export const serverPermissionDeps: PermissionDeps = { cedulaOf };
