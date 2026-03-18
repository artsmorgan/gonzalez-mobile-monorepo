import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { verifyTokenFromBody } from "../../../utils/verifyTokenFromBody";

export async function GET(req: NextRequest) {
    try {
        // Extraer el token JWT real del header Authorization
        const authHeader = req.headers.get("authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";

        const createdAtParam = req.nextUrl.searchParams.get("created_at");
        const created_at = createdAtParam ? Number(createdAtParam) : 0;

        // Validaciones requeridas
        const expectedMobileToken = process.env.MOBILE_ACCESS_TOKEN?.trim();
        if (!expectedMobileToken) {
            return NextResponse.json(
                { status: false, message: "MOBILE_ACCESS_TOKEN no configurado en el servidor" },
                { status: 500 }
            );
        }
        if (!token) {
            return NextResponse.json({ status: false, message: "Token no proporcionado" }, { status: 403 });
        }

        // Verificamos token (header) y token (payload) igual que en dynamic-prisma.
        const shouldVerifyAccessToken = true;
        const tokenValidationHeader = verifyAccessToken(req);
        const tokenValidationBody = verifyTokenFromBody(token);
        const tokenValidation = tokenValidationHeader.valid ? tokenValidationHeader : tokenValidationBody;

        if (shouldVerifyAccessToken && !tokenValidation.valid) {
            return NextResponse.json(
                { status: false, expired: tokenValidation.expired, message: tokenValidation.message },
                { status: tokenValidation.expired ? 401 : 403 }
            );
        }

        // En este endpoint el mobile no envía mobileAccessToken: lo tomamos desde env.
        const incomingMobileToken = expectedMobileToken;
        if (!incomingMobileToken || incomingMobileToken !== expectedMobileToken) {
            return NextResponse.json({ status: false, message: "mobileAccessToken inválido" }, { status: 403 });
        }

        // Llamado correcto a dynamic-prisma: usando GET (query params).
        const response = await axios.get(
            `${process.env.SERVER_URL}/api/dynamic-prisma/main-structure`,
            {
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                },
                params: {
                    token: token,
                    mobileAccessToken: incomingMobileToken,
                    shouldVerifyAccessToken: true,
                    created_at: Number.isFinite(created_at) ? created_at : 0,
                },
                validateStatus: () => true,
            }
        );

        const data = response.data;
        if (!data?.status) {
            return NextResponse.json({ status: false, structure: [], message: data?.message }, { status: 500 });
        }

        return NextResponse.json(
            { status: true, structure: data.structure, created_at: data.created_at },
            { status: 200 }
        );
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}