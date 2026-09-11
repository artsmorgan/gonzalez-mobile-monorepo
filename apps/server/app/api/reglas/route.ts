import { NextRequest, NextResponse } from "next/server";
import { actions } from "../../../public/actions";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";

import { prisma } from "../../../utils/prismaClient";
import { reportError } from "../../../utils/reportError";

export async function GET(request: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(request);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const reglas = actions.map((action) => ({
            nombre: action.nombre,
            descripcion: action.descripcion,
            actions: action.actions
        }));
        return NextResponse.json(reglas);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        await reportError(request, "api/reglas", "GET", 500, errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}