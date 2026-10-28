/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import axios from "axios";
import { resolveUserAccessToken } from "./resolveUserAccessToken";
import { actorFromRequest } from "./auditFields";
import { isInternalRequest, markInternalRequest } from "./internalRequests";
import { llaveroDesdeEntorno, registrarEvidencia, TABLAS_CON_EVIDENCIA } from "./evidencia";

const EVIDENCE_HEADERS = ["x-guardify-device", "x-device-uid", "x-evidence-lat", "x-evidence-lng", "x-evidence-at", "x-evidence-perm"] as const;

/**
 * Evidencia de la acción (issue #153): tras un alta o edición correcta en una tabla con evidencia deja una fila de solo inserción en
 * `c_evidencia_registro`. Se hace aquí, en el único punto por donde pasan todas las escrituras de las rutas, en vez de repetirlo en cada módulo.
 * Solo para peticiones de un usuario autenticado; nunca hace fallar la acción ya guardada.
 */
async function registrarEvidenciaDeEscritura(req: NextRequest, data: Record<string, any>, resultado: unknown, shouldVerifyAccessToken: boolean) {
    try {
    if (!shouldVerifyAccessToken || !TABLAS_CON_EVIDENCIA.has(String(data?.table ?? ""))) return;
    const llavero = llaveroDesdeEntorno(); // clave del sello; sin ella se registra igual, solo con la huella
    const actor = actorFromRequest(req as any);
    if (!actor) return;
    const headers: Record<string, string | undefined> = {};
    for (const h of EVIDENCE_HEADERS) headers[h] = req.headers.get(h) ?? undefined;
    await registrarEvidencia({
        tabla: String(data.table),
        action: String(data.action ?? ""),
        operation: data.operation,
        where: data.where,
        data: (data.data ?? data.body ?? null) as Record<string, unknown> | null,
        resultado,
        headers,
        actor: actor as any,
        llavero,
        escribir: async (fila) => {
            await callDynamicPrisma({ req, shouldVerifyAccessToken: false, data: { action: "POST", table: "c_evidencia_registro", operation: "create", data: fila, returning: false } });
        },
        onError: (e) => console.error("[evidencia] no se pudo registrar:", e instanceof Error ? e.message : e),
    });
    } catch (e) {
        console.error("[evidencia] error preparando la evidencia:", e instanceof Error ? e.message : e);
    }
}

export { markInternalRequest, isInternalRequest };

type CallDynamicPrismaParams = {
    req: NextRequest;
    data: Record<string, any>;
    token?: string;
    shouldVerifyAccessToken?: boolean;
    mobileAccessToken?: string;
};

export async function callDynamicPrisma({
    req,
    data,
    token,
    shouldVerifyAccessToken = true,
    mobileAccessToken,
}: CallDynamicPrismaParams) {
    if (!req) {
        throw new Error("NextRequest (req) no proporcionado");
    }
    if (!req.headers) {
        throw new Error("req.headers no está disponible");
    }
    if (isInternalRequest(req)) shouldVerifyAccessToken = false;

    const accessToken = resolveUserAccessToken(req, token);
    const mobileToken = (mobileAccessToken || process.env.MOBILE_ACCESS_TOKEN || "").trim();
    if (!mobileToken) throw new Error("MOBILE_ACCESS_TOKEN no configurado");

    const serverUrl = process.env.SERVER_URL?.trim();
    const host = req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const inferredProto = host && (host.includes("localhost") || host.includes("127.0.0.1"))
        ? "http"
        : "https";
    const proto = (forwardedProto?.split(",")[0]?.trim() || inferredProto);
    const fallbackBaseUrl = host ? `${proto}://${host}` : (req.nextUrl ? req.nextUrl.origin : "http://localhost:3000");
    const baseUrl = serverUrl && serverUrl.length > 0 ? serverUrl.replace(/\/+$/, "") : fallbackBaseUrl;
    const url = `${baseUrl}/api/dynamic-prisma`;

    let protocol = "https";

    let ultimateUrl = serverUrl;
    switch (process.env.APP_MODE) {
        case "development":
            // Verificar si tiene protocolo
            if (serverUrl && serverUrl.includes("://")) {
                ultimateUrl = `${serverUrl}/api/dynamic-prisma`;
            }
            else {
                ultimateUrl = `${proto}://${serverUrl}/api/dynamic-prisma`;
            }
            break;
        default:
            ultimateUrl = `${serverUrl}/api/dynamic-prisma`;
            break;
    }

    try {
        const axiosHeaders: Record<string, string> = {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "69420",
        };
        /** JWT de usuario en Authorization/body.token; MOBILE_ACCESS_TOKEN solo en mobileAccessToken. */
        if (accessToken) {
            axiosHeaders.Authorization = `Bearer ${accessToken}`;
        }

        const response = await axios.post(
            ultimateUrl,
            {
                token: accessToken || undefined,
                mobileAccessToken: mobileToken,
                shouldVerifyAccessToken,
                ...data,
            },
            {
                headers: axiosHeaders,
            }
        );

        const payloadData = response?.data;
        if (!payloadData?.status) {
            throw new Error(payloadData?.message || "Error en consulta dinámica");
        }
        const resultado = payloadData.data;
        await registrarEvidenciaDeEscritura(req, data, resultado, shouldVerifyAccessToken);
        return resultado;
    } catch (error: any) {
        // Manejar errores de axios
        if (error.response) {
            // El servidor respondió con un código de estado fuera del rango 2xx
            const errorData = error.response.data;
            if (errorData && typeof errorData === 'object' && errorData.message) {
                throw new Error(errorData.message);
            }
            throw new Error(`Error del servidor: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
            // La solicitud se hizo pero no se recibió respuesta
            throw new Error("No se recibió respuesta del servidor");
        } else {
            // Algo más causó el error
            throw new Error(error.message || "Error en la solicitud");
        }
    }
}


