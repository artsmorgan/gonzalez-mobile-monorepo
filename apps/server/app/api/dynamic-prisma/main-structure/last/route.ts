import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import fs from "fs/promises";
import path from "path";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { verifyTokenFromBody } from "../../../../../utils/verifyTokenFromBody";

// Función GET para obtener el archivo
export async function GET(req: NextRequest) {
    try {
        const sp = req.nextUrl.searchParams;

        const expectedMobileToken = process.env.MOBILE_ACCESS_TOKEN?.trim();
        const incomingMobileToken = String(sp.get("mobileAccessToken") || "").trim();
        const token = String(sp.get("token") || "").trim();
        const shouldVerifyAccessToken =
            sp.get("shouldVerifyAccessToken") == null ? true : sp.get("shouldVerifyAccessToken") !== "false";
        const createdAtRequestedRaw = sp.get("created_at");
        const createdAtRequested = createdAtRequestedRaw ? Number(createdAtRequestedRaw) : 0;

        if (!expectedMobileToken) {
            return NextResponse.json(
                { status: false, message: "MOBILE_ACCESS_TOKEN no configurado en el servidor" },
                { status: 500 }
            );
        }
        if (!incomingMobileToken) {
            return NextResponse.json(
                { status: false, message: "mobileAccessToken es obligatorio" },
                { status: 403 }
            );
        }
        if (incomingMobileToken !== expectedMobileToken) {
            return NextResponse.json(
                { status: false, message: "mobileAccessToken inválido" },
                { status: 403 }
            );
        }

        const tokenValidationHeader = verifyAccessToken(req);
        const tokenValidationBody = verifyTokenFromBody(token);
        const tokenValidation = tokenValidationHeader.valid ? tokenValidationHeader : tokenValidationBody;

        if (shouldVerifyAccessToken && !tokenValidation.valid) {
            return NextResponse.json(
                { status: false, expired: tokenValidation.expired, message: tokenValidation.message },
                { status: tokenValidation.expired ? 401 : 403 }
            );
        }

        console.log(7);
        const outPath = path.resolve(process.cwd(), "main-structure.json");

        console.log(8);
        let data: string;
        try {
            data = await fs.readFile(outPath, "utf8");
        } catch {
            // Cache inexistente: devolvemos vacío para que el cliente pueda regenerar.
            return NextResponse.json(
                { status: false, created_at: null, message: "Cache main-structure.json no existe", structure: JSON.stringify([]) },
                { status: 200 }
            );
        }

        console.log(9);
        let parsed: { created_at: unknown; structure: unknown };
        try {
            parsed = JSON.parse(data);
        } catch (e) {
            // Cache corrupto/truncado: lo movemos a un backup y devolvemos vacío.
            try {
                const corruptPath = `${outPath}.corrupt.${Date.now()}`;
                await fs.rename(outPath, corruptPath);
            } catch {
                await fs.unlink(outPath).catch(() => undefined);
            }

            return NextResponse.json(
                {
                    status: false,
                    created_at: null,
                    message: "Cache main-structure.json inválida (corrupta/truncada). Se requiere regeneración.",
                    structure: JSON.stringify([]),
                },
                { status: 200 }
            );
        }

        console.log(10);
        const { created_at, structure } = parsed;
        console.log(11);
        return NextResponse.json({ status: true, created_at }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        console.error("[main-structure] Error al leer main-structure.json:", errorMessage);
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}