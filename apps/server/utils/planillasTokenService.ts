import axios from "axios";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "./prismaClient";
import { decodeJwtPayloadUnsafe } from "./verifyPlanillasToken";

const COSTA_RICA_TZ = "America/Costa_Rica";

export type PlanillasTokenRecord = {
    id: number;
    empleado_id: number;
    token: string;
    created_at: Date;
    expires_at: Date;
};

export type PlanillasLoginResult = {
    token: string;
    expires_in: number;
    created_at: Date;
    expires_at: Date;
};

export function getPlanillasApiUrl(): string {
    const planillasUrl = process.env.PLANILLAS_URL?.trim();
    if (!planillasUrl) {
        throw new Error("PLANILLAS_URL no configurado");
    }
    return planillasUrl.replace(/\/+$/, "");
}

/** Misma convención de fechas usada históricamente en login / getPlanillasToken. */
export function computePlanillasTokenTimestamps(expires_in: number): {
    created_at: Date;
    expires_at: Date;
} {
    let now = toZonedTime(new Date(), COSTA_RICA_TZ);
    //now = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const expires_at = new Date(now.getTime() + expires_in * 1000);
    return { created_at: now, expires_at };
}

export function isPlanillasTokenRecordValid(
    record: Pick<PlanillasTokenRecord, "expires_at">,
    bufferSeconds = 60
): boolean {
    const now = toZonedTime(new Date(), COSTA_RICA_TZ);
    const threshold = new Date(now.getTime() + bufferSeconds * 1000);
    return new Date(record.expires_at) > threshold;
}

export async function loginPlanillasApi(
    cedula: string,
    password: string
): Promise<PlanillasLoginResult> {
    const url = `${getPlanillasApiUrl()}/login`;
    const response = await axios.post(
        url,
        {
            username: cedula,
            password,
        },
        {
            headers: { "Content-Type": "application/json" },
            validateStatus: () => true,
        }
    );

    if (!response.data?.success || !response.data?.data?.token) {
        throw new Error("Error al iniciar sesión en Planillas");
    }

    const expires_in = Number(response.data.data.expires_in);
    if (!Number.isFinite(expires_in) || expires_in <= 0) {
        throw new Error("Respuesta de Planillas inválida (expires_in)");
    }

    const { created_at, expires_at } = computePlanillasTokenTimestamps(expires_in);
    return {
        token: String(response.data.data.token),
        expires_in,
        created_at,
        expires_at,
    };
}

export async function upsertMobilePlanillasToken(
    empleado_id: number,
    result: PlanillasLoginResult
): Promise<PlanillasTokenRecord> {
    const existing = await prisma.a_mobile_token_for_planillas.findFirst({
        where: { empleado_id },
    });

    if (existing) {
        return prisma.a_mobile_token_for_planillas.update({
            where: { id: existing.id },
            data: {
                token: result.token,
                created_at: result.created_at,
                expires_at: result.expires_at,
            },
        });
    }

    return prisma.a_mobile_token_for_planillas.create({
        data: {
            empleado_id,
            token: result.token,
            created_at: result.created_at,
            expires_at: result.expires_at,
        },
    });
}

export async function getMobilePlanillasTokenRecord(
    empleado_id: number
): Promise<PlanillasTokenRecord | null> {
    return prisma.a_mobile_token_for_planillas.findFirst({
        where: { empleado_id },
    });
}

export async function fetchAndStorePlanillasToken(
    empleado_id: number,
    password: string
): Promise<PlanillasLoginResult> {
    const empleado = await prisma.c_empleado.findFirst({
        where: { id: empleado_id },
        select: { id: true, cedula: true },
    });
    if (!empleado?.cedula) {
        throw new Error("Empleado no encontrado");
    }

    const result = await loginPlanillasApi(empleado.cedula, password);
    await upsertMobilePlanillasToken(empleado_id, result);
    return result;
}

export class PlanillasTokenExpiredError extends Error {
    constructor(message = "Token Planillas expirado. El usuario debe iniciar sesión nuevamente.") {
        super(message);
        this.name = "PlanillasTokenExpiredError";
    }
}

/**
 * Devuelve el token Planillas almacenado en login (contraseña del usuario).
 * No re-autentica en Planillas: si expiró, el usuario debe volver a iniciar sesión.
 */
export async function getStoredPlanillasToken(
    empleado_id: number,
    options?: { bufferSeconds?: number }
): Promise<string> {
    const stored = await getMobilePlanillasTokenRecord(empleado_id);
    if (!stored) {
        throw new PlanillasTokenExpiredError(
            "No hay token Planillas. El usuario debe iniciar sesión nuevamente."
        );
    }

    const bufferSeconds = options?.bufferSeconds ?? 60;
    if (!isPlanillasTokenRecordValid(stored, bufferSeconds)) {
        throw new PlanillasTokenExpiredError();
    }

    return stored.token;
}

export function getPlanillasTokenCreatedAtMs(token: string): number | null {
    const payload = decodeJwtPayloadUnsafe(token);
    if (payload?.iat != null && Number.isFinite(payload.iat)) {
        return Number(payload.iat) * 1000;
    }
    return null;
}

export function toPlanillasTokenResponse(result: PlanillasLoginResult) {
    const createdAtMs = getPlanillasTokenCreatedAtMs(result.token);
    return {
        planillasToken: result.token,
        planillasTokenExpiresAt: result.expires_at.getTime(),
        createdAt: createdAtMs ?? result.created_at.getTime(),
    };
}
