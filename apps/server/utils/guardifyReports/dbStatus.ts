import { verifyGuardifyApiKey } from "./auth";

/**
 * Estado de la base de datos frente al esquema de la app (solo lectura): qué migraciones registra `_prisma_migrations` y qué tablas y
 * columnas del esquema Prisma no existen todavía en la base. No lee datos de negocio. Sirve para saber, antes de migrar, qué falta.
 */
export type ModelInfo = { name: string; dbName: string | null; fields: { name: string; dbName: string | null; kind: string; isRequired: boolean; hasDefaultValue: boolean; type: string }[] };
export type DbColumn = { table: string; column: string };

export function schemaDrift(models: ModelInfo[], existing: DbColumn[]) {
    const byTable = new Map<string, Set<string>>();
    for (const c of existing) (byTable.get(c.table.toLowerCase()) ?? byTable.set(c.table.toLowerCase(), new Set()).get(c.table.toLowerCase())!).add(c.column.toLowerCase());
    const missingTables: string[] = [];
    const missingColumns: { table: string; column: string; type: string; required: boolean; hasDefault: boolean }[] = [];
    for (const m of models) {
        const table = (m.dbName ?? m.name).toLowerCase();
        const cols = byTable.get(table);
        if (!cols) { missingTables.push(m.dbName ?? m.name); continue; }
        for (const f of m.fields) {
            if (f.kind !== "scalar" && f.kind !== "enum") continue; // las relaciones no son columnas
            const col = (f.dbName ?? f.name).toLowerCase();
            if (!cols.has(col)) missingColumns.push({ table: m.dbName ?? m.name, column: f.dbName ?? f.name, type: f.type, required: f.isRequired, hasDefault: f.hasDefaultValue });
        }
    }
    return { missingTables, missingColumns };
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function handleDbStatus(req: Request, deps: { prisma: any; models: ModelInfo[]; env?: Record<string, string | undefined> }): Promise<Response> {
    const auth = verifyGuardifyApiKey(req.headers, deps.env);
    if (!auth.ok) return json({ error: auth.error, message: auth.message }, auth.status);
    try {
        const p = deps.prisma;
        const [{ db }] = (await p.$queryRawUnsafe("SELECT DATABASE() AS db")) as { db: string }[];
        const cols = ((await p.$queryRawUnsafe("SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()")) as { t: string; c: string }[]).map((r) => ({ table: r.t, column: r.c }));
        let migrations: { name: string; finished: boolean; rolledBack: boolean; at: string | null }[] | null = null;
        try {
            const rows = (await p.$queryRawUnsafe("SELECT migration_name AS n, finished_at AS f, rolled_back_at AS r, started_at AS s FROM _prisma_migrations ORDER BY started_at")) as { n: string; f: Date | null; r: Date | null; s: Date | null }[];
            migrations = rows.map((r) => ({ name: r.n, finished: !!r.f, rolledBack: !!r.r, at: r.s ? new Date(r.s).toISOString() : null }));
        } catch { /* la base no tiene tabla de migraciones */ }
        const drift = schemaDrift(deps.models, cols);
        return json({ database: db, tables: new Set(cols.map((c) => c.table)).size, migrationsTable: migrations !== null, migrations, ...drift });
    } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "guardify_db_status_failed", error: String(e).slice(0, 300) }));
        return json({ error: "internal", message: "No se pudo leer el estado de la base.", detail: String(e).slice(0, 300) }, 500);
    }
}
