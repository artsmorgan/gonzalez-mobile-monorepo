import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { OWNER_KEY, createQueueLayer, ownerKey, type LayerStorage, type QueueOwner } from "../../mobile/hooks/queueOwnership";
import {
    LAST_SEEN_KEY,
    QUEUE_OWNER_MAX_IDLE_MS,
    parseLastSeen,
    planRetention,
    removeOwnersFromQueueJson,
    runRetention,
    type RetentionFiles,
} from "../../mobile/hooks/queueRetention";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const A: QueueOwner = { empleadoId: 1, orgId: "srv" };
const B: QueueOwner = { empleadoId: 2, orgId: "srv" };
const C: QueueOwner = { empleadoId: 3, orgId: "srv" };
const kA = ownerKey(A), kB = ownerKey(B), kC = ownerKey(C);

/** Acción estructural: solo un id y los campos que hagan falta (sin datos de negocio). */
const act = (id: string, owner: QueueOwner | null, extra: Record<string, unknown> = {}) => ({ id, ...extra, ...(owner ? { [OWNER_KEY]: owner } : {}) });
const json = (v: unknown) => JSON.stringify(v);
const ids = (j: string | null | undefined) => (j ? (JSON.parse(j) as Array<{ id: string }>).map((x) => x.id) : []);

describe("caducidad de las colas de un usuario que no se conecta (2 semanas)", () => {
    it("el plazo es de 14 días", () => {
        assert.equal(QUEUE_OWNER_MAX_IDLE_MS, 14 * DAY);
    });
    it("la clave de propietario distingue empleado y organización", () => {
        assert.notEqual(ownerKey(A), ownerKey({ ...A, orgId: "otro" }));
        assert.notEqual(ownerKey(A), ownerKey(B));
    });
    it("lee el registro de última conexión aunque esté dañado", () => {
        assert.deepEqual(parseLastSeen(json({ [kA]: 5, malo: "x", otro: Number.NaN, neg: -3 })), { [kA]: 5 });
        for (const raw of [null, "", "{", "[]", "null", "12", json("x")]) assert.deepEqual(parseLastSeen(raw), {}, String(raw));
    });

    it("quien lleva más de 14 días sin conectarse pierde sus acciones; las de los demás y las sin propietario quedan", () => {
        const plan = planRetention({
            queues: [
                { key: "a_actions", json: json([act("a1", A), act("b1", B), act("leg", null)]) },
                { key: "b_actions", json: json([act("a2", A), act("c1", C)]) },
            ],
            lastSeen: { [kA]: NOW - 15 * DAY, [kC]: NOW - 3 * DAY },
            now: NOW, currentOwner: B, existingFiles: new Set(),
        });
        assert.deepEqual(plan.purgedOwners, [kA]);
        assert.equal(plan.purgedActions, 2);
        const w = Object.fromEntries(plan.queueWrites.map((q) => [q.key, q.json]));
        assert.deepEqual(ids(w["a_actions"]), ["b1", "leg"]);
        assert.deepEqual(ids(w["b_actions"]), ["c1"]);
    });
    it("varias conexiones de otros usuarios en el medio no adelantan ni atrasan el plazo del primero", () => {
        // C y B se conectaron hace poco; A hace 20 días: solo A caduca.
        const plan = planRetention({
            queues: [{ key: "q_actions", json: json([act("a", A), act("b", B), act("c", C)]) }],
            lastSeen: { [kA]: NOW - 20 * DAY, [kB]: NOW - 1 * DAY, [kC]: NOW - 2 * DAY },
            now: NOW, currentOwner: C, existingFiles: new Set(),
        });
        assert.deepEqual(plan.purgedOwners, [kA]);
        assert.deepEqual(ids(plan.queueWrites[0]!.json), ["b", "c"]);
    });
    it("el límite es estricto: a los 14 días exactos todavía no; un milisegundo después sí", () => {
        const q = [{ key: "q_actions", json: json([act("a", A)]) }];
        const base = { queues: q, now: NOW, currentOwner: B, existingFiles: new Set<string>() };
        assert.deepEqual(planRetention({ ...base, lastSeen: { [kA]: NOW - 14 * DAY } }).purgedOwners, []);
        assert.deepEqual(planRetention({ ...base, lastSeen: { [kA]: NOW - 14 * DAY - 1 } }).purgedOwners, [kA]);
    });
    it("el usuario con la sesión activa nunca caduca y su última conexión se actualiza", () => {
        const plan = planRetention({ queues: [{ key: "q_actions", json: json([act("b", B)]) }], lastSeen: { [kB]: NOW - 99 * DAY }, now: NOW, currentOwner: B, existingFiles: new Set() });
        assert.deepEqual(plan.purgedOwners, []);
        assert.equal(plan.lastSeen[kB], NOW);
        assert.deepEqual(plan.queueWrites, []);
    });
    it("un propietario con acciones y sin registro empieza a contar desde ahora (no se borra de golpe)", () => {
        const plan = planRetention({ queues: [{ key: "q_actions", json: json([act("a", A)]) }], lastSeen: {}, now: NOW, currentOwner: B, existingFiles: new Set() });
        assert.deepEqual(plan.purgedOwners, []);
        assert.equal(plan.lastSeen[kA], NOW);
    });
    it("una conexión «en el futuro» (reloj corregido) no hace caducar a nadie y se acota a ahora", () => {
        const plan = planRetention({ queues: [{ key: "q_actions", json: json([act("a", A)]) }], lastSeen: { [kA]: NOW + 30 * DAY }, now: NOW, currentOwner: B, existingFiles: new Set() });
        assert.deepEqual(plan.purgedOwners, []);
        assert.equal(plan.lastSeen[kA], NOW);
    });
    it("se olvida el registro de quien ya no tiene acciones pendientes", () => {
        const plan = planRetention({ queues: [{ key: "q_actions", json: json([act("b", B)]) }], lastSeen: { [kA]: NOW - 1 * DAY, [kB]: NOW }, now: NOW, currentOwner: B, existingFiles: new Set() });
        assert.deepEqual(Object.keys(plan.lastSeen), [kB]);
    });
    it("colas ilegibles o que no son arreglos de objetos no se tocan ni rompen el plan", () => {
        const plan = planRetention({
            queues: [{ key: "x_actions", json: "{" }, { key: "y_actions", json: json({ porSucursal: {} }) }, { key: "z_actions", json: null }, { key: "w_actions", json: json([1, "a", null]) }],
            lastSeen: {}, now: NOW, currentOwner: B, existingFiles: new Set(),
        });
        assert.deepEqual(plan.queueWrites, []);
    });

    describe("archivos de expo-files vinculados", () => {
        const archivos = new Set(["img_1.png", "firma_2.png", "compartido.png", "profile_photo_9.jpg", "main_structure_cache.json", "otro_ajeno.png", "x.png"]);
        const protegido = (n: string) => n.startsWith("profile_photo_") || n === "main_structure_cache.json";
        it("se borran los archivos que citan las acciones borradas (por nombre, ruta o en cualquier nivel)", () => {
            const plan = planRetention({
                queues: [
                    { key: "q_actions", json: json([act("a1", A, { payload: { localFileName: "img_1.png" }, firma: "firma_2.png" }), act("a2", A, { uri: "file:///data/user/0/app/files/x.png?v=1", n: 3 }), act("b1", B, { payload: { localFileName: "otro_ajeno.png" } })]) },
                ],
                lastSeen: { [kA]: NOW - 20 * DAY }, now: NOW, currentOwner: B, existingFiles: archivos, isProtectedFile: protegido,
            });
            assert.deepEqual([...plan.filesToDelete].sort(), ["firma_2.png", "img_1.png", "x.png"]);
        });
        it("no se borra un archivo que otra acción (de otro usuario, en cualquier cola) sigue usando", () => {
            const plan = planRetention({
                queues: [
                    { key: "q_actions", json: json([act("a1", A, { f: "compartido.png", g: "img_1.png" })]) },
                    { key: "r_actions", json: json([act("b1", B, { ref: "compartido.png" })]) },
                ],
                lastSeen: { [kA]: NOW - 20 * DAY }, now: NOW, currentOwner: B, existingFiles: archivos, isProtectedFile: protegido,
            });
            assert.deepEqual(plan.filesToDelete, ["img_1.png"]);
        });
        it("nunca se borra la foto de perfil ni la caché de la jerarquía, aunque una acción las nombre", () => {
            const plan = planRetention({
                queues: [{ key: "q_actions", json: json([act("a1", A, { a: "profile_photo_9.jpg", b: "main_structure_cache.json" })]) }],
                lastSeen: { [kA]: NOW - 20 * DAY }, now: NOW, currentOwner: B, existingFiles: archivos, isProtectedFile: protegido,
            });
            assert.deepEqual(plan.filesToDelete, []);
        });
        it("los textos que no son archivos existentes se ignoran; un archivo que no existe no se pide borrar", () => {
            const plan = planRetention({
                queues: [{ key: "q_actions", json: json([act("a1", A, { t: "un texto cualquiera", n: "no_existe.png", ok: "img_1.png" })]) }],
                lastSeen: { [kA]: NOW - 20 * DAY }, now: NOW, currentOwner: B, existingFiles: archivos, isProtectedFile: protegido,
            });
            assert.deepEqual(plan.filesToDelete, ["img_1.png"]);
        });
        it("anidación exagerada no desborda la pila", () => {
            let deep: Record<string, unknown> = { f: "img_1.png" };
            for (let i = 0; i < 5000; i++) deep = { n: deep };
            assert.doesNotThrow(() => planRetention({ queues: [{ key: "q_actions", json: json([act("a1", A, { deep: 1 })]) }], lastSeen: { [kA]: NOW - 20 * DAY }, now: NOW, currentOwner: B, existingFiles: archivos }));
            assert.doesNotThrow(() => removeOwnersFromQueueJson(JSON.stringify([{ id: "x", [OWNER_KEY]: A, deep: 1 }]), new Set([kA])));
        });
    });
});

/** AsyncStorage y archivos en memoria con bitácora de operaciones. */
function entorno(initial: Record<string, string>, files: string[]) {
    const data = new Map(Object.entries(initial));
    const log: string[] = [];
    const store = {
        async getAllKeys() { return [...data.keys()]; },
        async getItem(k: string) { return data.has(k) ? data.get(k)! : null; },
        async setItem(k: string, v: string) { log.push(`set ${k}`); data.set(k, v); },
        async removeItem(k: string) { log.push(`remove ${k}`); data.delete(k); },
    };
    const present = new Set(files);
    const filesApi: RetentionFiles & { present: Set<string>; failOn?: string } = {
        present,
        async list() { return [...present]; },
        async remove(name: string) { if (filesApi.failOn === name) throw new Error("no se pudo borrar"); log.push(`file ${name}`); present.delete(name); },
    };
    return { data, log, store, files: filesApi };
}

describe("ejecución de la caducidad (issue: colas por usuario)", () => {
    const inicial = () => ({
        a_actions: json([act("a1", A, { f: "img_1.png" }), act("b1", B)]),
        [LAST_SEEN_KEY]: json({ [kA]: NOW - 20 * DAY, [kB]: NOW - DAY }),
    });
    it("reescribe las colas, borra los archivos DESPUÉS y guarda el registro actualizado", async () => {
        const e = entorno(inicial(), ["img_1.png", "otro.png"]);
        const plan = await runRetention({ store: e.store, files: e.files, now: NOW, currentOwner: B });
        assert.deepEqual(plan.purgedOwners, [kA]);
        assert.deepEqual(ids(e.data.get("a_actions")), ["b1"]);
        assert.equal(e.files.present.has("img_1.png"), false);
        assert.equal(e.files.present.has("otro.png"), true, "lo que ninguna acción citaba no se toca");
        assert.ok(e.log.indexOf("set a_actions") < e.log.indexOf("file img_1.png"), "primero la cola, luego el archivo");
        assert.deepEqual(Object.keys(JSON.parse(e.data.get(LAST_SEEN_KEY)!)), [kB]);
    });
    it("una cola que queda vacía se elimina", async () => {
        const e = entorno({ a_actions: json([act("a1", A)]), [LAST_SEEN_KEY]: json({ [kA]: NOW - 20 * DAY }) }, []);
        await runRetention({ store: e.store, files: e.files, now: NOW, currentOwner: B });
        assert.equal(e.data.has("a_actions"), false);
    });
    it("es idempotente: una segunda ejecución no cambia nada", async () => {
        const e = entorno(inicial(), ["img_1.png"]);
        await runRetention({ store: e.store, files: e.files, now: NOW, currentOwner: B });
        const antes = JSON.stringify([...e.data.entries()]);
        const plan = await runRetention({ store: e.store, files: e.files, now: NOW, currentOwner: B });
        assert.equal(plan.purgedActions, 0);
        assert.equal(JSON.stringify([...e.data.entries()]), antes);
    });
    it("si no se puede borrar un archivo, los demás se borran igual y las acciones ya no están", async () => {
        const e = entorno({ a_actions: json([act("a1", A, { x: "img_1.png", y: "firma_2.png" })]), [LAST_SEEN_KEY]: json({ [kA]: NOW - 20 * DAY }) }, ["img_1.png", "firma_2.png"]);
        e.files.failOn = "img_1.png";
        await assert.doesNotReject(() => runRetention({ store: e.store, files: e.files, now: NOW, currentOwner: B }));
        assert.equal(e.data.has("a_actions"), false);
        assert.equal(e.files.present.has("firma_2.png"), false);
    });
    it("sin sesión activa (nadie conectado) no se borra nada", async () => {
        const e = entorno(inicial(), ["img_1.png"]);
        const plan = await runRetention({ store: e.store, files: e.files, now: NOW, currentOwner: null });
        assert.equal(plan.purgedActions, 0);
        assert.deepEqual(ids(e.data.get("a_actions")), ["a1", "b1"]);
    });
    it("con la capa de propietarios: borra lo de A en disco y el usuario B sigue viendo lo suyo", async () => {
        const data = new Map<string, string>();
        const storage: LayerStorage = {
            async getItem(k) { return data.has(k) ? data.get(k)! : null; },
            async setItem(k, v) { data.set(k, v); },
            async removeItem(k) { data.delete(k); },
            async multiGet(keys) { return keys.map((k) => [k, data.has(k) ? data.get(k)! : null] as [string, string | null]); },
            async multiSet(pairs) { for (const [k, v] of pairs) data.set(k, v); },
            async multiRemove(keys) { for (const k of keys) data.delete(k); },
            async getAllKeys() { return [...data.keys()]; },
        };
        const layer = createQueueLayer(storage, { getOrgId: () => "srv" });
        await storage.setItem("employee_data", json({ id: 1 }));
        await storage.setItem("q_actions", json([{ id: "a1" }]));
        await storage.setItem("employee_data", json({ id: 2 }));
        await storage.setItem("q_actions", json([{ id: "b1" }]));
        data.set(LAST_SEEN_KEY, json({ [kA]: NOW - 20 * DAY }));
        const files = entorno({}, []).files;
        const plan = await runRetention({ store: layer.raw, files, now: NOW, currentOwner: B, mutateQueue: layer.mutateQueue });
        assert.equal(plan.purgedActions, 1);
        assert.deepEqual(ids(await storage.getItem("q_actions")), ["b1"]);
        assert.deepEqual(ids(data.get("q_actions")), ["b1"]);
    });
});

describe("cableado (caducidad de colas)", () => {
    it("la app registra la conexión y aplica la caducidad en cada sincronización con conexión", () => {
        const app = leer("App.tsx");
        const start = app.indexOf("const syncPendingActionsIfOnline");
        const call = app.indexOf("await runQueueRetention()", start);
        assert.ok(call > start, "debe llamarse dentro de la sincronización");
        assert.ok(call > app.indexOf("if (!connectivity.ok)", start), "solo con conexión");
        assert.ok(call > app.indexOf("Esperando employee en memoria", start), "solo con una sesión activa");
    });
    it("el instalador ejecuta la caducidad con el acceso sin filtrar y los archivos de la app", () => {
        const inst = leer("hooks/installQueueOwnership.ts");
        assert.match(inst, /runRetention\(/);
        assert.match(inst, /mutateQueue/);
        assert.match(inst, /Paths\.document/);
        assert.match(inst, /isEmployeeProfilePhotoFileName/);
    });
});
