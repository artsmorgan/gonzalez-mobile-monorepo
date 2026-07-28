import axios from "axios";
import { toZonedTime } from "date-fns-tz";
import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

type EmpleadoPlanillasRef = {
    id: number;
    cedula: string | null;
};

export async function createTokenPlanillas(
    request: NextRequest,
    empleado: EmpleadoPlanillasRef,
    password: string,
    options?: { accessToken?: string },
) {
    const planillasUrl = process.env.PLANILLAS_URL;
    if (!planillasUrl) {
        throw new Error("PLANILLAS_URL no configurado");
    }

    const cedula = String(empleado.cedula ?? "").trim();
    if (!cedula) {
        throw new Error("Cédula del empleado no disponible");
    }

    const url = `${planillasUrl.replace(/\/+$/, "")}/login`;
    const response = await axios.post(
        url,
        {
            username: cedula,
            password,
        },
        {
            headers: {
                "Content-Type": "application/json",
            },
        },
    );

    if (!response.data?.success) {
        throw new Error("Error al iniciar sesión en Planillas");
    }

    const now = toZonedTime(new Date(), "America/Costa_Rica");
    const expiresInSec = Number(response.data.data.expires_in);
    const expiresInMs = Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec * 1000 : 3600_000;
    const planillasTokenExpiresAt = Date.now() + expiresInMs;
    const expires_at = new Date(planillasTokenExpiresAt);
    const planillasToken = String(response.data.data.token ?? "");

    const prismaOpts = {
        token: options?.accessToken,
        shouldVerifyAccessToken: Boolean(options?.accessToken),
    };

    const mobile_token = await callDynamicPrisma({
        req: request,
        data: {
            action: "GET",
            table: "a_mobile_token_for_planillas",
            operation: "findFirst",
            where: { empleado_id: empleado.id },
        },
        ...prismaOpts,
    });

    if (mobile_token?.id) {
        await callDynamicPrisma({
            req: request,
            data: {
                action: "UPDATE",
                table: "a_mobile_token_for_planillas",
                operation: "update",
                where: { id: mobile_token.id },
                data: {
                    token: planillasToken,
                    created_at: now,
                    expires_at,
                },
            },
            ...prismaOpts,
        });
    } else {
        await callDynamicPrisma({
            req: request,
            data: {
                action: "POST",
                table: "a_mobile_token_for_planillas",
                operation: "create",
                data: {
                    empleado_id: empleado.id,
                    token: planillasToken,
                    created_at: now,
                    expires_at,
                },
            },
            ...prismaOpts,
        });
    }

    return { planillasToken, planillasTokenExpiresAt };
}
