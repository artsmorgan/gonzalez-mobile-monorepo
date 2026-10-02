/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../../utils/reportError";
const dotenv = require('dotenv');
dotenv.config();

export async function POST(req: NextRequest) {
    try {
        // 🟢 Verificar token de acceso
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const body = await req.json();

        const { empleadoId, timestamp, gps } = body;

        if (!empleadoId || !timestamp || !gps) {
            await reportError(req, "api/digital-signature/generate-signature", "POST", 400, "Datos incompletos");
            return NextResponse.json(
                { error: "Datos incompletos" },
                { status: 400 }
            );
        }

        const secret = process.env.HASH_SECRET || "mi_clave_ultra_segura";

        const sessionId = payload.sessionId;

        // Serializar solo los campos necesarios
        const dataString = btoa(sessionId + ":" + empleadoId + ":" + gps.latitude + ":" + gps.longitude + ":" + timestamp);

        return NextResponse.json({
            status: true,
            hash: dataString,
        }, { status: 200 });
    } catch (error) {
        console.error(error);
        await reportError(req, "api/digital-signature/generate-signature", "POST", 500, "Error interno en la firma");
        return NextResponse.json(
            { status: false, message: "Error interno en la firma" },
            { status: 500 }
        );
    }
}
