import { toZonedTime } from "date-fns-tz";
import crypto from "crypto";
import { prisma } from "./prismaClient";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require("jsonwebtoken");

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

type IssueLegacyArgs = {
    empleadoId: number;
    cedula: string | null;
    sessionId: string;
    deviceName?: string;
};

export type LegacyMobileTokens = {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    createdAt: number;
};

/** JWT propio (~24h) + refresh (7d) para clientes móviles en modo legacy durante la transición. */
export async function issueLegacyMobileTokens({
    empleadoId,
    cedula,
    sessionId,
    deviceName,
}: IssueLegacyArgs): Promise<LegacyMobileTokens> {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new Error("JWT secrets not configured");
    }

    const accessToken = jwt.sign(
        { id: empleadoId, cedula, sessionId },
        process.env.JWT_SECRET!,
        { expiresIn: "1d" }
    );

    const refreshToken = jwt.sign(
        { id: empleadoId, sessionId },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "7d" }
    );

    const now = toZonedTime(new Date(), "America/Costa_Rica");

    await prisma.refresh_token.updateMany({
        where: { empleadoId },
        data: { revoked: true },
    });

    await prisma.refresh_token.create({
        data: {
            token: hashToken(refreshToken),
            empleadoId,
            sessionId,
            createdAt: now,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            device: deviceName ?? null,
            revoked: false,
        },
    });

    return {
        accessToken,
        refreshToken,
        sessionId,
        createdAt: now.getTime(),
    };
}
