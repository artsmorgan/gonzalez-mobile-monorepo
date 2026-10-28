/**
 * Revoca los refresh tokens vigentes (issue #169, «rotación al desplegar»).
 *
 *   npx tsx scripts/revokeRefreshTokens.ts                          → solo CUENTA lo que revocaría (no cambia nada)
 *   npx tsx scripts/revokeRefreshTokens.ts --confirm                → revoca todos los vigentes
 *   npx tsx scripts/revokeRefreshTokens.ts --confirm --before=<ISO> → revoca solo los creados antes de esa fecha
 *
 * Efecto: cada guarda deberá iniciar sesión de nuevo cuando venza su token de acceso (hasta 1 día). Coordinar el momento con el cliente y avisar a
 * soporte ANTES de ejecutarlo con `--confirm`. Usa la conexión de `DATABASE_URL`: ejecutarlo contra el ambiente correcto.
 */
import { prisma } from "../utils/prismaClient";
import { parseRevokeArgs } from "../utils/revokeRefreshTokensArgs";

async function main() {
    const args = parseRevokeArgs(process.argv.slice(2));
    const where = { revoked: false, ...(args.before ? { createdAt: { lt: args.before } } : {}) };
    const total = await prisma.refresh_token.count({ where });
    console.log(`Refresh tokens vigentes${args.before ? ` creados antes de ${args.before.toISOString()}` : ""}: ${total}`);
    if (!args.confirm) {
        console.log("Simulacro: no se revocó nada. Use --confirm para revocar.");
        return;
    }
    const result = await prisma.refresh_token.updateMany({ where, data: { revoked: true } });
    console.log(`Revocados: ${result.count}`);
}

main()
    .catch((e) => {
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
