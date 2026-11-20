import { toZonedTime } from "date-fns-tz";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require("jsonwebtoken");

/** Columnas de auditoría y trazabilidad que comparten las tablas de la app. */
export type AuditColumn = "created_at" | "created_by" | "updated_at" | "updated_by";

const nowCostaRica = (): string => (toZonedTime(new Date(), "America/Costa_Rica") as Date).toISOString();

/** Id de `c_empleado` del usuario autenticado, o `null` si el token no trae un id válido. */
function userId(payload: { id?: unknown } | null | undefined): number | null {
    const id = Number(payload?.id);
    return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

function pick(values: Record<AuditColumn, string | number | null>, columns: readonly AuditColumn[]): Partial<Record<AuditColumn, string | number | null>> {
    const out: Partial<Record<AuditColumn, string | number | null>> = {};
    for (const c of columns) out[c] = values[c];
    return out;
}

/**
 * Usuario de una petición que la ruta YA autenticó (decodifica el JWT sin volver a verificarlo). Para utilidades que reciben
 * solo `req` y escriben en tablas con auditoría; nunca usarlo como autenticación.
 */
export function actorFromRequest(req: { headers: { get(name: string): string | null }; nextUrl?: { searchParams: URLSearchParams } }): { id?: unknown } | null {
    try {
        const header = req.headers.get("authorization") || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : (req.nextUrl?.searchParams.get("token") ?? "");
        const decoded = token ? jwt.decode(token) : null;
        return decoded && typeof decoded === "object" ? (decoded as { id?: unknown }) : null;
    } catch {
        return null;
    }
}

/**
 * Columnas de auditoría de ALTA (`created_at` / `created_by`) para incluir en el `data` de una petición `POST` a
 * `callDynamicPrisma`. `columns` limita cuáles se escriben (las que la tabla aún no tiene o no se llenan por otro lado).
 * Misma convención de hora que el resto de la app (Costa Rica, leído con getters UTC).
 */
export function auditCreateFields(
    payload: { id?: unknown } | null | undefined,
    columns: readonly AuditColumn[] = ["created_at", "created_by"],
): Partial<Record<AuditColumn, string | number | null>> {
    const now = nowCostaRica();
    return pick({ created_at: now, created_by: userId(payload), updated_at: null, updated_by: null }, columns.filter((c) => c.startsWith("created_")));
}

/**
 * Columnas de auditoría de MODIFICACIÓN (`updated_at` / `updated_by`) para incluir en el `data` de una petición `UPDATE`
 * a `callDynamicPrisma`. `columns` limita cuáles se escriben (p. ej. solo `updated_by` si la tabla ya llena `updated_at`).
 */
export function auditUpdateFields(
    payload: { id?: unknown } | null | undefined,
    columns: readonly AuditColumn[] = ["updated_at", "updated_by"],
): Partial<Record<AuditColumn, string | number | null>> {
    const now = nowCostaRica();
    return pick({ created_at: null, created_by: null, updated_at: now, updated_by: userId(payload) }, columns.filter((c) => c.startsWith("updated_")));
}
