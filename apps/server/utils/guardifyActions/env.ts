/**
 * Entorno de las acciones que Guardify pide a la app (rechazar un permiso o un mutuo acuerdo). La lógica de negocio vive en funciones que
 * reciben este entorno, para que las rutas de la propia app (con el JWT del empleado) y la API de acciones de Guardify (con la identidad del
 * actor ya verificada) ejecuten EXACTAMENTE el mismo código, y para poder probarla sin base de datos.
 */
export type ActionErrorCode = "planillas_session_required" | "not_found" | "already_resolved" | "invalid_state" | "conflict" | "out_of_scope" | "reason_required" | "signature_required" | "invalid_request";

export type ActionEnv = {
    /** Consulta/escritura por la API dinámica (`callDynamicPrisma`) ya atada a la petición. */
    call: (data: Record<string, any>) => Promise<any>;
    /** Cliente Prisma de lectura directa (`utils/prismaClient`). */
    prisma: any;
    /** `sendNotificationByEmployee`: título, mensaje, destinatarios y quienes la originan. */
    notify: (title: string, message: string, recipients: number[], originators: number[]) => Promise<unknown>;
    /** `reportError` de la ruta que corresponda. */
    report: (status: number, message: string) => Promise<void>;
    /** Hora de la acción en ISO con la convención de la app (Costa Rica); si el cliente mandó una, esa. */
    nowIso: (horaAccion: Date | null) => string;
    /** `POST {PLANILLAS_URL}{path}` con el token de Planillas de la persona; devuelve el cuerpo de la respuesta. Lanza si Planillas responde con error HTTP. */
    planillas: (path: string, body: Record<string, unknown>, token: string) => Promise<{ success?: boolean; data?: any }>;
    /** Último token de Planillas que la persona dejó guardado al entrar en la app (`a_mobile_token_for_planillas`), o `null` si no hay o venció. */
    tokenPlanillas: (empleadoId: number) => Promise<string | null>;
};

export type ActionHttp =
    | { ok: true; status: 200; body: Record<string, any> }
    | { ok: false; status: number; code: ActionErrorCode; message: string };

export const fail = (status: number, code: ActionErrorCode, message: string): ActionHttp => ({ ok: false, status, code, message });

export const parseDateInput = (input: unknown): Date | null => {
    if (!input) return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
    const s = String(input).trim();
    if (!s) return null;
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export const nombreCompleto = (e: { nombre?: string | null; primer_apellido?: string | null; segundo_apellido?: string | null } | null | undefined, fallback: string): string =>
    e ? `${e.nombre ?? ""} ${e.primer_apellido ?? ""} ${e.segundo_apellido ?? ""}`.trim() : fallback;
