import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../utils/prismaClient";

export async function GET(request: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(request);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const { id, perm } = await request.json();

        /*
        // Obtener el usuario
        const usuario = await prisma.security_fos_user.findUnique({ where: { id } });
        if (!usuario) return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 });
        const serialized = usuario.roles;
        const roles = [...serialized.matchAll(/"([^"]+)"/g)].map(m => m[1]);

        // Hallar el rol que diga ROLE_SUPER_ADMIN
        const superAdmin = roles.find(role => role === "ROLE_SUPER_ADMIN");
        if (superAdmin) return NextResponse.json({ message: "Usuario no tiene el rol SUPER_ADMIN" }, { status: 200 });
        */
        return NextResponse.json({});
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}