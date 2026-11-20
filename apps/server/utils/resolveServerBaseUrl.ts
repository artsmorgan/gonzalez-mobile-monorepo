import { NextRequest } from "next/server";

/** URL base del servidor para llamadas internas axios (auth, planillas, etc.). */
export function resolveServerBaseUrl(req: NextRequest): string {
    const serverUrl = process.env.SERVER_URL?.trim();
    if (serverUrl && serverUrl.length > 0) {
        return serverUrl.replace(/\/+$/, "");
    }
    return req.nextUrl.origin.replace(/\/+$/, "");
}
