import type { NextRequest } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../callDynamicPrisma";
import { prisma } from "../prismaClient";
import { reportError } from "../reportError";
import { sendNotificationByEmployee } from "../sendNotification";
import type { ActionEnv } from "./env";

/**
 * Entorno real de las acciones: la misma API dinámica, el mismo Prisma, las mismas notificaciones y la misma hora (Costa Rica) que usan
 * las rutas de la app. `verifyUser: true` = petición de un empleado con su JWT (rutas de la app); `false` = la API de acciones de Guardify,
 * que ya verificó la llave y la identidad del actor (la escritura va con el token móvil del servidor y no deja evidencia de dispositivo).
 */
export function buildActionEnv(req: NextRequest, route: string, method: string, opts: { verifyUser: boolean }): ActionEnv {
    return {
        call: (data) => callDynamicPrisma({ req, data, shouldVerifyAccessToken: opts.verifyUser }),
        prisma,
        notify: (title, message, recipients, originators) => sendNotificationByEmployee(req, 0, originators, title, message, recipients),
        report: (status, message) => reportError(req, route, method, status, message),
        nowIso: (hora) => (hora ? hora.toISOString() : toZonedTime(new Date(), "America/Costa_Rica").toISOString()),
    };
}
