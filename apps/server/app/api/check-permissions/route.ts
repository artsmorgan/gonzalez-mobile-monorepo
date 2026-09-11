import { NextRequest, NextResponse } from "next/server";
import { actions } from "../../../public/actions";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { reportError } from "../../../utils/reportError";

export async function GET(request: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(request);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const actionsInParams = searchParams.get("actions");

        if (!id) {
            await reportError(request, "api/check-permissions", "GET", 400, "Usuario no especificado");
            return NextResponse.json({ message: "Usuario no especificado" }, { status: 400 });
        }
        const empleado = await prisma.c_empleado.findUnique({ where: { id: parseInt(id ?? "0") } });
        if (!empleado) {
            await reportError(request, "api/check-permissions", "GET", 404, "Empleado no encontrado");
            return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
        }

        const empleado_plaza = await prisma.c_empleado_plaza.findMany({ where: { empleado_id: empleado.id } });
        const roles: { role: { name: string, id: number }, division: { id: number, name: string } }[] = [];
        for (const item of empleado_plaza) {
            if (!item.plaza_id || !item.division_id) {
                continue;
            }

            const division = await prisma.n_division.findUnique({ where: { id: item.division_id } });
            if (!division) {
                continue;
            }

            const plaza = await prisma.e_estructura_plazas.findUnique({ where: { id: item.plaza_id } });
            if (!plaza || !plaza.categoriaSalarial_id) {
                continue;
            }

            const categoria_salarial = await prisma.pg_categoria_salarial.findUnique({ where: { id: plaza.categoriaSalarial_id } });
            if (!categoria_salarial || !categoria_salarial.categoriaEmpleado_id) {
                continue;
            }

            const categoria_empleado = await prisma.pg_categoria_empleado.findUnique({ where: { id: categoria_salarial.categoriaEmpleado_id } });
            if (!categoria_empleado) {
                continue;
            }

            let role = "OPERATIVO";
            switch (categoria_empleado.codigo) {
                case "OFI":
                    role = "OPERATIVO";
                    break;
                case "MIS":
                    role = "OPERATIVO";
                    break;
                case "ADM":
                    role = "ADMINISTRATIVO";
                    break;
                case "COO":
                    role = "SUPERVISOR";
                    break;
                case "SUP":
                    role = "SUPERVISOR";
                    break;
                case "OFC":
                    role = "OPERATIVO";
                    break;
            }

            const exist_role = roles.find(role => role.role.id === categoria_empleado.id && role.division.id === item.division_id);
            if (exist_role) {
                continue;
            }

            roles.push({
                role: { name: role, id: categoria_empleado.id },
                division: { id: item.division_id, name: division.nombre }
            });
        }

        if (!id) {
            await reportError(request, "api/check-permissions", "GET", 400, "Usuario no especificado");
            return NextResponse.json({ message: "Usuario no especificado" }, { status: 400 });
        }

        if (!actionsInParams) {
            await reportError(request, "api/check-permissions", "GET", 400, "Acciones no especificadas");
            return NextResponse.json({ message: "Acciones no especificadas" }, { status: 400 });
        }


        const actionParams = actionsInParams.split(",");

        // Verificar que todos los actionsInParams estén en el array de actions
        for (const action of actionParams) {
            if (!actions.find(a => a.nombre === action)) {
                await reportError(request, "api/check-permissions", "GET", 400, "Acción no encontrada");
                return NextResponse.json({ message: "Acción no encontrada" }, { status: 400 });
            }
        }

        // Recuperar los actions del array de actions que sean iguales a los actionsInParams
        const actionsForUser = actions.filter(a => actionParams.includes(a.nombre));

        // El dato actions de cada elemento de actionsForUser debe ser un array de objetos con las propiedades nombre y validate
        const actionsForUserWithValidate = actionsForUser.map(a => ({
            nombre: a.nombre,
            actions: a.actions?.map(a => ({
                nombre: a,
                validate: false
            })) ?? []
        }));


        return NextResponse.json(actionsForUserWithValidate, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(request, "api/check-permissions", "GET", 500, errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}