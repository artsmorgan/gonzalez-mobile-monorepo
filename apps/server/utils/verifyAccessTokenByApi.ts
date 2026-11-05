import { NextRequest } from "next/server";
import axios from "axios";
import { guardifyDeviceGate } from "./guardifyDevices";

type VerifyTokenResponse = {
    valid: boolean;
    expired: boolean;
    payload: any;
    message: string;
};

export async function verifyAccessTokenByApi(req: NextRequest): Promise<VerifyTokenResponse> {
    const serverUrl = process.env.SERVER_URL?.trim();
    const host = req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const inferredProto = host && (host.includes("localhost") || host.includes("127.0.0.1")) ? "http" : "https";
    const proto = forwardedProto?.split(",")[0]?.trim() || inferredProto;
    const fallbackBaseUrl = host ? `${proto}://${host}` : req.nextUrl.origin;
    const baseUrl = serverUrl && serverUrl.length > 0 ? serverUrl.replace(/\/+$/, "") : fallbackBaseUrl;
    const url = `${baseUrl}/api/dynamic-prisma`;

    const authHeaderRaw = req.headers.get("authorization") || "";
    const tokenFromQuery = req.nextUrl.searchParams.get("token") || "";
    const authHeader =
        authHeaderRaw && authHeaderRaw.trim().length > 0
            ? authHeaderRaw
            : tokenFromQuery.trim().length > 0
                ? `Bearer ${tokenFromQuery.trim()}`
                : "";
    const response = await axios.get(url, {
        headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
        },
        validateStatus: () => true,
    });

    const data = response?.data || {};

    const result: VerifyTokenResponse = {
        valid: !!data.valid,
        expired: !!data.expired,
        payload: data.payload ?? null,
        message: data.message || "Token inválido",
    };

    // Punto único para exigir que el equipo esté aprobado en Guardify (issues #149 y #150): en `off` (por defecto) no hace nada; en `observe`
    // solo registra; en `on` corta con 403 `device_not_approved|ESTADO|motivo`.
    if (result.valid) {
        const denied = await guardifyDeviceGate({ payload: result.payload, route: req.nextUrl?.pathname, method: req.method, stage: "request", appVersion: req.headers.get("x-app-version") });
        if (denied) return { valid: false, expired: false, payload: null, message: denied };
    }

    return result;
}


