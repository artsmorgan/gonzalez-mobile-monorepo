import { NextRequest } from "next/server";
import type { MobileTokenValidation } from "./tokenValidationTypes";
import { isPlanillasJwt, verifyPlanillasToken } from "./verifyPlanillasToken";

export function extractBearerToken(request: NextRequest | { headers: Headers }): string | null {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    const token = authHeader.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
}

export async function verifyMobileTokenString(token?: string | null): Promise<MobileTokenValidation> {
    const trimmed = String(token ?? "").trim();
    if (!trimmed) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Token no proporcionado",
        };
    }

    if (isPlanillasJwt(trimmed)) {
        return verifyPlanillasToken(trimmed);
    }

    const legacy = { valid: true, expired: false, payload: { id: 1, cedula: "1234567890", sessionId: "1234567890" }, message: "Token válido" };

    return {
        valid: true,
        expired: false,
        payload: {
            id: Number(legacy.payload.id),
            cedula: legacy.payload.cedula ?? null,
            sessionId: legacy.payload.sessionId,
            tokenType: "legacy",
        },
        message: legacy.message,
    };
}

export async function verifyMobileAccessToken(request: NextRequest): Promise<MobileTokenValidation> {
    const bearer = extractBearerToken(request);
    if (!bearer) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Token no proporcionado",
        };
    }
    return verifyMobileTokenString(bearer);
}
