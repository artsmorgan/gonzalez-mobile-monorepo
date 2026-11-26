/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { callDynamicPrisma } from "../callDynamicPrisma";
import type { Dyn } from "./service";

/** `Dyn` sobre el servicio dinámico (`callDynamicPrisma`), con la petición de quien actúa. */
export function dynDesdeRequest(req: NextRequest, opts: { shouldVerifyAccessToken?: boolean } = {}): Dyn {
    const verify = opts.shouldVerifyAccessToken ?? true;
    return {
        async find(table, args = {}) {
            const r = await callDynamicPrisma({ req, shouldVerifyAccessToken: verify, data: { action: "GET", table, operation: "findMany", ...args } });
            return Array.isArray(r) ? r : [];
        },
        create: (table, data) => callDynamicPrisma({ req, shouldVerifyAccessToken: verify, data: { action: "POST", table, operation: "create", data } }),
        update: (table, where, data) => callDynamicPrisma({ req, shouldVerifyAccessToken: verify, data: { action: "UPDATE", table, operation: "update", where, data } }),
    };
}
