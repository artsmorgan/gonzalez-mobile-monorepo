import { NextRequest } from "next/server";

/** JWT de acceso del usuario (no confundir con MOBILE_ACCESS_TOKEN). */
export function isLikelyJwt(token?: string | null): boolean {
    const t = String(token || "").trim();
    if (!t || t.length < 20) return false;
    return t.split(".").length === 3 && t.startsWith("eyJ");
}

export function resolveUserAccessToken(req: NextRequest, explicitToken?: string): string {
    if (isLikelyJwt(explicitToken)) return String(explicitToken).trim();

    const authHeader = (req.headers.get("authorization") || "").trim();
    if (authHeader.startsWith("Bearer ")) {
        const fromHeader = authHeader.slice("Bearer ".length).trim();
        if (isLikelyJwt(fromHeader)) return fromHeader;
    }

    const fromQuery = (req.nextUrl.searchParams.get("token") || "").trim();
    if (isLikelyJwt(fromQuery)) return fromQuery;

    return "";
}
