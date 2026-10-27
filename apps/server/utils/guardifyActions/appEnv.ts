import type { NextRequest } from "next/server";
import axios from "axios";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../callDynamicPrisma";
import { prisma } from "../prismaClient";
import { reportError } from "../reportError";
import { sendNotificationByEmployee } from "../sendNotification";
import type { ActionEnv } from "./env";
import { tokenPlanillasVigente } from "./planillas";

const ahoraPared = () => toZonedTime(new Date(), "America/Costa_Rica");

/**
 * Entorno real de las acciones: la misma API dinámica, el mismo Prisma, las mismas notificaciones y la misma hora (Costa Rica) que usan
 * las rutas de la app. `verifyUser: true` = petición de un empleado con su JWT (rutas de la app); `false` = la API de acciones de Guardify,
 * que ya verificó la llave y la identidad del actor (la escritura va con el token móvil del servidor y no deja evidencia de dispositivo).
 */
export function buildActionEnv(req: NextRequest, route: string, method: string, opts: { verifyUser: boolean }): ActionEnv {
    const call: ActionEnv["call"] = (data) => callDynamicPrisma({ req, data, shouldVerifyAccessToken: opts.verifyUser });
    return {
        call,
        prisma,
        notify: (title, message, recipients, originators) => sendNotificationByEmployee(req, 0, originators, title, message, recipients),
        report: (status, message) => reportError(req, route, method, status, message),
        nowIso: (hora) => (hora ? hora.toISOString() : ahoraPared().toISOString()),
        planillas: async (path, body, token) => {
            const r = await axios.post(`${process.env.PLANILLAS_URL}${path}`, body, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
            return r.data;
        },
        tokenPlanillas: async (empleadoId) => {
            // Siempre por el servidor (sin JWT de usuario): es el token que la persona dejó guardado al entrar en la app.
            const row = await callDynamicPrisma({ req, shouldVerifyAccessToken: false, data: { action: "GET", table: "a_mobile_token_for_planillas", operation: "findFirst", where: { empleado_id: empleadoId } } });
            return tokenPlanillasVigente(row, ahoraPared().getTime());
        },
    };
}
