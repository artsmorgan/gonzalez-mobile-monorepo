/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import axios from "axios";

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

    const authHeader = req.headers.get("authorization");
    const accessToken = token && token.trim().length > 0
        ? token
        : authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : "";
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
        case "production":
            ultimateUrl = `${serverUrl}/api/dynamic-prisma`;
            break;
        default:
            // Verificar si tiene protocolo
            if (serverUrl && serverUrl.includes("://")) {
                ultimateUrl = `${serverUrl}/api/dynamic-prisma`;
            }
            else {
                ultimateUrl = `${proto}://${serverUrl}/api/dynamic-prisma`;
            }
            break;
    }

    try {
        const response = await axios.post(
            ultimateUrl,
            {
                token: accessToken || undefined,
                mobileAccessToken: mobileToken,
                shouldVerifyAccessToken,
                ...data,
            },
            {
                headers: {
                    Authorization: authHeader || "",
                    "Content-Type": "application/json",
                },
            }
        );

        const payloadData = response?.data;
        if (!payloadData?.status) {
            throw new Error(payloadData?.message || "Error en consulta dinámica");
        }
        return payloadData.data;
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


