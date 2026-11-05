import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { claveValida, conCandadoDistribuido, ejecutarIdempotente, guardStore, hashClave, IDEM_EN_CURSO_MAX_MS, IDEM_RETENCION_MS, IdemStoreError, memoryIdempotencyStore, type IdempotencyStore, type IdemRun } from "./idempotency";
import { conIdempotencia, readIdempotencyKey } from "./idempotencyHttp";
import { dynamicIdempotencyStore } from "./idempotencyDynamicStore";
import { stripComments } from "./routeAudit";
import { actionIdempotencyKey } from "../../mobile/hooks/idempotencyKey";

// Todo lo de este archivo es estructural: claves, nombres de acción y cuerpos de respuesta de la propia prueba, sin datos de negocio.
const CLAVE = "clave-de-prueba-0001";
const ok = (n = 1): IdemRun => ({ status: 200, body: JSON.stringify({ n }) });

const base = (store: IdempotencyStore, over: Partial<Parameters<typeof ejecutarIdempotente>[0]> = {}) => ({ store, clave: CLAVE, ambito: "acción:a", recurso: "1", actorId: 7, run: async () => ok(), ...over });

describe("idempotencia: la misma clave sobre la misma acción no repite el efecto (#172, #181)", () => {
    it("la primera vez ejecuta; la segunda devuelve el mismo resultado sin ejecutar", async () => {
        const store = memoryIdempotencyStore();
        let veces = 0;
        const run = async () => ok(++veces);
        const a = await ejecutarIdempotente(base(store, { run }));
        const b = await ejecutarIdempotente(base(store, { run }));
        assert.equal(a.kind, "ejecutado");
        assert.deepEqual(b, { kind: "repetido", status: 200, body: JSON.stringify({ n: 1 }) });
        assert.equal(veces, 1, "el efecto ocurrió una sola vez");
    });
    it("devuelve el mismo resultado aunque el estado del registro ya haya cambiado por esa misma acción", async () => {
        const store = memoryIdempotencyStore();
        let estado = "pendiente";
        const run = async (): Promise<IdemRun> => {
            const antes = estado;
            estado = "aprobado";
            return { status: 200, body: JSON.stringify({ antes }) };
        };
        await ejecutarIdempotente(base(store, { run }));
        const r = await ejecutarIdempotente(base(store, { run }));
        assert.equal(r.kind, "repetido");
        assert.equal((r as any).body, JSON.stringify({ antes: "pendiente" }), "no es «ya estaba aprobado»: es el resultado original");
    });
    it("la misma clave con otra acción, otro registro u otra persona es un conflicto y no ejecuta", async () => {
        const store = memoryIdempotencyStore();
        await ejecutarIdempotente(base(store));
        let ejecutadas = 0;
        const run = async () => (ejecutadas++, ok());
        for (const over of [{ ambito: "acción:b" }, { recurso: "2" }, { actorId: 8 }, { actorId: null }]) {
            assert.deepEqual(await ejecutarIdempotente(base(store, { ...over, run })), { kind: "conflicto" }, JSON.stringify(over));
        }
        assert.equal(ejecutadas, 0);
    });
    it("dos peticiones a la vez con la misma clave: solo una ejecuta, la otra recibe «en curso»", async () => {
        const store = memoryIdempotencyStore();
        let soltar!: () => void;
        const espera = new Promise<void>((r) => (soltar = r));
        let ejecutadas = 0;
        const lenta = ejecutarIdempotente(base(store, { run: async () => (ejecutadas++, await espera, ok()) }));
        await Promise.resolve();
        const segunda = await ejecutarIdempotente(base(store, { run: async () => (ejecutadas++, ok()) }));
        assert.deepEqual(segunda, { kind: "en_curso" });
        soltar();
        assert.equal((await lenta).kind, "ejecutado");
        assert.equal(ejecutadas, 1);
        assert.equal((await ejecutarIdempotente(base(store))).kind, "repetido", "terminada la primera, el reintento ya recibe su resultado");
    });
    it("un resultado que no es 2xx no se recuerda: la clave se puede reintentar (p. ej. tras abrir sesión en Planillas)", async () => {
        const store = memoryIdempotencyStore();
        const primero = await ejecutarIdempotente(base(store, { run: async () => ({ status: 409, body: "{}" }) }));
        assert.equal(primero.kind, "ejecutado");
        assert.equal(store.rows.size, 0, "la reserva se libera");
        const segundo = await ejecutarIdempotente(base(store, { run: async () => ok(2) }));
        assert.equal(segundo.kind, "ejecutado");
        assert.equal((segundo as any).run.body, JSON.stringify({ n: 2 }));
    });
    it("si la acción lanza un error, la clave se libera y el error original sube", async () => {
        const store = memoryIdempotencyStore();
        await assert.rejects(() => ejecutarIdempotente(base(store, { run: async () => { throw new Error("falla de la acción"); } })), /falla de la acción/);
        assert.equal(store.rows.size, 0);
        assert.equal((await ejecutarIdempotente(base(store))).kind, "ejecutado");
    });
    it("el error de la acción no se tapa aunque liberar también falle", async () => {
        const store = { ...memoryIdempotencyStore(), liberar: async () => { throw new Error("liberar falló"); } };
        await assert.rejects(() => ejecutarIdempotente(base(store, { run: async () => { throw new Error("falla de la acción"); } })), /falla de la acción/);
    });
    it("una reserva «en curso» abandonada (el proceso murió) se retoma; una vigente no", async () => {
        const store = memoryIdempotencyStore();
        const t0 = new Date("2026-10-27T10:00:00Z");
        await store.reservar({ claveHash: hashClave(CLAVE), ambito: "acción:a", recurso: "1", actorId: 7, estado: "en_curso", httpStatus: null, respuesta: null, creado: t0, expira: new Date(t0.getTime() + IDEM_RETENCION_MS) });
        const reciente = await ejecutarIdempotente(base(store, { now: () => new Date(t0.getTime() + IDEM_EN_CURSO_MAX_MS - 1000) }));
        assert.deepEqual(reciente, { kind: "en_curso" });
        const abandonada = await ejecutarIdempotente(base(store, { now: () => new Date(t0.getTime() + IDEM_EN_CURSO_MAX_MS + 1000) }));
        assert.equal(abandonada.kind, "ejecutado");
    });
    it("un resultado vencido se olvida y la clave se puede usar de nuevo", async () => {
        const store = memoryIdempotencyStore();
        const t0 = new Date("2026-10-27T10:00:00Z");
        await ejecutarIdempotente(base(store, { now: () => t0 }));
        const antes = await ejecutarIdempotente(base(store, { now: () => new Date(t0.getTime() + IDEM_RETENCION_MS - 1000) }));
        assert.equal(antes.kind, "repetido");
        const despues = await ejecutarIdempotente(base(store, { now: () => new Date(t0.getTime() + IDEM_RETENCION_MS + 1000), run: async () => ok(9) }));
        assert.equal(despues.kind, "ejecutado");
    });
    it("que el almacén falle al guardar el resultado no convierte en error una acción que ya se hizo", async () => {
        const store = { ...memoryIdempotencyStore(), completar: async () => { throw new Error("sin base"); } };
        const r = await ejecutarIdempotente(base(store));
        assert.equal(r.kind, "ejecutado");
    });
    it("la clave en claro no se guarda: solo su SHA-256", async () => {
        const store = memoryIdempotencyStore();
        await ejecutarIdempotente(base(store));
        const [llave] = [...store.rows.keys()];
        assert.equal(llave, hashClave(CLAVE));
        assert.match(llave!, /^[0-9a-f]{64}$/);
        assert.equal(JSON.stringify([...store.rows.values()]).includes(CLAVE), false);
    });
    it("claves válidas: 16 a 128 caracteres visibles, sin espacios", () => {
        assert.equal(claveValida("a".repeat(16)), true);
        assert.equal(claveValida("a".repeat(128)), true);
        for (const mala of ["a".repeat(15), "a".repeat(129), "con espacio 123456789", "con\nsalto 1234567890", "", undefined, 12345678901234567, null, "ñandú-ñandú-ñandú"]) assert.equal(claveValida(mala), false, String(mala));
    });
});

describe("idempotencia sobre HTTP (conIdempotencia)", () => {
    const opts = (store: IdempotencyStore, over: object = {}) => ({ store, ambito: "attendance:PUT", recurso: "5", actorId: 7, onStoreError: "run" as const, ...over });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

    it("sin la cabecera la ruta se comporta como siempre; con `required`, es un 400", async () => {
        const store = memoryIdempotencyStore();
        let n = 0;
        const run = async () => json({ n: ++n });
        assert.equal((await conIdempotencia(null, opts(store), run)).status, 200);
        assert.equal((await conIdempotencia(null, opts(store), run)).status, 200);
        assert.equal(n, 2, "sin clave no hay deduplicación (clientes anteriores)");
        const r = await conIdempotencia(null, opts(store, { required: true }), run);
        assert.equal(r.status, 400);
        assert.equal(n, 2);
    });
    it("una clave mal formada es un 400 y no ejecuta", async () => {
        let n = 0;
        const r = await conIdempotencia("corta", opts(memoryIdempotencyStore()), async () => (n++, json({})));
        assert.equal(r.status, 400);
        assert.equal(n, 0);
    });
    it("el reintento devuelve el mismo cuerpo y estado, marcado como repetido, y la acción se ejecuta una vez", async () => {
        const store = memoryIdempotencyStore();
        let n = 0;
        const run = async () => json({ marca: 5, intento: ++n }, 200);
        const a = await conIdempotencia(CLAVE, opts(store), run);
        const b = await conIdempotencia(CLAVE, opts(store), run);
        assert.deepEqual(await a.json(), { marca: 5, intento: 1 });
        assert.deepEqual(await b.json(), { marca: 5, intento: 1 });
        assert.equal(b.headers.get("idempotent-replay"), "true");
        assert.equal(a.headers.get("idempotent-replay"), null);
        assert.equal(n, 1);
    });
    it("la misma clave con otro recurso es 409 y no ejecuta", async () => {
        const store = memoryIdempotencyStore();
        await conIdempotencia(CLAVE, opts(store), async () => json({}));
        let n = 0;
        const r = await conIdempotencia(CLAVE, opts(store, { recurso: "6" }), async () => (n++, json({})));
        assert.equal(r.status, 409);
        assert.equal(((await r.json()) as any).code, "conflict");
        assert.equal(n, 0);
    });
    it("un error de la acción (4xx/5xx) no se recuerda y el reintento con la misma clave vuelve a intentarlo", async () => {
        const store = memoryIdempotencyStore();
        const r1 = await conIdempotencia(CLAVE, opts(store), async () => json({ status: false }, 500));
        assert.equal(r1.status, 500);
        const r2 = await conIdempotencia(CLAVE, opts(store), async () => json({ status: true }, 200));
        assert.equal(r2.status, 200);
        assert.equal(r2.headers.get("idempotent-replay"), null);
    });
    it("un error lanzado por la acción sube tal cual (no se confunde con un fallo del almacén)", async () => {
        await assert.rejects(() => conIdempotencia(CLAVE, opts(memoryIdempotencyStore()), async () => { throw new Error("de la acción"); }), /de la acción/);
    });
    it("si el almacén no está disponible: las rutas de la app siguen sin idempotencia; Guardify se niega con 503 sin ejecutar", async () => {
        const caido: IdempotencyStore = { reservar: async () => { throw new Error("tabla ausente"); }, leer: async () => null, completar: async () => undefined, liberar: async () => undefined };
        let n = 0;
        const run = async () => (n++, json({ ok: true }));
        const app = await conIdempotencia(CLAVE, opts(caido, { onStoreError: "run" }), run);
        assert.equal(app.status, 200);
        assert.equal(n, 1);
        const guardify = await conIdempotencia(CLAVE, opts(caido, { onStoreError: "fail", errorBody: (code: string, message: string) => ({ code, message }) }), run);
        assert.equal(guardify.status, 503);
        assert.equal(n, 1, "no se ejecutó");
        assert.equal(((await guardify.json()) as any).code, "store_unavailable");
    });
    it("lee la clave del encabezado o, si falta, de la alternativa", () => {
        assert.equal(readIdempotencyKey({ headers: new Headers({ "Idempotency-Key": ` ${CLAVE} ` }) }), CLAVE);
        assert.equal(readIdempotencyKey({ headers: new Headers() }, CLAVE), CLAVE);
        assert.equal(readIdempotencyKey({ headers: new Headers() }), null);
        assert.equal(readIdempotencyKey({ headers: new Headers() }, 42), null);
    });
    it("guardStore marca como IdemStoreError solo lo que falla antes de ejecutar", async () => {
        const s = guardStore({ reservar: async () => { throw new Error("x"); }, leer: async () => null, completar: async () => undefined, liberar: async () => undefined });
        await assert.rejects(() => s.reservar({} as any), (e: unknown) => e instanceof IdemStoreError);
    });
});

describe("almacén sobre la API dinámica (c_clave_idempotencia)", () => {
    const fila = { claveHash: hashClave(CLAVE), ambito: "a:b", recurso: "1", actorId: 7, estado: "en_curso" as const, httpStatus: null, respuesta: null, creado: new Date("2026-10-27T10:00:00Z"), expira: new Date("2026-11-26T10:00:00Z") };

    it("reservar: una violación de la clave única significa «ya existía»; cualquier otro error sube", async () => {
        const dup = dynamicIdempotencyStore(async () => { throw new Error("\nInvalid `prisma.c_clave_idempotencia.create()` invocation:\n\nUnique constraint failed on the constraint: `c_clave_idempotencia_clave_hash_key`"); });
        assert.equal(await dup.reservar(fila), false);
        const roto = dynamicIdempotencyStore(async () => { throw new Error("No se recibió respuesta del servidor"); });
        await assert.rejects(() => roto.reservar(fila), /No se recibió respuesta/);
        const sinTabla = dynamicIdempotencyStore(async () => { throw new Error("Tabla no soportada o no encontrada en Prisma"); });
        await assert.rejects(() => sinTabla.reservar(fila), /no soportada/);
    });
    it("usa solo la API dinámica: crea con el hash, completa y libera por clave, y nunca manda la clave en claro", async () => {
        const llamadas: Record<string, any>[] = [];
        const call = async (d: Record<string, any>) => {
            llamadas.push(d);
            if (d.action === "GET") return { clave_hash: fila.claveHash, ambito: "a:b", recurso: "1", actor_id: 7, estado: "completada", http_status: 200, respuesta: "{}", creado: "2026-10-27T10:00:00.000Z", expira: "2026-11-26T10:00:00.000Z" };
            return undefined;
        };
        const store = dynamicIdempotencyStore(call);
        assert.equal(await store.reservar(fila), true);
        await store.completar(fila.claveHash, 200, "{}");
        await store.liberar(fila.claveHash);
        const leida = await store.leer(fila.claveHash);
        assert.equal(JSON.stringify(llamadas).includes(CLAVE), false, "la clave en claro nunca sale del servidor");
        assert.deepEqual(llamadas.map((l) => [l.action, l.table, l.operation ?? null]), [["POST", "c_clave_idempotencia", "create"], ["UPDATE", "c_clave_idempotencia", null], ["DELETE", "c_clave_idempotencia", "deleteMany"], ["GET", "c_clave_idempotencia", "findUnique"]]);
        assert.deepEqual(llamadas[0]!.data, { clave_hash: fila.claveHash, ambito: "a:b", recurso: "1", actor_id: 7, estado: "en_curso", creado: "2026-10-27T10:00:00.000Z", expira: "2026-11-26T10:00:00.000Z" });
        assert.deepEqual(llamadas[1]!.where, { clave_hash: fila.claveHash });
        assert.deepEqual([leida?.estado, leida?.httpStatus, leida?.actorId, leida?.creado instanceof Date, leida?.creado.toISOString()], ["completada", 200, 7, true, "2026-10-27T10:00:00.000Z"]);
    });
    it("una clave que no existe se lee como null (la API dinámica devuelve null)", async () => {
        assert.equal(await dynamicIdempotencyStore(async () => null).leer("x"), null);
    });
    it("funciona de punta a punta con la lógica: un reintento no vuelve a ejecutar", async () => {
        // Un «servidor» mínimo que se comporta como la API dinámica sobre una tabla con clave única.
        const tabla = new Map<string, Record<string, any>>();
        const call = async (d: Record<string, any>) => {
            if (d.action === "POST") {
                if (tabla.has(d.data.clave_hash)) throw new Error("Unique constraint failed on the constraint: `c_clave_idempotencia_clave_hash_key`");
                tabla.set(d.data.clave_hash, { ...d.data, http_status: null, respuesta: null });
                return undefined;
            }
            if (d.action === "GET") return tabla.get(d.where.clave_hash) ?? null;
            if (d.action === "UPDATE") { tabla.set(d.where.clave_hash, { ...tabla.get(d.where.clave_hash)!, ...d.data }); return undefined; }
            tabla.delete(d.where.clave_hash);
            return undefined;
        };
        const store = dynamicIdempotencyStore(call);
        let veces = 0;
        const run = async () => ({ status: 200, body: JSON.stringify({ n: ++veces }) });
        const a = await ejecutarIdempotente({ store, clave: CLAVE, ambito: "x:y", recurso: "1", actorId: 7, run });
        const b = await ejecutarIdempotente({ store, clave: CLAVE, ambito: "x:y", recurso: "1", actorId: 7, run });
        assert.equal(a.kind, "ejecutado");
        assert.deepEqual(b, { kind: "repetido", status: 200, body: JSON.stringify({ n: 1 }) });
        assert.equal(veces, 1);
    });
});

describe("clave de idempotencia de la cola y rutas que la usan (#172, #181)", () => {
    const leer = (rel: string) => stripComments(fs.readFileSync(path.join(__dirname, "..", "..", "..", rel), "utf8"));

    it("la misma acción reintentada produce la misma clave; acciones distintas, claves distintas; siempre válidas para el servidor", () => {
        const a = actionIdempotencyKey("marca", 5, "entrada", 1700000000000);
        assert.equal(actionIdempotencyKey("marca", 5, "entrada", 1700000000000), a, "estable entre reintentos");
        const otras = [actionIdempotencyKey("marca", 5, "salida", 1700000000000), actionIdempotencyKey("marca", 6, "entrada", 1700000000000), actionIdempotencyKey("marca", 5, "entrada", 1700000000001), actionIdempotencyKey("otra", 5, "entrada", 1700000000000)];
        assert.equal(new Set([a, ...otras]).size, 5);
        for (const k of [a, ...otras]) assert.equal(claveValida(k), true, k);
    });
    it("claves cortas se completan y largas o con caracteres raros se acortan, sin perder la unicidad ni la validez", () => {
        const corta = actionIdempotencyKey("a", 1);
        assert.equal(claveValida(corta), true);
        assert.notEqual(actionIdempotencyKey("a", 1), actionIdempotencyKey("a", 2));
        const larga1 = actionIdempotencyKey("x", "y".repeat(500) + "1");
        const larga2 = actionIdempotencyKey("x", "y".repeat(500) + "2");
        assert.equal(claveValida(larga1), true);
        assert.ok(larga1.length <= 128);
        assert.notEqual(larga1, larga2, "dos acciones largas que solo difieren al final no colisionan");
        assert.equal(claveValida(actionIdempotencyKey("tipo con espacios", "ñandú\n\t", null, undefined)), true);
    });
    it("el teléfono manda la clave y marca la escritura como idempotente al guardar una marca", () => {
        const src = leer("apps/mobile/hooks/saveMarca.ts");
        assert.match(src, /idempotencyKey: actionIdempotencyKey\('marca', marcaId, data_params\.type, data_params\.horaAccion\)/);
        assert.match(src, /idempotent: true/);
    });
    it("PUT /api/attendance/[id] deduplica por clave DESPUÉS del control de alcance y sin cambiar nada si no hay clave", () => {
        const src = leer("apps/server/app/api/attendance/[id]/route.ts");
        const alcance = src.indexOf("authorizeMarcaAccess({");
        const envoltorio = src.indexOf("conIdempotencia(readIdempotencyKey(req)");
        assert.ok(alcance > 0 && envoltorio > alcance, "la repetición nunca salta la autorización");
        assert.match(src, /ambito: "attendance:PUT"/);
        assert.match(src, /actorId: Number\(payload\.id\)/);
        assert.match(src, /store: dynamicIdempotencyStore\(\(d\) => callDynamicPrisma\(\{ req, data: d \}\)\)/);
        assert.match(src, /onStoreError: "run"/);
    });
    it("la API de acciones y la carga masiva reciben el almacén de producción", () => {
        for (const rel of ["apps/server/app/api/guardify/actions/[tipo]/[id]/[accion]/route.ts", "apps/server/app/api/guardify/actions/imports/[tipo]/route.ts"]) {
            assert.match(leer(rel), /idempotency: actionIdempotencyStore \}\)/, rel);
        }
        assert.match(leer("apps/server/utils/guardifyActions/appEnv.ts"), /dynamicIdempotencyStore\(env\.call\)/);
    });
    it("la migración crea la tabla con clave única sobre el hash y sin columna para la clave en claro", () => {
        const sqlPath = path.join(__dirname, "..", "..", "..", "..", "gonzalez-mobile-dynamic-api", "app", "prisma", "migrations", "20261027120001_clave_idempotencia", "migration.sql");
        if (!fs.existsSync(sqlPath)) return; // el repositorio de la API dinámica puede no estar clonado junto a este
        const sql = fs.readFileSync(sqlPath, "utf8");
        assert.match(sql, /CREATE TABLE `c_clave_idempotencia`/);
        assert.match(sql, /UNIQUE INDEX `c_clave_idempotencia_clave_hash_key`\(`clave_hash`\)/);
        assert.match(sql, /`clave_hash` VARCHAR\(64\) NOT NULL/);
        assert.equal(/`clave` /.test(sql), false, "no hay columna con la clave en claro");
    });
});

describe("candado entre procesos (conCandadoDistribuido, issue #197)", () => {
    const sinEspera = async () => undefined;
    it("adquiere, ejecuta y libera siempre (también si la acción lanza)", async () => {
        const store = memoryIdempotencyStore();
        const r = await conCandadoDistribuido(store, "permisos:1", async () => 42, { sleep: sinEspera });
        assert.deepEqual(r, { ok: true, value: 42 });
        assert.equal(store.rows.size, 0, "liberado");
        await assert.rejects(() => conCandadoDistribuido(store, "permisos:1", async () => { throw new Error("falla"); }, { sleep: sinEspera }), /falla/);
        assert.equal(store.rows.size, 0, "liberado aunque falle");
    });
    it("con el candado ocupado ESPERA a que se libere y entonces ejecuta; pasado el tiempo de espera, se rinde sin ejecutar", async () => {
        const store = memoryIdempotencyStore();
        let soltar!: () => void;
        const espera = new Promise<void>((r) => (soltar = r));
        const primero = conCandadoDistribuido(store, "r:1", async () => { await espera; return "primero"; });
        await new Promise((r) => setTimeout(r, 20));
        let ejecutadoSegundo = false;
        const rendido = await conCandadoDistribuido(store, "r:1", async () => { ejecutadoSegundo = true; return "x"; }, { esperaMs: 80 });
        assert.deepEqual(rendido, { ok: false });
        assert.equal(ejecutadoSegundo, false);
        const segundo = conCandadoDistribuido(store, "r:1", async () => "segundo", { esperaMs: 2000 });
        await new Promise((r) => setTimeout(r, 40));
        soltar();
        assert.deepEqual(await primero, { ok: true, value: "primero" });
        assert.deepEqual(await segundo, { ok: true, value: "segundo" });
    });
    it("candados de recursos distintos no se estorban", async () => {
        const store = memoryIdempotencyStore();
        let soltar!: () => void;
        const espera = new Promise<void>((r) => (soltar = r));
        const a = conCandadoDistribuido(store, "import:inventario-puesto:5", async () => { await espera; return "a"; });
        await new Promise((r) => setTimeout(r, 20));
        assert.deepEqual(await conCandadoDistribuido(store, "import:inventario-puesto:6", async () => "b", { esperaMs: 50 }), { ok: true, value: "b" });
        soltar();
        await a;
    });
    it("un candado abandonado (el proceso murió) se retoma pasados 10 minutos y uno vigente no", async () => {
        const store = memoryIdempotencyStore();
        const t0 = new Date("2026-10-27T10:00:00Z");
        await store.reservar({ claveHash: hashClave("candado:r:2"), ambito: "candado", recurso: "r:2", actorId: null, estado: "en_curso", httpStatus: null, respuesta: null, creado: t0, expira: new Date(t0.getTime() + IDEM_EN_CURSO_MAX_MS) });
        const vigente = await conCandadoDistribuido(store, "r:2", async () => "x", { esperaMs: 0, now: () => new Date(t0.getTime() + 1000), sleep: sinEspera });
        assert.deepEqual(vigente, { ok: false });
        const abandonado = await conCandadoDistribuido(store, "r:2", async () => "retomado", { esperaMs: 0, now: () => new Date(t0.getTime() + IDEM_EN_CURSO_MAX_MS + 1000), sleep: sinEspera });
        assert.deepEqual(abandonado, { ok: true, value: "retomado" });
    });
    it("un fallo del almacén sale como IdemStoreError (quien llama decide) y no se ejecuta nada", async () => {
        const caido: IdempotencyStore = { reservar: async () => { throw new Error("sin base"); }, leer: async () => null, completar: async () => undefined, liberar: async () => undefined };
        let ejecutado = false;
        await assert.rejects(() => conCandadoDistribuido(caido, "r:3", async () => { ejecutado = true; }), (e: unknown) => e instanceof IdemStoreError);
        assert.equal(ejecutado, false);
    });
});
