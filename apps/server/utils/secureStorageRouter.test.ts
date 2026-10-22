import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    createDeviceUidProvider,
    createSecureRouter,
    SECURE_CHUNK_SIZE,
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
function memSecure(opts: { available?: boolean; failGet?: boolean; failSet?: boolean; maxValue?: number } = {}): SecureBackend & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
        data,
        async isAvailable() { return opts.available ?? true; },
        async get(k) { if (opts.failGet) throw new Error("keystore"); return data.get(k) ?? null; },
        async set(k, v) {
            if (opts.failSet) throw new Error("keystore");
            if (opts.maxValue && v.length > opts.maxValue) throw new Error("valor demasiado grande");
            data.set(k, v);
        },
        async remove(k) { data.delete(k); },
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

    it("sin almacén seguro (APK anterior, Expo Go) todo sigue en AsyncStorage", async () => {
        const plain = memPlain({ access_token: "a" }); const secure = memSecure({ available: false });
        const r = createSecureRouter({ plain, secure });
        assert.equal(await r.getItem("access_token"), "a");
        await r.setItem("refresh_token", "r");
        assert.equal(plain.data.get("refresh_token"), "r");
        assert.equal(secure.data.size, 0);
        assert.equal(r.isSecure(), false);
    });

    it("si el Keystore falla al escribir o leer, se usa AsyncStorage para esa llave", async () => {
        const plain = memPlain(); const secure = memSecure({ failSet: true });
        const r = createSecureRouter({ plain, secure });
        await r.setItem("access_token", "t");
        assert.equal(await r.getItem("access_token"), "t");
        assert.equal(plain.data.get("access_token"), "t");
        const secure2 = memSecure({ failGet: true }); const plain2 = memPlain();
        const r2 = createSecureRouter({ plain: plain2, secure: secure2 });
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
