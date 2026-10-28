import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    createDeviceUidProvider,
    createSecureRouter,
    isSecureStorageError,
    SECURE_CHUNK_SIZE,
    SecureStorageError,
    SENSITIVE_STORAGE_KEYS,
    withChunks,
    type PlainStorage,
    type SecureBackend,
} from "../../mobile/hooks/secureStorageRouter";

function memPlain(initial: Record<string, string> = {}): PlainStorage & { data: Map<string, string> } {
    const data = new Map(Object.entries(initial));
    return {
        data,
        async getItem(k) { return data.get(k) ?? null; },
        async setItem(k, v) { data.set(k, v); },
        async removeItem(k) { data.delete(k); },
    };
}
type SecureOpts = { available?: boolean; failGet?: boolean; failSet?: boolean; failSetTimes?: number; failRemove?: boolean; maxValue?: number };
/** Almacén seguro en memoria. `opts` es mutable: una prueba puede cambiar un fallo a mitad de camino. */
function memSecure(opts: SecureOpts = {}): SecureBackend & { data: Map<string, string>; opts: SecureOpts; removeCalls: string[] } {
    const data = new Map<string, string>();
    const removeCalls: string[] = [];
    return {
        data,
        opts,
        removeCalls,
        async isAvailable() { return opts.available ?? true; },
        async get(k) { if (opts.failGet) throw new Error("keystore"); return data.get(k) ?? null; },
        async set(k, v) {
            if (opts.failSetTimes && opts.failSetTimes > 0) { opts.failSetTimes -= 1; throw new Error("keystore"); }
            if (opts.failSet) throw new Error("keystore");
            if (opts.maxValue && v.length > opts.maxValue) throw new Error("valor demasiado grande");
            data.set(k, v);
        },
        async remove(k) { removeCalls.push(k); if (opts.failRemove) throw new Error("keystore"); data.delete(k); },
    };
}

describe("almacenamiento seguro de la sesión (issue #144)", () => {
    it("las llaves sensibles van al almacén seguro y las demás a AsyncStorage", async () => {
        const plain = memPlain(); const secure = memSecure();
        const r = createSecureRouter({ plain, secure });
        await r.setItem("access_token", "tok");
        await r.setItem("current_marca", "{}");
        assert.equal(secure.data.get("access_token"), "tok");
        assert.equal(plain.data.has("access_token"), false);
        assert.equal(plain.data.get("current_marca"), "{}");
        assert.equal(secure.data.has("current_marca"), false);
        assert.equal(await r.getItem("access_token"), "tok");
        assert.equal(await r.getItem("current_marca"), "{}");
    });

    it("migra al abrir: tras actualizar no quedan tokens en AsyncStorage y la sesión existente se conserva", async () => {
        const legacy: Record<string, string> = {
            access_token: "a", refresh_token: "r", token_created_at: "123", employee_data: JSON.stringify({ id: "5", roles: [{ role: { id: 1, name: "SUPERVISOR" } }] }),
            planillas_token: "p", planillas_token_expires_at: "999", auth_session_mode: "planillas", current_marca: "{}", remembered_cedula: "1-1",
        };
        const plain = memPlain(legacy); const secure = memSecure();
        const r = createSecureRouter({ plain, secure });
        // la primera lectura espera a la migración y devuelve el valor de siempre
        assert.equal(await r.getItem("access_token"), "a");
        for (const k of SENSITIVE_STORAGE_KEYS) assert.equal(plain.data.has(k), false, `${k} sigue en AsyncStorage`);
        assert.equal(await r.getItem("employee_data"), legacy.employee_data);
        assert.equal(plain.data.get("current_marca"), "{}"); // lo no sensible no se toca
        assert.equal(plain.data.get("remembered_cedula"), "1-1");
    });

    it("sin sesión previa la migración no inventa nada; con y sin sesión previa es idempotente", async () => {
        const plain = memPlain(); const secure = memSecure();
        const r = createSecureRouter({ plain, secure });
        await r.ready(); await r.ready();
        assert.equal(await r.getItem("access_token"), null);
        assert.equal(secure.data.size, 0);
        const plain2 = memPlain({ access_token: "a" });
        const secure2 = memSecure();
        await createSecureRouter({ plain: plain2, secure: secure2 }).ready();
        await createSecureRouter({ plain: plain2, secure: secure2 }).ready(); // segunda apertura
        assert.equal(secure2.data.get("access_token"), "a");
        assert.equal(plain2.data.size, 0);
    });

    it("si no se puede verificar la copia segura, el valor se deja en AsyncStorage (no se pierde la sesión)", async () => {
        const plain = memPlain({ access_token: "a" });
        const secure = memSecure();
        secure.set = async () => { /* escribe pero no guarda nada */ };
        const r = createSecureRouter({ plain, secure });
        assert.equal(await r.getItem("access_token"), "a");
        assert.equal(plain.data.get("access_token"), "a");
    });

    it("[solo desarrollo] sin almacén seguro (Expo Go) todo sigue en AsyncStorage", async () => {
        const plain = memPlain({ access_token: "a" }); const secure = memSecure({ available: false });
        const r = createSecureRouter({ plain, secure, allowPlainFallback: true });
        assert.equal(await r.getItem("access_token"), "a");
        await r.setItem("refresh_token", "r");
        assert.equal(plain.data.get("refresh_token"), "r");
        assert.equal(secure.data.size, 0);
        assert.equal(r.isSecure(), false);
    });

    it("[solo desarrollo] si el Keystore falla al escribir o leer, se usa AsyncStorage para esa llave", async () => {
        const plain = memPlain(); const secure = memSecure({ failSet: true });
        const r = createSecureRouter({ plain, secure, allowPlainFallback: true });
        await r.setItem("access_token", "t");
        assert.equal(await r.getItem("access_token"), "t");
        assert.equal(plain.data.get("access_token"), "t");
        const secure2 = memSecure({ failGet: true }); const plain2 = memPlain();
        const r2 = createSecureRouter({ plain: plain2, secure: secure2, allowPlainFallback: true });
        await plain2.setItem("employee_data", "{}");
        assert.equal(await r2.getItem("employee_data"), "{}");
    });

    it("guarda valores grandes en trozos y los reconstruye; al achicar el valor no quedan trozos de más", async () => {
        const secure = memSecure({ maxValue: 2048 });
        const store = withChunks(secure);
        const big = "x".repeat(SECURE_CHUNK_SIZE * 3 + 10);
        await store.set("employee_data", big);
        assert.equal(await store.get("employee_data"), big);
        assert.equal([...secure.data.keys()].filter((k) => k.includes(".part")).length, 4);
        await store.set("employee_data", "corto");
        assert.equal(await store.get("employee_data"), "corto");
        assert.equal([...secure.data.keys()].some((k) => k.includes(".part")), false);
        await store.set("employee_data", big);
        await store.remove("employee_data");
        assert.equal(secure.data.size, 0);
    });

    it("multiGet / multiSet / multiRemove respetan el enrutamiento", async () => {
        const plain = memPlain(); const secure = memSecure();
        const r = createSecureRouter({ plain, secure });
        await r.multiSet([["access_token", "a"], ["foo", "1"]]);
        assert.deepEqual(await r.multiGet(["access_token", "foo", "nada"]), [["access_token", "a"], ["foo", "1"], ["nada", null]]);
        await r.multiRemove(["access_token", "foo"]);
        assert.equal(secure.data.size, 0);
        assert.equal(plain.data.size, 0);
    });

    it("cerrar sesión borra la sesión pero no el identificador del equipo (guardado aparte)", async () => {
        const plain = memPlain(); const secure = memSecure();
        const r = createSecureRouter({ plain, secure });
        await secure.set("device_uid", "uid-1");
        await r.multiSet([["access_token", "a"], ["employee_data", "{}"]]);
        await r.multiRemove([...SENSITIVE_STORAGE_KEYS]);
        assert.equal(await secure.get("device_uid"), "uid-1");
    });
});

describe("identificador único del equipo (issue #144)", () => {
    it("el mismo equipo devuelve siempre el mismo deviceUid, aunque se pida varias veces a la vez", async () => {
        let stored: string | null = null; let n = 0;
        const get = createDeviceUidProvider({ read: async () => stored, write: async (u) => { stored = u; }, generate: () => `uid-${++n}` });
        const [a, b, c] = await Promise.all([get(), get(), get()]);
        assert.deepEqual([a, b, c], ["uid-1", "uid-1", "uid-1"]);
        // "reinicio de la app": otro proveedor con el mismo almacén
        const again = createDeviceUidProvider({ read: async () => stored, write: async (u) => { stored = u; }, generate: () => `uid-${++n}` });
        assert.equal(await again(), "uid-1");
        assert.equal(n, 1);
    });
    it("si falla la escritura no queda un valor a medias y se puede reintentar", async () => {
        let stored: string | null = null; let fail = true;
        const get = createDeviceUidProvider({ read: async () => stored, write: async (u) => { if (fail) throw new Error("disco"); stored = u; }, generate: () => "uid-x" });
        await assert.rejects(get(), /disco/);
        fail = false;
        assert.equal(await get(), "uid-x");
    });
});

const SECRETO = "secreto-que-no-debe-quedar-en-claro";
/** Ninguna llave de AsyncStorage contiene el secreto (ni siquiera dentro de otro valor). */
const sinSecretoEnPlano = (plain: { data: Map<string, string> }) => [...plain.data.entries()].every(([k, v]) => !k.includes(SECRETO) && !v.includes(SECRETO));

describe("sin degradar a texto plano (issue #173, H02)", () => {
    it("por defecto, si el almacén seguro no está disponible, guardar una credencial falla con un error tipado y NO escribe en AsyncStorage", async () => {
        const plain = memPlain(); const secure = memSecure({ available: false });
        const r = createSecureRouter({ plain, secure });
        for (const key of SENSITIVE_STORAGE_KEYS) {
            await assert.rejects(() => r.setItem(key, SECRETO), (e: unknown) => isSecureStorageError(e) && e.code === "secure_unavailable" && e.key === key);
        }
        assert.equal(plain.data.size, 0);
        assert.equal(sinSecretoEnPlano(plain), true);
    });
    it("por defecto, si el Keystore rechaza la escritura (tras reintentar) falla con un error tipado y NO deja la credencial en claro", async () => {
        const plain = memPlain(); const secure = memSecure({ failSet: true });
        const r = createSecureRouter({ plain, secure });
        await assert.rejects(() => r.setItem("access_token", SECRETO), (e: unknown) => e instanceof SecureStorageError && e.code === "secure_write_failed" && e.key === "access_token");
        await assert.rejects(() => r.multiSet([["refresh_token", SECRETO]]), SecureStorageError);
        assert.equal(sinSecretoEnPlano(plain), true);
        assert.equal(await r.getItem("access_token"), null);
    });
    it("un fallo pasajero del Keystore se reintenta y la credencial queda en el almacén seguro", async () => {
        const plain = memPlain(); const secure = memSecure({ failSetTimes: 1 });
        const r = createSecureRouter({ plain, secure });
        await r.setItem("access_token", "t");
        assert.equal(secure.data.get("access_token"), "t");
        assert.equal(plain.data.has("access_token"), false);
    });
    it("lo que no es sensible sigue yendo a AsyncStorage aunque el almacén seguro no esté", async () => {
        const plain = memPlain(); const secure = memSecure({ available: false });
        const r = createSecureRouter({ plain, secure });
        await r.setItem("current_marca", "{}");
        assert.equal(plain.data.get("current_marca"), "{}");
    });
    it("si el almacén seguro estaba momentáneamente no disponible, vuelve a probarlo y guarda en él (no queda fijado en «no disponible»)", async () => {
        const plain = memPlain(); const secure = memSecure({ available: false });
        const r = createSecureRouter({ plain, secure });
        await assert.rejects(() => r.setItem("access_token", "t1"), SecureStorageError);
        secure.opts.available = true;
        await r.setItem("access_token", "t2");
        assert.equal(secure.data.get("access_token"), "t2");
        assert.equal(r.isSecure(), true);
    });
    it("leer una sesión que quedó en AsyncStorage de una versión anterior sigue funcionando aunque el Keystore no esté (no se pierde la sesión)", async () => {
        const plain = memPlain({ access_token: "vieja" }); const secure = memSecure({ available: false });
        const r = createSecureRouter({ plain, secure });
        assert.equal(await r.getItem("access_token"), "vieja");
    });
    it("cableado: el arranque solo permite el respaldo en claro en desarrollo y el inicio de sesión distingue este error", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require("node:fs") as typeof import("node:fs");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require("node:path") as typeof import("node:path");
        const install = fs.readFileSync(path.resolve(__dirname, "..", "..", "mobile", "hooks", "installSecureStorage.ts"), "utf8");
        assert.match(install, /allowPlainFallback:\s*__DEV__/);
        const auth = fs.readFileSync(path.resolve(__dirname, "..", "..", "mobile", "contexts", "AuthContext.tsx"), "utf8");
        assert.match(auth, /isSecureStorageError\(/);
    });
});

describe("borrado que falla: pendiente y con reintento (issue #173, H02)", () => {
    const sesion = { access_token: "a", refresh_token: "r", employee_data: "{}" };
    const conSesionGuardada = async (opts: SecureOpts = {}) => {
        const plain = memPlain(); const secure = memSecure(opts);
        const r = createSecureRouter({ plain, secure });
        await r.multiSet(Object.entries(sesion));
        return { plain, secure, r };
    };
    it("si el Keystore no deja borrar, cerrar sesión no lanza pero la credencial NO se puede volver a leer, y queda registrada como pendiente", async () => {
        const { plain, secure, r } = await conSesionGuardada();
        secure.opts.failRemove = true;
        await r.multiRemove(Object.keys(sesion)); // no lanza
        for (const k of Object.keys(sesion)) assert.equal(await r.getItem(k), null, `${k} se sigue leyendo tras cerrar sesión`);
        assert.ok(secure.data.has("access_token"), "el Keystore sigue teniendo el valor (por eso hay que reintentar)");
        assert.deepEqual(JSON.parse(plain.data.get("secure_pending_deletes")!).sort(), Object.keys(sesion).sort());
        assert.deepEqual(r.getPendingDeletes().sort(), Object.keys(sesion).sort());
    });
    it("un error de borrado no detiene el resto: se intenta borrar todas las llaves", async () => {
        const { secure, r } = await conSesionGuardada();
        secure.opts.failRemove = true;
        secure.removeCalls.length = 0;
        await r.multiRemove(Object.keys(sesion));
        for (const k of Object.keys(sesion)) assert.ok(secure.removeCalls.includes(k), `no se intentó borrar ${k}`);
    });
    it("reintenta el borrado y, al lograrlo, deja de estar pendiente", async () => {
        const { plain, secure, r } = await conSesionGuardada();
        secure.opts.failRemove = true;
        await r.multiRemove(Object.keys(sesion));
        assert.deepEqual((await r.retryPendingDeletes()).sort(), Object.keys(sesion).sort(), "mientras siga fallando, siguen pendientes");
        secure.opts.failRemove = false;
        assert.deepEqual(await r.retryPendingDeletes(), []);
        assert.equal(secure.data.size, 0);
        assert.deepEqual(JSON.parse(plain.data.get("secure_pending_deletes") ?? "[]"), []);
    });
    it("el reintento sobrevive al cierre de la app: al abrir de nuevo se completa solo", async () => {
        const { plain, secure, r } = await conSesionGuardada();
        secure.opts.failRemove = true;
        await r.multiRemove(Object.keys(sesion));
        secure.opts.failRemove = false;
        const reabierta = createSecureRouter({ plain, secure }); // otra «ejecución» de la app, mismo almacenamiento
        await reabierta.ready();
        assert.equal(secure.data.size, 0, "el Keystore debe quedar vacío");
        assert.deepEqual(reabierta.getPendingDeletes(), []);
        assert.equal(await reabierta.getItem("access_token"), null);
    });
    it("leer una llave pendiente intenta borrarla antes y nunca devuelve el valor viejo", async () => {
        const { secure, r } = await conSesionGuardada();
        secure.opts.failRemove = true;
        await r.removeItem("access_token");
        secure.opts.failRemove = false;
        assert.equal(await r.getItem("access_token"), null);
        assert.equal(secure.data.has("access_token"), false);
        assert.deepEqual(r.getPendingDeletes(), []);
    });
    it("iniciar sesión de nuevo sobre una llave pendiente guarda el valor nuevo y limpia el pendiente", async () => {
        const { secure, r } = await conSesionGuardada();
        secure.opts.failRemove = true;
        await r.removeItem("access_token");
        await r.setItem("access_token", "nueva");
        assert.equal(await r.getItem("access_token"), "nueva");
        assert.equal(r.getPendingDeletes().includes("access_token"), false);
    });
    it("el borrado que sí funciona no deja pendientes ni rastro en claro", async () => {
        const { plain, secure, r } = await conSesionGuardada();
        await r.multiRemove(Object.keys(sesion));
        assert.equal(secure.data.size, 0);
        assert.deepEqual(r.getPendingDeletes(), []);
        assert.equal(plain.data.size === 0 || [...plain.data.keys()].every((k) => k === "secure_pending_deletes"), true);
    });
});
