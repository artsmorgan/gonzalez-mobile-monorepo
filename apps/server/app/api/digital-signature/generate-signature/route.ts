<<<<<<< Updated upstream
/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyAccessToken } from "../../../../utils/verifyToken";
const dotenv = require('dotenv');
dotenv.config();

export async function POST(req: NextRequest) {
    try {
        // 🟢 Verificar token de acceso
        const { valid, payload, message } = verifyAccessToken(req);

        if (!valid) {
            return NextResponse.json(
                { status: false, message: message },
=======
import { NextResponse } from "next/server";
import crypto from "crypto";

// Secret key for HMAC (in production, store this in environment variables)
const SECRET_KEY = process.env.DIGITAL_SIGNATURE_SECRET || "default-secret-key-change-in-production";

interface RequestBody {
    empleadoId: string;
    timestamp: number;
    gps: {
        latitude: number;
        longitude: number;
        accuracy: number;
    };
}

export async function POST(req: Request) {
    try {
        // Verify authentication token
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json(
                { status: false, message: "No autorizado" },
>>>>>>> Stashed changes
                { status: 401 }
            );
        }

<<<<<<< Updated upstream
        const body = await req.json();

        const { empleadoId, timestamp, gps } = body;

        if (!empleadoId || !timestamp || !gps) {
            return NextResponse.json(
                { error: "Datos incompletos" },
=======
        // Parse request body
        const body: RequestBody = await req.json();
        const { empleadoId, timestamp, gps } = body;

        // Validate required fields
        if (!empleadoId || !timestamp || !gps) {
            return NextResponse.json(
                { status: false, message: "Faltan datos requeridos" },
>>>>>>> Stashed changes
                { status: 400 }
            );
        }

<<<<<<< Updated upstream
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
        return NextResponse.json(
            { status: false, message: "Error interno en la firma" },
=======
        if (!gps.latitude || !gps.longitude) {
            return NextResponse.json(
                { status: false, message: "Coordenadas GPS inválidas" },
                { status: 400 }
            );
        }

        // Generate unique session ID using timestamp and random bytes
        const sessionId = crypto.randomBytes(16).toString('hex');

        // Create data string for hashing (matching the format you specified)
        const dataString = JSON.stringify({
            sessionId: sessionId,
            empleadoId,
            timestamp,
            gps: {
                latitude: gps.latitude,
                longitude: gps.longitude,
                accuracy: gps.accuracy,
            },
        });

        // Generate HMAC-SHA256 hash
        const hash = crypto
            .createHmac("sha256", SECRET_KEY)
            .update(dataString)
            .digest("hex");

        // Return the hash
        return NextResponse.json(
            {
                status: true,
                hash: hash,
                sessionId: sessionId,
                timestamp: timestamp,
                message: "Firma digital generada correctamente",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error generando firma digital:", error);
        return NextResponse.json(
            {
                status: false,
                message: "Error al generar la firma digital",
                error: error instanceof Error ? error.message : "Unknown error",
            },
>>>>>>> Stashed changes
            { status: 500 }
        );
    }
}
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
