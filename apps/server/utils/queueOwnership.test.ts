import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
    OWNER_KEY,
    createQueueLayer,
    mergeForWrite,
    ownerFromEmployeeJson,
    removeForOwner,
    scrubPlanillasTokens,
    scrubSerializedQueue,
    scrubStoredQueues,
    viewForOwner,
    type LayerStorage,
    type QueueOwner,
} from "../../mobile/hooks/queueOwnership";
import { countPendingActions } from "../../mobile/hooks/guardifyWipe";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");

const A: QueueOwner = { empleadoId: 1, orgId: "srv" };
const B: QueueOwner = { empleadoId: 2, orgId: "srv" };
const enOtroServidor: QueueOwner = { empleadoId: 1, orgId: "otro" };
/** Acción estructural (sin datos de negocio): solo un identificador y un campo cualquiera. */
const accion = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: "t", ...extra });
const json = (v: unknown) => JSON.stringify(v);

/** AsyncStorage en memoria con las seis operaciones que usa la capa. */
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
const employee = (id: number) => json({ id, name: "x" });

describe("propietario de cada acción de las colas (issue #176, H03)", () => {
    it("el propietario sale del empleado de la sesión y de la organización; datos inválidos no producen propietario", () => {
        assert.deepEqual(ownerFromEmployeeJson(employee(7), "srv"), { empleadoId: 7, orgId: "srv" });
        assert.deepEqual(ownerFromEmployeeJson(json({ id: "7" }), null), { empleadoId: 7, orgId: null });
        for (const bad of [null, "", "{", "[]", "null", json({}), json({ id: 0 }), json({ id: -3 }), json({ id: "abc" }), json({ id: Number.NaN }), "123"]) {
            assert.equal(ownerFromEmployeeJson(bad as string | null, "srv"), null, String(bad));
        }
    });
    it("cada usuario ve sus acciones y las que no tienen propietario (anteriores a esta versión); no ve las ajenas", () => {
        const stored = json([accion("legacy"), { ...accion("a"), [OWNER_KEY]: A }, { ...accion("b"), [OWNER_KEY]: B }]);
        const vistaA = JSON.parse(viewForOwner(stored, A)!);
        assert.deepEqual(vistaA.map((x: { id: string }) => x.id), ["legacy", "a"]);
        assert.deepEqual(JSON.parse(viewForOwner(stored, B)!).map((x: { id: string }) => x.id), ["legacy", "b"]);
    });
    it("la vista no expone el campo de propietario (las pantallas no lo ven ni lo envían)", () => {
        const vista = JSON.parse(viewForOwner(json([{ ...accion("a"), [OWNER_KEY]: A }]), A)!);
        assert.equal(OWNER_KEY in vista[0], false);
    });
    it("la misma persona en otra organización/servidor es otro propietario", () => {
        const stored = json([{ ...accion("a"), [OWNER_KEY]: A }]);
        assert.deepEqual(JSON.parse(viewForOwner(stored, enOtroServidor)!), []);
    });
    it("sin sesión (sin propietario) no se filtra nada; lo que no es una cola de objetos pasa igual", () => {
        const stored = json([{ ...accion("a"), [OWNER_KEY]: A }]);
        assert.equal(viewForOwner(stored, null), stored);
        for (const raw of [null, "", "{", json({ porSucursal: { 1: [] } }), "123", "null"]) assert.equal(viewForOwner(raw, A), raw, String(raw));
    });
    it("guardar: se conservan las acciones ajenas, las propias llevan su propietario y lo que se consumió desaparece", () => {
        const existing = json([{ ...accion("a1"), [OWNER_KEY]: A }, { ...accion("b1"), [OWNER_KEY]: B }, accion("legacy")]);
        // A consumió a1 y legacy, y encoló a2
        const out = JSON.parse(mergeForWrite(existing, json([accion("a2")]), A)!);
        assert.deepEqual(out.map((x: { id: string }) => x.id), ["b1", "a2"]);
        assert.deepEqual(out[1][OWNER_KEY], A);
        assert.deepEqual(out[0][OWNER_KEY], B);
    });
    it("guardar una cola vacía no borra las acciones ajenas; sin ajenas se borra la llave", () => {
        const existing = json([{ ...accion("a1"), [OWNER_KEY]: A }, { ...accion("b1"), [OWNER_KEY]: B }]);
        assert.deepEqual(JSON.parse(mergeForWrite(existing, "[]", A)!).map((x: { id: string }) => x.id), ["b1"]);
        assert.equal(mergeForWrite(json([{ ...accion("a1"), [OWNER_KEY]: A }]), "[]", A), null);
        assert.equal(mergeForWrite(null, "[]", A), null);
    });
    it("quitar la llave de la cola solo quita las acciones propias", () => {
        const existing = json([{ ...accion("a1"), [OWNER_KEY]: A }, { ...accion("b1"), [OWNER_KEY]: B }]);
        assert.deepEqual(JSON.parse(removeForOwner(existing, A)!).map((x: { id: string }) => x.id), ["b1"]);
        assert.equal(removeForOwner(json([{ ...accion("a1"), [OWNER_KEY]: A }]), A), null);
        assert.equal(removeForOwner(null, A), null);
    });
    it("valores raros al guardar no rompen: lo que no es un arreglo de objetos se guarda igual", () => {
        for (const raw of ["{", "123", "null", json({ a: 1 }), json("x")]) assert.equal(mergeForWrite(json([{ ...accion("b"), [OWNER_KEY]: B }]), raw, A), raw, raw);
        assert.equal(mergeForWrite("{", json([accion("a")]), A) !== null, true, "una versión anterior ilegible no impide guardar");
    });
});

describe("la capa sobre AsyncStorage (issues #170 y #176)", () => {
    const capa = (initial: Record<string, string> = {}) => {
        const storage = memStorage(initial);
        const layer = createQueueLayer(storage, { getOrgId: () => "srv" });
        return { storage, layer };
    };
    it("trabajo pendiente de un usuario sobrevive a que entre otro, y vuelve a verlo al regresar", async () => {
        const { storage } = capa();
        await storage.setItem("employee_data", employee(1));
        await storage.setItem("x_actions", json([accion("a1"), accion("a2")]));
        // entra el usuario 2
        await storage.setItem("employee_data", employee(2));
        assert.deepEqual(JSON.parse((await storage.getItem("x_actions"))!), [], "no ve lo ajeno");
        await storage.setItem("x_actions", json([accion("b1")]));
        assert.deepEqual(JSON.parse((await storage.getItem("x_actions"))!).map((x: { id: string }) => x.id), ["b1"]);
        // vuelve el usuario 1
        await storage.setItem("employee_data", employee(1));
        assert.deepEqual(JSON.parse((await storage.getItem("x_actions"))!).map((x: { id: string }) => x.id), ["a1", "a2"]);
        // el usuario 1 sincroniza todo y vacía la cola: lo del usuario 2 sigue en disco
        await storage.removeItem("x_actions");
        assert.deepEqual(JSON.parse(storage.data.get("x_actions")!).map((x: { id: string }) => x.id), ["b1"]);
    });
    it("multiGet / multiSet / multiRemove respetan lo mismo", async () => {
        const { storage } = capa();
        await storage.setItem("employee_data", employee(1));
        await storage.multiSet([["q_actions", json([accion("a")])], ["otra", "dato"]]);
        await storage.setItem("employee_data", employee(2));
        const [[, q], [, otra]] = await storage.multiGet(["q_actions", "otra"]);
        assert.deepEqual(JSON.parse(q!), []);
        assert.equal(otra, "dato", "lo que no es cola no se toca");
        await storage.multiRemove(["q_actions"]);
        assert.equal(JSON.parse(storage.data.get("q_actions")!).length, 1, "multiRemove no borra lo ajeno");
    });
    it("al cerrar sesión (sin empleado) la capa no filtra: comportamiento de siempre", async () => {
        const { storage } = capa();
        await storage.setItem("employee_data", employee(1));
        await storage.setItem("x_actions", json([accion("a")]));
        await storage.removeItem("employee_data");
        assert.equal(JSON.parse((await storage.getItem("x_actions"))!).length, 1);
    });
    it("el propietario se toma del empleado ya guardado al arrancar la app", async () => {
        const { storage } = capa({ employee_data: employee(2), x_actions: json([{ ...accion("a"), [OWNER_KEY]: { empleadoId: 1, orgId: "srv" } }, { ...accion("b"), [OWNER_KEY]: { empleadoId: 2, orgId: "srv" } }]) });
        assert.deepEqual(JSON.parse((await storage.getItem("x_actions"))!).map((x: { id: string }) => x.id), ["b"]);
    });
    it("el acceso sin filtrar (borrado remoto) ve y borra todo", async () => {
        const { storage, layer } = capa();
        await storage.setItem("employee_data", employee(1));
        await storage.setItem("x_actions", json([accion("a")]));
        await storage.setItem("employee_data", employee(2));
        await storage.setItem("x_actions", json([accion("b")]));
        const entries = await layer.raw.multiGet(["x_actions"]);
        assert.equal(countPendingActions(entries), 2, "el borrado remoto cuenta el trabajo de todos");
        assert.equal(countPendingActions(await storage.multiGet(["x_actions"])), 1, "la vista normal solo cuenta lo propio");
        await layer.raw.multiRemove(["x_actions"]);
        assert.equal(storage.data.has("x_actions"), false);
    });
    it("las llaves que no son colas pasan intactas", async () => {
        const { storage } = capa();
        await storage.setItem("employee_data", employee(1));
        await storage.setItem("cache_cualquiera", json([accion("a")]));
        assert.equal(storage.data.get("cache_cualquiera"), json([accion("a")]));
    });
});

describe("el token de Planillas no se guarda en las colas (issue #170, H01)", () => {
    const TOKEN = "tok-de-prueba-no-real";
    it("quita el token en cualquier nivel (acción, cuerpo, arreglos) y respeta lo demás", () => {
        const input = [accion("1", { planillasToken: TOKEN, requestData: { planillasToken: TOKEN, campo: 1, hijos: [{ planillasToken: TOKEN, k: "v" }] } }), accion("2", { PLANILLAS_TOKEN: TOKEN, "planillas-token": TOKEN, otro: "ok" })];
        const out = scrubPlanillasTokens(input) as Array<Record<string, any>>;
        assert.equal(JSON.stringify(out).includes(TOKEN), false);
        assert.equal(out[0]!.requestData.campo, 1);
        assert.equal(out[0]!.requestData.hijos[0].k, "v");
        assert.equal(out[1]!.otro, "ok");
        assert.equal(out[0]!.id, "1");
    });
    it("no confunde otros campos parecidos", () => {
        const out = scrubPlanillasTokens({ planillasTokenExpiresAt: 5, tokenPlanillasNota: "x", planillas: { token_x: 1 } }) as Record<string, unknown>;
        assert.deepEqual(out, { planillasTokenExpiresAt: 5, tokenPlanillasNota: "x", planillas: { token_x: 1 } });
    });
    it("sobre texto: sin token devuelve el mismo texto; con token lo limpia; si no es JSON no lo toca", () => {
        const limpio = json([accion("1")]);
        assert.equal(scrubSerializedQueue(limpio), limpio);
        const sucio = json([accion("1", { planillasToken: TOKEN })]);
        assert.equal(scrubSerializedQueue(sucio).includes(TOKEN), false);
        assert.equal(JSON.parse(scrubSerializedQueue(sucio)).length, 1, "no se pierde la acción");
        assert.equal(scrubSerializedQueue("{ planillasToken roto"), "{ planillasToken roto");
        assert.equal(scrubSerializedQueue(TOKEN), TOKEN, "el texto plano del token de la sesión no es una cola");
    });
    it("anidación exagerada no desborda la pila", () => {
        let deep: Record<string, unknown> = { planillasToken: TOKEN };
        for (let i = 0; i < 5000; i++) deep = { n: deep };
        assert.doesNotThrow(() => scrubPlanillasTokens(deep));
    });
    it("la capa lo aplica al guardar, en cualquier llave de cola o de caché, y no toca el token de la sesión", async () => {
        const storage = memStorage();
        createQueueLayer(storage, { getOrgId: () => "srv" });
        await storage.setItem("employee_data", employee(1));
        await storage.setItem("attendance_actions", json([accion("1", { planillasToken: TOKEN })]));
        await storage.multiSet([["checklist_supervision_actions", json([accion("2", { requestData: { planillasToken: TOKEN } })])], ["una_cache", json({ planillasToken: TOKEN })]]);
        for (const [k, v] of storage.data) if (k !== "employee_data") assert.equal(v.includes(TOKEN), false, `${k} conserva el token`);
        await storage.setItem("planillas_token", TOKEN);
        assert.equal(storage.data.get("planillas_token"), TOKEN, "el token de la sesión (almacén seguro) no se altera");
    });
    it("migración: limpia las colas ya guardadas sin perder ninguna acción, y es idempotente", async () => {
        const storage = memStorage({
            a_actions: json([accion("1", { planillasToken: TOKEN }), accion("2")]),
            b_actions: json([accion("3", { requestData: { planillasToken: TOKEN, campo: 1 } })]),
            marca_cache: json({ marcaId: 1, planillasToken: TOKEN }),
            limpia_actions: json([accion("4")]),
            planillas_token: TOKEN,
        });
        const r1 = await scrubStoredQueues(storage);
        assert.equal(r1.cleaned, 3);
        for (const k of ["a_actions", "b_actions", "marca_cache"]) assert.equal(storage.data.get(k)!.includes(TOKEN), false, k);
        assert.equal(JSON.parse(storage.data.get("a_actions")!).length, 2);
        assert.equal(JSON.parse(storage.data.get("b_actions")!)[0].requestData.campo, 1);
        assert.equal(storage.data.get("planillas_token"), TOKEN);
        assert.equal((await scrubStoredQueues(storage)).cleaned, 0);
    });
});

describe("cableado (issues #170 y #176)", () => {
    it("la capa se instala antes del sello de evidencia, y el borrado remoto usa el acceso sin filtrar", () => {
        const index = leer("index.js");
        assert.ok(index.indexOf("installQueueOwnership") > 0);
        assert.ok(index.indexOf("installQueueOwnership") < index.indexOf("installEvidenceQueue"), "el sello de evidencia debe ver la vista del usuario");
        const g = leer("hooks/guardifyClient.ts");
        assert.match(g, /queueRaw\./);
        assert.equal(/AsyncStorage\.multiRemove\(toRemove\)/.test(g), false);
    });
    it("el inicio de sesión de otro empleado ya no borra las colas pendientes", () => {
        const auth = leer("contexts/AuthContext.tsx");
        assert.match(auth, /isPendingWorkKey\(key\)\) return false/);
    });
    it("nada guarda el token en una acción ni lo lee de ella al enviar", () => {
        const app = leer("App.tsx");
        assert.equal(/action\??\.planillasToken/.test(app), false, "App.tsx lee el token de la acción");
        assert.equal(/action\??\.requestData\?\.planillasToken/.test(app), false);
        assert.equal(/planillasToken: storedPlanillas\.token/.test(app), false, "la migración de marca_cache guarda el token");
        for (const f of ["hooks/planillasPendingActions.ts", "hooks/attendanceActionsStorage.ts", "hooks/lunchTimeHorarioApi.ts"]) {
            assert.equal(/planillasToken: token/.test(leer(f)), false, `${f} escribe el token en una acción`);
        }
        for (const f of ["screens/MarcarIngresoSalidaScreen.tsx", "screens/TrasladoPlazasScreen.tsx", "screens/ChecklistSupervisionScreen.tsx", "screens/PuestoUbicacionScreen.tsx"]) {
            assert.equal(/planillasToken: storedPlanillas\?\.token \?\? undefined/.test(leer(f)), false, `${f} encola el token`);
        }
    });
    it("el checklist toma el token del almacén seguro al enviar", () => {
        assert.match(leer("hooks/checklistSupervisionFunctions.ts"), /readStoredPlanillasToken\(/);
    });
});
