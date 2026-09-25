/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import {
    executeReportesOperation,
    type ReportesPayload,
} from "../app/api/reportes/create";
import { isLikelyJwt, resolveUserAccessToken } from "./resolveUserAccessToken";

type CallDynamicReportesParams = {
    req: NextRequest;
    body: Record<string, any>;
};

/** Bearer o solo `?token=` para consumo móvil (mismo patrón que `fetchDynamicFile`). */
export function getAuthForDynamicReportesApi(req: NextRequest): { authHeader: string; accessToken: string } {
    const accessToken = resolveUserAccessToken(req);
    const authHeader = accessToken ? `Bearer ${accessToken}` : "";
    return { authHeader, accessToken };
}

export { isLikelyJwt, resolveUserAccessToken };

export async function callDynamicReportesApi({ req, body }: CallDynamicReportesParams) {
    const { accessToken } = getAuthForDynamicReportesApi(req);
    const mobileAccessToken = (process.env.MOBILE_ACCESS_TOKEN || "").trim();
    if (!mobileAccessToken) throw new Error("MOBILE_ACCESS_TOKEN no configurado");

    const payload: ReportesPayload = {
        mobileAccessToken,
        shouldVerifyAccessToken: true,
        token: accessToken || undefined,
        ...body,
    };

    const result = await executeReportesOperation(req, payload);
    if (!result.status) {
        throw new Error(result.message || "Error reportes");
    }
    return result;
}
