import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleDbStatus, schemaDrift, type ModelInfo } from "./dbStatus";

const f = (name: string, kind = "scalar", dbName: string | null = null) => ({ name, dbName, kind, isRequired: false, hasDefaultValue: false, type: "String" });
const models: ModelInfo[] = [
    { name: "c_empleado", dbName: null, fields: [f("id"), f("nombre"), f("firma_manual"), f("relacion", "object")] },
    { name: "tabla_nueva", dbName: "tabla_nueva", fields: [f("id")] },
    { name: "Otro", dbName: "otra_tabla", fields: [f("id"), f("campo", "scalar", "campo_db")] },
];

describe("estado de la base frente al esquema", () => {
    it("lista tablas y columnas que faltan (sin mirar mayúsculas ni relaciones)", () => {
        const r = schemaDrift(models, [{ table: "C_EMPLEADO", column: "id" }, { table: "c_empleado", column: "Nombre" }, { table: "otra_tabla", column: "id" }, { table: "otra_tabla", column: "campo_db" }]);
        assert.deepEqual(r.missingTables, ["tabla_nueva"]);
        assert.deepEqual(r.missingColumns.map((c) => `${c.table}.${c.column}`), ["c_empleado.firma_manual"]);
    });
    it("pide la llave y responde el estado con las migraciones registradas", async () => {
        const KEY = "k".repeat(32);
        const prisma = {
            $queryRawUnsafe: async (sql: string) => sql.includes("DATABASE() AS db") ? [{ db: "planillas" }] : sql.includes("information_schema") ? [{ t: "c_empleado", c: "id" }] : [{ n: "0_init", f: new Date("2026-01-01"), r: null, s: new Date("2026-01-01") }],
        };
        const mk = (headers: Record<string, string>) => handleDbStatus(new Request("http://x", { headers }), { prisma, models, env: { GUARDIFY_REPORTS_API_KEY: KEY } });
        assert.equal((await mk({})).status, 401);
        const ok = await mk({ authorization: `Bearer ${KEY}` });
        assert.equal(ok.status, 200);
        const b = await ok.json();
        assert.equal(b.database, "planillas");
        assert.deepEqual(b.migrations, [{ name: "0_init", finished: true, rolledBack: false, at: "2026-01-01T00:00:00.000Z" }]);
        assert.ok(b.missingTables.includes("tabla_nueva"));
    });
});
