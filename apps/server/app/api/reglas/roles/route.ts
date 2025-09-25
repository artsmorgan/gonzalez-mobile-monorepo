import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../../../../utils/verifyToken";

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
        const perm = searchParams.get("perm");
        const roles = ["ADMINISTRATIVO", "SUPERVISOR", "OPERATIVO"];
        const rolesWithActions = [];
        for (const role of roles) {
            const roleModules = await prisma.roles_security_modules.findFirst({ where: { role_name: role, module_name: perm ?? "" } });
            let actions = [];
            if (roleModules && roleModules.actions != null && roleModules.actions != "") {
                actions = JSON.parse(roleModules.actions);
            }
            rolesWithActions.push({
                name: role,
                actions: actions
            });
        }
        return NextResponse.json(rolesWithActions);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
    try {
        const { valid, payload, message } = verifyAccessToken(request);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { action, isActive, roleName, moduleName } = body;

        if (!roleName) {
            return NextResponse.json({ message: "Rol no especificado" }, { status: 404 });
        }

        const roleModule = await prisma.roles_security_modules.findFirst({ where: { module_name: moduleName, role_name: roleName } });

        let actions = [];
        if (roleModule) {
            actions = roleModule.actions == null || roleModule.actions == "" ? [] : JSON.parse(roleModule.actions);
        }

        if (isActive) {
            actions = actions.filter((a: string) => a !== action);
        }
        else {
            actions.push(action);
        }

        if (roleModule) {
            await prisma.roles_security_modules.update({ where: { id: roleModule.id }, data: { actions: JSON.stringify(actions) } });
        }
        else {
            await prisma.roles_security_modules.create({ data: { actions: JSON.stringify(actions), role_name: roleName, module_name: moduleName } });
        }

        return NextResponse.json({ message: "Acción actualizada correctamente" }, { status: 201 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
