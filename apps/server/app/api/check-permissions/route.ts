import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { actions } from "../../../public/actions";
import { verifyAccessToken } from "../../../utils/verifyToken";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(request);
        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const actionsInParams = searchParams.get("actions");
        /*

        if (!id) {
            return NextResponse.json({ message: "Usuario no especificado" }, { status: 404 });
        }

        if (!actionsInParams) {
            return NextResponse.json({ message: "Acciones no especificadas" }, { status: 404 });
        }

        const usuario = await prisma.security_fos_user.findUnique({ where: { id: parseInt(id) } });
        if (!usuario) {
            return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
        }

        const serialized = usuario.roles;
        const roles = [...serialized.matchAll(/"([^"]+)"/g)].map(m => m[1]);

        const actionParams = actionsInParams.split(",");

        // Verificar que todos los actionsInParams estén en el array de actions
        for (const action of actionParams) {
            if (!actions.find(a => a.nombre === action)) {
                return NextResponse.json({ message: "Acción no encontrada" }, { status: 404 });
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

        for (const role of roles) {

            const roleBD = await prisma.roles_security.findFirst({ where: { name: role } });
            if (!roleBD) {
                return NextResponse.json({ message: "Rol no encontrado" }, { status: 404 });
            }

            for (const action of actionsForUserWithValidate) {
                const roleModules = await prisma.roles_security_modules.findFirst({ where: { rol_id: roleBD.id, module_name: action.nombre } });
                if (roleModules && roleModules.actions != null && roleModules.actions != "") {
                    action.actions.forEach(a => {
                        if (a.validate) return;
                        a.validate = JSON.parse(roleModules.actions).includes(a.nombre) ? true : false;
                    });
                }
            }
        }

        return NextResponse.json(actionsForUserWithValidate);
        */
        return NextResponse.json([{}], { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}