import type { ActionEnv } from "./env";
import { PlanillasError } from "./env";
import { tokenPlanillasVigente } from "./planillas";

/**
 * Arma el entorno de las acciones con las piezas reales INYECTADAS (así se prueba el comportamiento de verdad sin base de datos ni red).
 *  - `verifyUser: true`  → petición de un empleado con su JWT (rutas de la app): todo se comporta como siempre.
 *  - `verifyUser: false` → API de acciones de Guardify: ya se verificó la llave y la identidad del actor. La petición se marca como interna para que
 *    TODAS las llamadas por debajo (escritura, notificaciones, push, registro de errores) vayan con el token móvil del servidor y sin JWT de usuario.
 * `report` nunca lanza: un fallo al registrar un error no puede tumbar ni cambiar la respuesta de la acción.
 */
export type EnvDeps = {
    callDynamicPrisma: (p: { req: any; data: Record<string, any>; shouldVerifyAccessToken?: boolean }) => Promise<any>;
    markInternalRequest: (req: object) => void;
    reportError: (req: any, route: string, method: string, status: number, message: string) => Promise<unknown>;
    sendNotificationByEmployee: (req: any, corpoId: number, originators: number[], title: string, message: string, recipients: number[]) => Promise<unknown>;
    prisma: any;
    /** `POST {PLANILLAS_URL}{path}`; devuelve el cuerpo. Lanza con `response.status` si Planillas responde con error. */
    planillasPost: (path: string, body: Record<string, unknown>, token: string) => Promise<any>;
    /** Hora «de pared» de Costa Rica (la convención de la app). */
    ahoraPared: () => Date;
};

export function makeActionEnv(deps: EnvDeps, req: object, route: string, method: string, opts: { verifyUser: boolean }): ActionEnv {
    if (!opts.verifyUser) deps.markInternalRequest(req);
    const call: ActionEnv["call"] = (data) => deps.callDynamicPrisma({ req, data, shouldVerifyAccessToken: opts.verifyUser });
    return {
        call,
        prisma: deps.prisma,
        notify: (title, message, recipients, originators) => deps.sendNotificationByEmployee(req, 0, originators, title, message, recipients),
        report: async (status, message) => {
            try {
                await deps.reportError(req, route, method, status, message);
            } catch (e) {
                console.error("[guardifyActions] no se pudo registrar el error:", e instanceof Error ? e.message : e);
            }
        },
        nowIso: (hora) => (hora ? hora.toISOString() : deps.ahoraPared().toISOString()),
        planillas: async (path, body, token) => {
            try {
                return await deps.planillasPost(path, body, token);
            } catch (e: any) {
                throw new PlanillasError(Number(e?.response?.status ?? 0), e instanceof Error ? e.message : "Planillas no respondió");
            }
        },
        tokenPlanillas: async (empleadoId) => {
            // Siempre por el servidor (sin JWT de usuario): es el token que la persona dejó guardado al entrar en la app. El más reciente si hubiera duplicados.
            const row = await deps.callDynamicPrisma({ req, shouldVerifyAccessToken: false, data: { action: "GET", table: "a_mobile_token_for_planillas", operation: "findFirst", where: { empleado_id: empleadoId }, orderBy: { id: "desc" } } });
            return tokenPlanillasVigente(row, deps.ahoraPared().getTime());
        },
    };
}
