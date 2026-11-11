/**
 * Filas del reporte «Ingresos de usuario» (`refresh_token`) sin datos de credencial (issue #169).
 *
 * `refresh_token.token` guarda el SHA-256 del refresh token (columna de 64 caracteres), no el token. Aun así ninguna respuesta de `/api/reportes`
 * debe devolver ese valor ni un campo llamado `token` o `refresh*`: se entrega solo una referencia corta (los últimos 6 caracteres), que
 * distingue sesiones en el reporte y no sirve para nada más.
 */
const TOKEN_REF_LENGTH = 6;

export function tokenRef(stored: unknown): string {
    const s = String(stored ?? "").trim();
    return s ? `…${s.slice(-TOKEN_REF_LENGTH)}` : "";
}

type RefreshTokenRow = {
    id: number;
    token?: unknown;
    createdAt: unknown;
    expiresAt: unknown;
    sessionId: unknown;
    revoked: unknown;
    empleadoId: unknown;
    device: unknown;
    c_empleado?: { id: unknown; nombre: unknown; primer_apellido: unknown; segundo_apellido: unknown; codigo: unknown } | null;
};

/** Fila segura para la vista previa: metadatos de la sesión y su referencia corta; nunca el token ni su hash. */
export function slimRefreshTokenRow(r: RefreshTokenRow) {
    return {
        id: r.id,
        tokenRef: tokenRef(r.token),
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        sessionId: r.sessionId,
        revoked: r.revoked,
        empleadoId: r.empleadoId,
        device: r.device,
        c_empleado: r.c_empleado
            ? {
                  id: r.c_empleado.id,
                  nombre: r.c_empleado.nombre,
                  primer_apellido: r.c_empleado.primer_apellido,
                  segundo_apellido: r.c_empleado.segundo_apellido,
                  codigo: r.c_empleado.codigo,
              }
            : null,
    };
}

/** Recorre una respuesta y devuelve las rutas de las propiedades con nombre de credencial (`token`, `refresh*`, `password`, `secret`). */
export function findCredentialKeys(value: unknown, path = "$", depth = 0): string[] {
    if (depth > 12 || value === null || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap((v, i) => findCredentialKeys(v, `${path}[${i}]`, depth + 1));
    const hits: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (/^(token|refresh.*|.*password.*|.*secret.*|authorization)$/i.test(k)) hits.push(`${path}.${k}`);
        hits.push(...findCredentialKeys(v, `${path}.${k}`, depth + 1));
    }
    return hits;
}
