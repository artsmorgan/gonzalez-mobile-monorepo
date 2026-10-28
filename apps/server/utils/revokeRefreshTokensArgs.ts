/**
 * Argumentos del script `scripts/revokeRefreshTokens.ts` (issue #169): al desplegar la corrección se asume que los refresh tokens pudieron quedar
 * expuestos y se revocan todos. Es una acción con efecto sobre todos los guardas (tendrán que iniciar sesión de nuevo), así que **por defecto no
 * revoca nada**: solo cuenta. Hay que pasar `--confirm` de forma explícita, en el momento acordado con el cliente.
 */
export type RevokeArgs = { confirm: boolean; before: Date | null };

export function parseRevokeArgs(argv: readonly string[]): RevokeArgs {
    let confirm = false;
    let before: Date | null = null;
    for (const arg of argv) {
        if (arg === "--confirm") confirm = true;
        else if (arg === "--dry-run") confirm = false;
        else if (arg.startsWith("--before=")) {
            const d = new Date(arg.slice("--before=".length));
            if (Number.isNaN(d.getTime())) throw new Error(`fecha inválida en ${arg} (use ISO 8601, p. ej. 2026-10-27T12:00:00Z)`);
            before = d;
        } else {
            throw new Error(`argumento desconocido: ${arg}`);
        }
    }
    return { confirm, before };
}
