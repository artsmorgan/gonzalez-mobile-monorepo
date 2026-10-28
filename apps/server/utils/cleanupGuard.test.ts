import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { OWNER_KEY, createQueueLayer, isOwnedSingletonKey, ownerKey, singletonErase, singletonView, singletonWrite, type LayerStorage, type QueueOwner } from "../../mobile/hooks/queueOwnership";
import { LAST_SEEN_KEY, planRetention } from "../../mobile/hooks/queueRetention";
import { collectPreservedFileNames, filterKeysToDelete, isPendingWorkKey } from "../../mobile/hooks/cleanupGuard";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");

const A: QueueOwner = { empleadoId: 1, orgId: "srv" };
const B: QueueOwner = { empleadoId: 2, orgId: "srv" };
const json = (v: unknown) => JSON.stringify(v);
const SIG = "manual_signature_cache";

describe("qué llaves no puede borrar ninguna limpieza de caché", () => {
    it("el trabajo pendiente y los registros que lo gobiernan están protegidos", () => {
        for (const k of ["attendance_actions", "x_actions", SIG, "marca_cache", LAST_SEEN_KEY, "secure_pending_deletes"]) assert.equal(isPendingWorkKey(k), true, k);
    });
    it("las cachés comunes no lo están", () => {
        for (const k of ["visitors_cache", "vehicles_cache", "current_marca", "categories_cache", "lunch_time_config", "temp_state", "actions", "x_actions_old"]) assert.equal(isPendingWorkKey(k), false, k);
    });
    it("el filtro quita de la lista de borrado lo protegido y respeta las excepciones propias de cada limpieza", () => {
        const keys = ["visitors_cache", "a_actions", SIG, LAST_SEEN_KEY, "secure_pending_deletes", "current_marca", "access_token"];
        assert.deepEqual(filterKeysToDelete(keys, ["access_token"]), ["visitors_cache", "current_marca"]);
        assert.deepEqual(filterKeysToDelete([]), []);
    });
});

describe("archivos que una limpieza debe conservar (de TODOS los usuarios)", () => {
    it("recoge los archivos citados por las acciones de cualquier propietario, también los sin propietario, en cualquier nivel y como ruta", () => {
        const jsons = [
            json([{ id: "1", [OWNER_KEY]: A, payload: { localFileName: "a_img.png" } }, { id: "2", [OWNER_KEY]: B, nested: { deep: [{ f: "b_img.png" }] } }]),
            json([{ id: "3", uri: "file:///data/files/legacy.png?x=1" }]),
            null,
            "{ no es json",
            json({ porSucursal: { 1: [{ localFileName: "obj.png" }] } }),
        ];
        const keep = collectPreservedFileNames(jsons);
        for (const n of ["a_img.png", "b_img.png", "legacy.png", "obj.png"]) assert.equal(keep.has(n), true, n);
    });
    it("incluye la firma pendiente (texto plano heredado y entradas con propietario)", () => {
        const keep = collectPreservedFileNames(["firma_vieja.png", json([{ [OWNER_KEY]: A, value: "firma_a.png" }, { [OWNER_KEY]: B, value: "firma_b.png" }])]);
        for (const n of ["firma_vieja.png", "firma_a.png", "firma_b.png"]) assert.equal(keep.has(n), true, n);
    });
    it("anidación exagerada y valores raros no rompen", () => {
        const deepJson = "[" + '{"n":'.repeat(3000) + '"x.png"' + "}".repeat(3000) + "]";
        assert.doesNotThrow(() => collectPreservedFileNames([deepJson, "", "   ", "123", "null"]));
    });
});

function memStorage(initial: Record<string, string> = {}): LayerStorage & { data: Map<string, string> } {
    const data = new Map(Object.entries(initial));
    return {
        data,
        async getItem(k) { return data.has(k) ? data.get(k)! : null; },
        async setItem(k, v) { data.set(k, v); },
        async removeItem(k) { data.delete(k); },
        async multiGet(keys) { return keys.map((k) => [k, data.has(k) ? data.get(k)! : null] as [string, string | null]); },
        async multiSet(pairs) { for (const [k, v] of pairs) data.set(k, v); },
        async multiRemove(keys) { for (const k of keys) data.delete(k); },
        async getAllKeys() { return [...data.keys()]; },
    };
}

describe("la firma manual pendiente es del usuario que la guardó", () => {
    it("solo las llaves declaradas son de propietario", () => {
        assert.equal(isOwnedSingletonKey(SIG), true);
        assert.equal(isOwnedSingletonKey("visitors_cache"), false);
    });
    it("funciones puras: ver, escribir y borrar solo lo propio; lo heredado (texto plano) lo ve cualquiera", () => {
        const raw = singletonWrite(singletonWrite(null, "a.png", A), "b.png", B);
        assert.equal(singletonView(raw, A), "a.png");
        assert.equal(singletonView(raw, B), "b.png");
        assert.equal(singletonView(singletonWrite(raw, "a2.png", A), A), "a2.png");
        assert.equal(singletonView(singletonErase(raw, A), A), null);
        assert.equal(singletonView(singletonErase(raw, A), B), "b.png", "borrar lo propio no toca lo ajeno");
        assert.equal(singletonErase(singletonWrite(null, "a.png", A), A), null);
        assert.equal(singletonView("heredada.png", A), "heredada.png");
        assert.equal(singletonView("heredada.png", B), "heredada.png");
        assert.equal(singletonView(null, A), null);
    });
    it("con la capa: B no ve la firma de A, guarda la suya, y al borrar la suya la de A sigue en disco", async () => {
        const storage = memStorage();
        createQueueLayer(storage, { getOrgId: () => "srv" });
        await storage.setItem("employee_data", json({ id: 1 }));
        await storage.setItem(SIG, "firma_a.png");
        assert.equal(await storage.getItem(SIG), "firma_a.png");
        await storage.setItem("employee_data", json({ id: 2 }));
        assert.equal(await storage.getItem(SIG), null);
        await storage.setItem(SIG, "firma_b.png");
        assert.equal(await storage.getItem(SIG), "firma_b.png");
        await storage.removeItem(SIG);
        assert.equal(await storage.getItem(SIG), null);
        await storage.setItem("employee_data", json({ id: 1 }));
        assert.equal(await storage.getItem(SIG), "firma_a.png", "la firma de A sobrevivió");
    });
    it("una firma guardada antes de esta versión (texto plano) sigue visible", async () => {
        const storage = memStorage({ employee_data: json({ id: 1 }), [SIG]: "vieja.png" });
        createQueueLayer(storage, { getOrgId: () => "srv" });
        assert.equal(await storage.getItem(SIG), "vieja.png");
    });
    it("la caducidad de 2 semanas también se lleva la firma pendiente y su archivo", () => {
        const DAY = 24 * 60 * 60 * 1000, NOW = 1_800_000_000_000;
        const raw = singletonWrite(null, "firma_a.png", A);
        const plan = planRetention({ queues: [{ key: SIG, json: raw }], lastSeen: { [ownerKey(A)]: NOW - 20 * DAY }, now: NOW, currentOwner: B, existingFiles: new Set(["firma_a.png"]) });
        assert.deepEqual(plan.queueWrites, [{ key: SIG, json: null }]);
        assert.deepEqual(plan.filesToDelete, ["firma_a.png"]);
    });
});

describe("cableado: las limpiezas respetan el trabajo pendiente de los usuarios desconectados", () => {
    it("el barrido del inicio de sesión de otro empleado conserva colas, firma pendiente y registros", () => {
        assert.match(leer("contexts/AuthContext.tsx"), /isPendingWorkKey\(key\)\) return false/);
    });
    it("la limpieza al ingresar (cleanAsyncStorage) usa la misma regla en vez de solo «termina en _actions»", () => {
        const src = leer("screens/MarcarIngresoSalidaScreen.tsx");
        assert.match(src, /isPendingWorkKey\(key\)\) return false/);
        assert.equal(/key\.endsWith\('_actions'\)\) return false/.test(src), false);
    });
    it("los archivos a conservar salen de las colas de TODOS los usuarios (acceso sin filtrar), no de la lista fija ni de la vista del usuario", () => {
        const src = leer("hooks/collectPendingSyncLocalFileNames.ts");
        assert.match(src, /queueRaw\./);
        assert.match(src, /collectPreservedFileNames\(/);
        assert.equal(/getPendingSyncActions/.test(src), false);
    });
    it("deleteAllFiles siempre suma los archivos pendientes, aunque quien lo llame no los indique", () => {
        const src = leer("hooks/fileStorage.ts");
        const body = src.slice(src.indexOf("export async function deleteAllFiles"));
        assert.match(body, /collectPendingSyncLocalFileNames\(/);
    });
    it("la caducidad también revisa las llaves con propietario que no son colas", () => {
        assert.match(leer("hooks/queueRetention.ts"), /isOwnedSingletonKey\(/);
    });
});
