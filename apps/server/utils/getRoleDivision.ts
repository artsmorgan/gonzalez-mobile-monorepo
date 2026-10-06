import { NextRequest } from "next/server";
import { prisma } from "./prismaClient";

type RoleDivision = {
    role: { id: number; nombre: string };
    division: { id: number; nombre: string };
};

function resolveRoleNameFromCodigo(codigo: string | null | undefined): string {
    switch (codigo) {
        case "ADM":
            return "ADMINISTRATIVO";
        case "COO":
        case "SUP":
            return "SUPERVISOR";
        default:
            return "OPERATIVO";
    }
}

/** Tablas preexistentes (`n_division`, `pg_categoria_*`) vía Prisma; sin callDynamicPrisma. */
export default async function getRoleDivision(
    _req: NextRequest,
    plaza: { categoriaSalarial_id?: number | null } | null | undefined,
    contrato: { division_id?: number | null },
): Promise<RoleDivision> {
    const roleDivision: RoleDivision = {
        role: { id: 1, nombre: "OPERATIVO" },
        division: { id: 0, nombre: "Indeterminable" },
    };

    try {
        if (!contrato.division_id) {
            return roleDivision;
        }

        const division = await prisma.n_division.findFirst({
            where: { id: contrato.division_id },
        });

        if (division) {
            roleDivision.division.id = division.id;
            roleDivision.division.nombre = division.nombre;
        }

        if (!plaza?.categoriaSalarial_id) {
            return roleDivision;
        }

        const categoria_salarial = await prisma.pg_categoria_salarial.findFirst({
            where: { id: plaza.categoriaSalarial_id },
        });

        if (!categoria_salarial?.categoriaEmpleado_id) {
            return roleDivision;
        }

        const categoria_empleado = await prisma.pg_categoria_empleado.findFirst({
            where: { id: categoria_salarial.categoriaEmpleado_id },
        });

        if (categoria_empleado) {
            roleDivision.role.id = categoria_empleado.id;
            roleDivision.role.nombre = resolveRoleNameFromCodigo(categoria_empleado.codigo);
        }
    } catch (error) {
        console.error("Error al obtener el rol y la división:", error);
    }

    return roleDivision;
}
