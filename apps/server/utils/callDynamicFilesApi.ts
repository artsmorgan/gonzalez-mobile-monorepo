/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import axios from "axios";

type DynamicFileType = "image" | "video" | "audio" | "text" | "file" | "document";

type UploadFileInput = {
    name?: string;
    original_name?: string;
    extension?: string;
    type?: string;
    mime_type?: string;
    file_base64?: string;
    text_content?: string;
};

const resolveBaseUrl = (req: NextRequest): string => {
    const serverUrl = process.env.SERVER_URL?.trim();
    if (serverUrl && serverUrl.length > 0) return serverUrl.replace(/\/+$/, "");

    const host = req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const inferredProto =
        host && (host.includes("localhost") || host.includes("127.0.0.1")) ? "http" : "https";
    const proto = forwardedProto?.split(",")[0]?.trim() || inferredProto;
    return host ? `${proto}://${host}` : req.nextUrl.origin;
};

const getAuthHeader = (req: NextRequest): string => req.headers.get("authorization") || "";
const getAccessToken = (req: NextRequest): string => {
    const authHeader = getAuthHeader(req);
    if (authHeader.startsWith("Bearer ")) {
        return authHeader.split(" ")[1] || "";
    }
    const tokenFromQuery = req.nextUrl.searchParams.get("token");
    if (tokenFromQuery && tokenFromQuery.trim().length > 0) {
        return tokenFromQuery.trim();
    }
    return "";
};

const ensureOk = (status: number, data: any, endpoint: string) => {
    if (status >= 200 && status < 300) return;
    const message =
        (data && typeof data === "object" && (data.message || data.error)) ||
        `Error en ${endpoint} (HTTP ${status})`;
    throw new Error(String(message));
};

export async function uploadDynamicFiles(params: {
    req: NextRequest;
    folderPath: string;
    files: UploadFileInput[];
    shouldVerifyAccessToken?: boolean;
}) {
    const { req, folderPath, files, shouldVerifyAccessToken = true } = params;
    const baseUrl = resolveBaseUrl(req);
    const endpoint = `${baseUrl}/api/dynamic-prisma/files`;
    const mobileAccessToken = (process.env.MOBILE_ACCESS_TOKEN || "").trim();
    const accessToken = getAccessToken(req);
    const authHeader = getAuthHeader(req) || (accessToken ? `Bearer ${accessToken}` : "");

    const response = await axios.post(
        endpoint,
        {
            folder_path: folderPath,
            files,
            token: accessToken || undefined,
            mobileAccessToken,
            shouldVerifyAccessToken,
        },
        {
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
            },
            validateStatus: () => true,
        }
    );

    ensureOk(response.status, response.data, endpoint);
    return response.data;
}

export async function fetchDynamicFile(params: {
    req: NextRequest;
    type: DynamicFileType;
    url: string;
    shouldVerifyAccessToken?: boolean;
    download?: boolean;
}) {
    console.log(" --------------------------------- fetchDynamicFile", params);
    const { req, type, url, shouldVerifyAccessToken = true, download } = params;
    const baseUrl = resolveBaseUrl(req);
    const endpoint = `${baseUrl}/api/dynamic-prisma/files`;
    const mobileAccessToken = (process.env.MOBILE_ACCESS_TOKEN || "").trim();
    const accessToken = getAccessToken(req);
    const authHeader = getAuthHeader(req) || (accessToken ? `Bearer ${accessToken}` : "");

    const response = await axios.get(endpoint, {
        params: {
            type,
            url,
            token: accessToken || undefined,
            mobileAccessToken,
            shouldVerifyAccessToken,
            ...(typeof download === "boolean" ? { download } : {}),
        },
        headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
        let payloadMessage = "";
        try {
            const text = Buffer.from(response.data).toString("utf8");
            const parsed = JSON.parse(text);
            payloadMessage = parsed?.message || parsed?.error || "";
        } catch {
            payloadMessage = "";
        }
        throw new Error(payloadMessage || `Error en ${endpoint} (HTTP ${response.status})`);
    }

    return {
        buffer: Buffer.from(response.data),
        headers: {
            contentType: response.headers["content-type"] || "application/octet-stream",
            contentDisposition: response.headers["content-disposition"] || "",
            cacheControl: response.headers["cache-control"] || "public, max-age=31536000",
        },
    };
}

export async function deleteDynamicFile(params: {
    req: NextRequest;
    url: string;
    shouldVerifyAccessToken?: boolean;
}) {
    const { req, url, shouldVerifyAccessToken = true } = params;
    const baseUrl = resolveBaseUrl(req);
    const endpoint = `${baseUrl}/api/dynamic-prisma/files`;
    const mobileAccessToken = (process.env.MOBILE_ACCESS_TOKEN || "").trim();
    const accessToken = getAccessToken(req);
    const authHeader = getAuthHeader(req) || (accessToken ? `Bearer ${accessToken}` : "");

    const response = await axios.delete(endpoint, {
        params: {
            url,
            token: accessToken || undefined,
            mobileAccessToken,
            shouldVerifyAccessToken,
        },
        headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
        },
        validateStatus: () => true,
    });

    ensureOk(response.status, response.data, endpoint);
    return response.data;
}


