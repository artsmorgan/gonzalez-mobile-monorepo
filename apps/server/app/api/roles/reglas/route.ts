import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { actions } from "../../../../public/actions";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const roleName = searchParams.get("roleName");
        if (!roleName) {
            return NextResponse.json({ message: "Rol no especificado" }, { status: 404 });
        }
        const role = await prisma.roles_security.findFirst({ where: { name: roleName } });
        if (!role) {
            return NextResponse.json({ message: "Rol no encontrado" }, { status: 404 });
        }

        const actionsForRole = [];
        for (const actionModule of actions) {
            if (actionModule.actions) {
                const actionsValidated = [];
                for (const action of actionModule.actions) {
                    actionsValidated.push({ nombre: action, validate: false });
                }

                const roleModule = await prisma.roles_security_modules.findFirst({ where: { rol_id: role.id, module_name: actionModule.nombre } });
                if (roleModule && roleModule.actions != null && roleModule.actions != "") {
                    for (const actionRole of JSON.parse(roleModule.actions)) {
                        const actToValidate = actionsValidated.find(a => a.nombre === actionRole);
                        if (actToValidate) {
                            actToValidate.validate = true;
                        }
                    }
                }
                actionsForRole.push({
                    module_name: actionModule.nombre,
                    actions: actionsValidated
                });
            }
        }

        return NextResponse.json(actionsForRole);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}