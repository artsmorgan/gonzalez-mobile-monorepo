import { prisma } from "./prismaClient";
import type { MobileTokenValidation, PlanillasJwtPayload } from "./tokenValidationTypes";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require("jsonwebtoken");

const PLANILLAS_SESSION_LIFETIME_SECONDS = 60 * 60;

export function getPlanillasJwtPublicKey(): string | null {
    const raw = process.env.PLANILLAS_JWT_PUBLIC_KEY?.trim();
    if (!raw) return null;
    return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

/** Clave PEM real configurada (no placeholder de .env.example). */
export function isPlanillasJwtPublicKeyConfigured(): boolean {
    const key = getPlanillasJwtPublicKey();
    if (!key) return false;
    if (!key.includes("BEGIN PUBLIC KEY")) return false;
    if (key.includes("...")) return false;
    return key.length > 120;
}

export function decodeJwtHeader(token: string): { alg?: string } | null {
    try {
        const segment = token.split(".")[0];
        if (!segment) return null;
        const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
        return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    } catch {
        return null;
    }
}

export function decodeJwtPayloadUnsafe(token: string): PlanillasJwtPayload | null {
    try {
        const segment = token.split(".")[1];
        if (!segment) return null;
        const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
        return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    } catch {
        return null;
    }
}

export function isPlanillasJwt(token: string): boolean {
    const header = decodeJwtHeader(token);
    return header?.alg === "RS256";
}

export function getPlanillasSessionLifetimeSeconds(): number {
    return PLANILLAS_SESSION_LIFETIME_SECONDS;
}

type EmpleadoLookup = (
    cedula: string
) => Promise<{ id: number; cedula: string | null } | null>;

async function defaultEmpleadoLookup(cedula: string) {
    return prisma.c_empleado.findFirst({
        where: { cedula },
        select: { id: true, cedula: true },
    });
}

export async function normalizePlanillasPayload(
    decoded: PlanillasJwtPayload,
    lookupEmpleado: EmpleadoLookup = defaultEmpleadoLookup
): Promise<MobileTokenValidation> {
    const username = String(decoded.username ?? "").trim();
    if (!username) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Token Planillas sin username",
        };
    }

    const empleado = await lookupEmpleado(username);
    if (!empleado) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Empleado no encontrado para el token Planillas",
        };
    }

    return {
        valid: true,
        expired: false,
        payload: {
            id: empleado.id,
            cedula: empleado.cedula,
            sessionId: username,
            username,
            roles: Array.isArray(decoded.roles) ? decoded.roles : [],
            iat: decoded.iat,
            exp: decoded.exp,
            tokenType: "planillas",
        },
        message: "Token Planillas válido",
    };
}

/**
 * Valida el token emitido en login móvil: debe coincidir con el guardado en BD
 * y no estar expirado según `exp` del JWT (UTC).
 * Usado cuando PLANILLAS_JWT_PUBLIC_KEY no está configurada o la firma RSA falla.
 */
async function verifyPlanillasTokenFromDatabase(
    token: string,
    lookupEmpleado: EmpleadoLookup = defaultEmpleadoLookup
): Promise<MobileTokenValidation> {
    const payload = decodeJwtPayloadUnsafe(token);
    if (!payload) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Token Planillas ilegible",
        };
    }

    const exp = Number(payload.exp);
    if (Number.isFinite(exp) && Date.now() >= exp * 1000) {
        return {
            valid: false,
            expired: true,
            payload: null,
            message: "Token Planillas expirado",
        };
    }

    const username = String(payload.username ?? "").trim();
    if (!username) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Token Planillas sin username",
        };
    }

    const empleado = await lookupEmpleado(username);
    if (!empleado) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Empleado no encontrado para el token Planillas",
        };
    }

    const stored = await prisma.a_mobile_token_for_planillas.findFirst({
        where: { empleado_id: empleado.id },
        select: { token: true },
    });

    if (!stored || stored.token !== token) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Token Planillas no coincide con sesión de login",
        };
    }

    return normalizePlanillasPayload(payload, async () => empleado);
}

export async function verifyPlanillasToken(
    token: string,
    options?: {
        publicKey?: string | null;
        lookupEmpleado?: EmpleadoLookup;
    }
): Promise<MobileTokenValidation> {
    const trimmed = String(token ?? "").trim();
    if (!trimmed) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Token no proporcionado",
        };
    }

    if (!isPlanillasJwt(trimmed)) {
        return {
            valid: false,
            expired: false,
            payload: null,
            message: "Token no es JWT Planillas (RS256)",
        };
    }

    const key = options?.publicKey ?? getPlanillasJwtPublicKey();
    const rsaConfigured =
        options?.publicKey != null ? Boolean(options.publicKey) : isPlanillasJwtPublicKeyConfigured();

    if (rsaConfigured && key) {
        try {
            const decoded = jwt.verify(trimmed, key, { algorithms: ["RS256"] }) as PlanillasJwtPayload;
            return normalizePlanillasPayload(decoded, options?.lookupEmpleado);
        } catch (error: any) {
            if (error?.name === "TokenExpiredError") {
                return {
                    valid: false,
                    expired: true,
                    payload: null,
                    message: "Token Planillas expirado",
                };
            }
            console.warn(
                "verifyPlanillasToken: verificación RSA falló, usando token almacenado en BD:",
                error?.message ?? error
            );
        }
    }

    return verifyPlanillasTokenFromDatabase(trimmed, options?.lookupEmpleado);
}
