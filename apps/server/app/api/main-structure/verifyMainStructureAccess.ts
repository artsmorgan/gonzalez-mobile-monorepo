import { NextRequest } from "next/server";
import { isLikelyJwt } from "../../../utils/resolveUserAccessToken";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { verifyTokenFromBody } from "../../../utils/verifyTokenFromBody";

export type MainStructureAccessHints = {
    /** JWT de sesión del usuario (no confundir con `mobileAccessToken`). */
    token?: string;
    /** Secreto compartido app/servidor (`MOBILE_ACCESS_TOKEN`). */
    mobileAccessToken?: string;
    shouldVerifyAccessToken?: boolean;
};

export type MainStructureAccessResult =
    | { ok: true }
    | { ok: false; status: number; body: Record<string, unknown> };

function resolveShouldVerifyAccessToken(
    sp: URLSearchParams,
    body?: MainStructureAccessHints | null,
): boolean {
    if (body?.shouldVerifyAccessToken != null) {
        return body.shouldVerifyAccessToken !== false;
    }
    const fromQuery = sp.get("shouldVerifyAccessToken");
    if (fromQuery == null) return true;
    return fromQuery !== "false";
}

/** Valida JWT de usuario: `Authorization: Bearer` o `token` en query/body (nunca `mobileAccessToken`). */
function resolveUserJwtValidation(
    req: NextRequest,
    tokenCandidates: string[],
): ReturnType<typeof verifyAccessToken> {
    const expectedMobileToken = process.env.MOBILE_ACCESS_TOKEN?.trim() || "";

    const headerValidation = verifyAccessToken(req);
    if (headerValidation.valid) {
        return headerValidation;
    }

    let expiredResult: ReturnType<typeof verifyAccessToken> | null = null;

    for (const raw of tokenCandidates) {
        const token = String(raw || "").trim();
        if (!token) continue;
        if (expectedMobileToken && token === expectedMobileToken) continue;
        if (!isLikelyJwt(token)) continue;

        const validation = verifyTokenFromBody(token);
        if (validation.valid) return validation;
        if (validation.expired) expiredResult = validation;
    }

    return expiredResult ?? headerValidation;
}

/**
 * Valida acceso a main-structure:
 * - `mobileAccessToken` en query o body (secreto compartido).
 * - JWT de sesión en `Authorization`, query `token` o body `token`.
 */
export function verifyMainStructureAccess(
    req: NextRequest,
    body?: MainStructureAccessHints | null,
): MainStructureAccessResult {
    const sp = req.nextUrl.searchParams;
    const expectedMobileToken = process.env.MOBILE_ACCESS_TOKEN?.trim();

    const incomingMobileToken = String(
        sp.get("mobileAccessToken") || body?.mobileAccessToken || "",
    ).trim();

    const shouldVerifyAccessToken = resolveShouldVerifyAccessToken(sp, body);

    if (!expectedMobileToken) {
        return {
            ok: false,
            status: 500,
            body: { status: false, message: "MOBILE_ACCESS_TOKEN no configurado en el servidor" },
        };
    }

    const tokenFromQuery = String(sp.get("token") || "").trim();
    const tokenFromBody = String(body?.token || "").trim();
    const tokenValidation = resolveUserJwtValidation(req, [tokenFromQuery, tokenFromBody]);

    if (shouldVerifyAccessToken && !tokenValidation.valid) {
        return {
            ok: false,
            status: tokenValidation.expired ? 401 : 403,
            body: {
                status: false,
                expired: tokenValidation.expired,
                message: tokenValidation.message,
            },
        };
    }

    return { ok: true };
}
