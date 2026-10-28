import type { NextRequest } from "next/server";
import axios from "axios";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../callDynamicPrisma";
import { markInternalRequest } from "../internalRequests";
import { prisma } from "../prismaClient";
import { reportError } from "../reportError";
import { sendNotificationByEmployee } from "../sendNotification";
import type { ActionEnv } from "./env";
import { makeActionEnv } from "./envFactory";

/** Plazo máximo de una llamada a Planillas: sin él, una Planillas colgada deja la acción esperando mientras Guardify reintenta. */
const PLANILLAS_TIMEOUT_MS = 30_000;

/** Entorno real de las acciones (ver `envFactory.ts`): la misma API dinámica, el mismo Prisma, las mismas notificaciones y la misma hora (Costa Rica) que usan las rutas de la app. */
export function buildActionEnv(req: NextRequest, route: string, method: string, opts: { verifyUser: boolean }): ActionEnv {
    return makeActionEnv(
        {
            callDynamicPrisma,
            markInternalRequest,
            reportError,
            sendNotificationByEmployee,
            prisma,
            planillasPost: async (path, body, token) => (await axios.post(`${process.env.PLANILLAS_URL}${path}`, body, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, timeout: PLANILLAS_TIMEOUT_MS })).data,
            ahoraPared: () => toZonedTime(new Date(), "America/Costa_Rica"),
        },
        req,
        route,
        method,
        opts,
    );
}
