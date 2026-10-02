import { NextRequest } from "next/server";
import axios from "axios";

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

    return {
        valid: !!data.valid,
        expired: !!data.expired,
        payload: data.payload ?? null,
        message: data.message || "Token inválido",
    };
}


