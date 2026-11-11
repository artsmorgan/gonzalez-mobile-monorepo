/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import getRoleDivision from "../getRoleDivision";
import { prisma } from "../prismaClient";

/**
 * Rol con el que trabaja la persona en una marca (`OPERATIVO`, `SUPERVISOR`, `ADMINISTRATIVO`): sale de la plaza y el contrato de la marca, igual que en
 * `GET /api/attendance/user/[id]`, que es de donde la app toma su `roleName`. Sin plaza o sin categoría resoluble es `OPERATIVO` (el más restrictivo).
 */
export async function rolDeMarca(req: NextRequest, marca: { plaza_id?: number | null; contrato_id?: number | null }): Promise<string> {
    const plaza = marca.plaza_id ? await prisma.e_estructura_plazas.findUnique({ where: { id: Number(marca.plaza_id) } }) : null;
    const contrato = marca.contrato_id ? await prisma.e_estructura_contrato.findUnique({ where: { id: Number(marca.contrato_id) } }) : null;
    const rd = await getRoleDivision(req, plaza as any, (contrato ?? {}) as { division_id?: number | null });
    return rd.role.nombre;
}
