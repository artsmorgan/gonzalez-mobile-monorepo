/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import axios from "axios";

type CallDynamicReportesParams = {
    req: NextRequest;
    body: Record<string, any>;
};

/** Bearer o solo `?token=` para consumo móvil (mismo patrón que `fetchDynamicFile`). */
export function getAuthForDynamicReportesApi(req: NextRequest): { authHeader: string; accessToken: string } {
    let authHeader = (req.headers.get("authorization") || "").trim();
    const tokenQuery = (req.nextUrl.searchParams.get("token") || "").trim();
    if (!authHeader && tokenQuery) {
        authHeader = `Bearer ${tokenQuery}`;
    }
    let accessToken = "";
    if (authHeader.startsWith("Bearer ") && authHeader.length > "Bearer ".length) {
        accessToken = authHeader.slice("Bearer ".length).trim();
    } else if (tokenQuery) {
        accessToken = tokenQuery;
    }
    return { authHeader, accessToken };
}

/** URL POST de `/api/dynamic-prisma/reportes` (honra `SERVER_URL` como el resto de proxies internos). */
export function resolveDynamicReportesApiUrl(req: NextRequest): string {
    const serverUrl = process.env.SERVER_URL?.trim();
    const host = req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const inferredProto =
        host && (host.includes("localhost") || host.includes("127.0.0.1")) ? "http" : "https";
    const proto = forwardedProto?.split(",")[0]?.trim() || inferredProto;
    const fallbackBaseUrl = host ? `${proto}://${host}` : req.nextUrl.origin;
    const baseUrl = serverUrl && serverUrl.length > 0 ? serverUrl.replace(/\/+$/, "") : fallbackBaseUrl;

    let ultimateUrl = `${baseUrl}/api/dynamic-prisma/reportes`;
    if (serverUrl && serverUrl.includes("://")) {
        ultimateUrl = `${serverUrl.replace(/\/+$/, "")}/api/dynamic-prisma/reportes`;
    }
    return ultimateUrl;
}

export async function callDynamicReportesApi({ req, body }: CallDynamicReportesParams) {
    const { authHeader, accessToken } = getAuthForDynamicReportesApi(req);
    const mobileAccessToken = (process.env.MOBILE_ACCESS_TOKEN || "").trim();
    if (!mobileAccessToken) throw new Error("MOBILE_ACCESS_TOKEN no configurado");

    const ultimateUrl = resolveDynamicReportesApiUrl(req);

    const response = await axios.post(
        ultimateUrl,
        {
            mobileAccessToken,
            shouldVerifyAccessToken: true,
            token: accessToken || undefined,
            ...body,
        },
        {
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
            },
            validateStatus: () => true,
        },
    );

    const payloadData = response?.data;
    if (!payloadData?.status) {
        throw new Error(payloadData?.message || `Error reportes (${response.status})`);
    }
    return payloadData;
}
