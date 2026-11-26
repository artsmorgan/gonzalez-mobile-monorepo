import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require("jsonwebtoken");
import { parseMantenimientoEquipoPlantillaBuffer } from "../../mobile/hooks/mantenimientoEquipoPlantillaLocal";
import { pickPlanillasToken } from "../../mobile/hooks/planillasSendToken";
import { OWNER_KEY, createQueueLayer, scrubSerializedQueue, type LayerStorage } from "../../mobile/hooks/queueOwnership";
import { parseRevokeArgs } from "./revokeRefreshTokensArgs";
import { stripComments } from "./routeAudit";

const server = path.resolve(__dirname, "..");
const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leerServer = (rel: string) => stripComments(fs.readFileSync(path.join(server, rel), "utf8"));
const leerMobile = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");

const aBuffer = (wb: XLSX.WorkBook, opts: XLSX.WritingOptions = {}): ArrayBuffer => {
    const u8: Uint8Array = XLSX.write(wb, { type: "buffer", bookType: "xlsx", ...opts });
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
};

describe("SheetJS actualizado: entradas hostiles (issue #171, H05)", () => {
    it("hojas llamadas __proto__ / constructor y celdas con esos textos no contaminan Object.prototype", async () => {
        const antes = Object.getOwnPropertyNames(Object.prototype).sort();
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["__proto__", "constructor", "prototype", "polluted"], ["polluted", 1, 2, 3]]), "constructor");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["x"]]), "__proto__");
        const r = await parseMantenimientoEquipoPlantillaBuffer(aBuffer(wb));
        assert.equal(r.status, false, "no es una plantilla: se rechaza, pero sin romper");
        assert.equal(({} as Record<string, unknown>).polluted, undefined);
        assert.equal(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted"), false);
        assert.deepEqual(Object.getOwnPropertyNames(Object.prototype).sort(), antes);
    });
    it("formatos de número patológicos (superficie del ReDoS CVE-2024-22363) se leen dentro del presupuesto", async () => {
        const hostiles = ["0".repeat(20000) + "x", "[".repeat(5000), "#,##0".repeat(2000), `"${"a".repeat(30000)}`, "0;" + "0.0E+0".repeat(1000)];
        for (const fmt of hostiles) {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([[1.5]]);
            ws["A1"]!.z = fmt;
            XLSX.utils.book_append_sheet(wb, ws, "H");
            const buffer = aBuffer(wb, { cellStyles: true });
            const t0 = Date.now();
            const r = await parseMantenimientoEquipoPlantillaBuffer(buffer);
            assert.equal(typeof r.status, "boolean");
            assert.ok(Date.now() - t0 < 1500, `${JSON.stringify(fmt.slice(0, 10))}: ${Date.now() - t0} ms`);
        }
    });
    it("CI y Railway instalan con `npm install` sobre el lockfile (que fija origen e integridad): no necesitan cambios", () => {
        const root = path.resolve(server, "..", "..");
        for (const wf of ["expo-ci.yml", "next-ci.yml"]) assert.match(fs.readFileSync(path.join(root, ".github", "workflows", wf), "utf8"), /npm install/);
        const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
        assert.match(lock.packages["node_modules/xlsx"].integrity, /^sha512-/);
    });
});

describe("el token de Planillas sale del almacén seguro al enviar (issue #170, H01)", () => {
    it("explícito (en memoria) > almacén seguro > nada; se recortan espacios", () => {
        assert.equal(pickPlanillasToken("  explicito ", "guardado"), "explicito");
        assert.equal(pickPlanillasToken("", "guardado"), "guardado");
        assert.equal(pickPlanillasToken(undefined, " guardado "), "guardado");
        assert.equal(pickPlanillasToken(null, undefined), null);
        assert.equal(pickPlanillasToken("   ", ""), null);
    });
    it("una acción migrada (sin token) se envía con el token ACTUAL del almacén, no con el que traía antes", () => {
        const vieja = JSON.stringify([{ id: "1", type: "salida", planillasToken: "token-viejo-de-prueba" }]);
        const migrada = JSON.parse(scrubSerializedQueue(vieja))[0] as { planillasToken?: string };
        assert.equal(migrada.planillasToken, undefined);
        assert.equal(pickPlanillasToken(migrada.planillasToken, "token-actual-del-almacen"), "token-actual-del-almacen");
    });
    it("los envíos usan ese criterio y ninguno conserva la lectura del token desde la acción", () => {
        for (const f of ["hooks/saveMarca.ts", "hooks/revertAttendanceLeaving.ts", "hooks/mutuosAcuerdosFunctions.ts", "hooks/lunchTimeHorarioApi.ts"]) {
            const src = leerMobile(f);
            assert.match(src, /pickPlanillasToken\(/, f);
            assert.equal(/String\(planillasTokenOverride \?\? ''\)\.trim\(\) \|\| storedPlanillas/.test(src), false, `${f} conserva el criterio duplicado`);
            assert.match(src, /readStoredPlanillasToken\(/, `${f} debe leer el token del almacén`);
        }
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
    it("con la sesión del propietario ausente la acción no se envía y permanece en la cola", async () => {
        const storage = memStorage();
        createQueueLayer(storage, { getOrgId: () => "srv" });
        await storage.setItem("employee_data", JSON.stringify({ id: 1 }));
        await storage.setItem("attendance_actions", JSON.stringify([{ id: "a1", type: "salida" }]));
        await storage.setItem("employee_data", JSON.stringify({ id: 2 })); // entra otra persona
        assert.deepEqual(JSON.parse((await storage.getItem("attendance_actions"))!), [], "la sesión de B no ve (ni envía) lo de A");
        const crudo = JSON.parse(storage.data.get("attendance_actions")!) as Array<Record<string, unknown>>;
        assert.equal(crudo.length, 1, "la acción de A sigue en la cola");
        assert.deepEqual(crudo[0]![OWNER_KEY], { empleadoId: 1, orgId: "srv" });
    });
    it("la sincronización no corre sin una sesión activa", () => {
        const app = leerMobile("App.tsx");
        const start = app.indexOf("const syncPendingActionsIfOnline");
        const guard = app.indexOf("if (!employee)", start);
        const firstSync = app.indexOf("checkMobileVersionAvailability()", start);
        assert.ok(guard > start && guard < firstSync, "se exige employee antes de sincronizar");
    });
});

describe("refresh tokens: hash y revocación (issue #169)", () => {
    it("el token en claro no se guarda: solo su SHA-256 de 64 caracteres", () => {
        const src = leerServer("utils/issueLegacyMobileTokens.ts");
        assert.match(src, /createHash\("sha256"\)/);
        assert.match(src, /token: hashToken\(refreshToken\)/);
        assert.equal(/token: refreshToken\b/.test(src), false, "no debe guardar el token en claro");
        assert.equal(crypto.createHash("sha256").update("x").digest("hex").length, 64, "cabe en refresh_token.token VarChar(64)");
    });
    it("un refresh token alterado no verifica y la ruta responde 401", () => {
        const secret = "secreto-de-prueba-solo-para-el-test";
        const bueno = jwt.sign({ id: 1, sessionId: "s" }, secret, { expiresIn: "7d" });
        assert.equal(jwt.verify(bueno, secret).id, 1, "con el token válido funciona");
        const alterado = bueno.slice(0, -2) + (bueno.endsWith("AA") ? "BB" : "AA");
        assert.throws(() => jwt.verify(alterado, secret));
        assert.throws(() => jwt.verify(bueno, secret + "x"));
        const route = leerServer("app/api/auth/refresh-token/route.ts");
        const i = route.indexOf("jwt.verify(refreshToken");
        assert.ok(i > 0);
        assert.match(route.slice(i, i + 400), /Refresh token inválido[\s\S]{0,80}status: 401/);
    });
    it("la revocación masiva al desplegar es un script que, por defecto, NO revoca nada", () => {
        assert.deepEqual(parseRevokeArgs([]), { confirm: false, before: null });
        assert.deepEqual(parseRevokeArgs(["--dry-run"]), { confirm: false, before: null });
        assert.equal(parseRevokeArgs(["--confirm"]).confirm, true);
        assert.equal(parseRevokeArgs(["--confirm", "--before=2026-10-27T12:00:00Z"]).before?.toISOString(), "2026-10-27T12:00:00.000Z");
        assert.throws(() => parseRevokeArgs(["--before=ayer"]), /fecha/i);
        assert.throws(() => parseRevokeArgs(["--borrar-todo"]), /desconocido/i);
        const script = fs.readFileSync(path.join(server, "scripts", "revokeRefreshTokens.ts"), "utf8");
        assert.match(script, /updateMany/);
        assert.match(script, /args\.confirm/);
    });
});

describe("correcciones de #181 (carga masiva y mutuos acuerdos) tras fusionar el PR #190", () => {
    // El comportamiento (mutuo que vuelve a pendiente, carga sin lista vacía) lo prueban utils/guardifyActions/guardifyActions.test.ts; aquí solo se
    // comprueba que las rutas de la app siguen usando esa lógica y no volvieron a una copia.
    it("bulk-articulos usa la carga compartida y ya no habla de la ubicación del puesto", () => {
        const route = leerServer("app/api/mantenimiento-equipo/bulk-articulos/route.ts");
        assert.match(route, /cargarInventarioPuesto\(/);
        assert.equal(/axios\.post\(/.test(route), false, "la ruta no llama a Planillas por su cuenta");
        const lib = leerServer("utils/guardifyActions/inventario.ts");
        assert.equal(/ubicación del puesto/.test(lib), false);
        assert.match(lib, /Error al cargar los artículos en Planillas/);
        assert.ok(lib.indexOf("plan.send.length === 0") > 0 && lib.indexOf("plan.send.length === 0") < lib.indexOf("env.planillas("), "la guarda va antes de la llamada");
    });
    it("firma-ejecutivo usa la aprobación compartida, que revierte el mutuo si Planillas falla", () => {
        const route = leerServer("app/api/mutuos-acuerdos/[id]/firma-ejecutivo/route.ts");
        assert.match(route, /aprobarMutuoAcuerdo\(/);
        assert.equal(/axios\.post\(/.test(route), false);
    });
    it("reportError sigue sin lanzar y sin token en peticiones internas", () => {
        const src = leerServer("utils/reportError.ts");
        assert.match(src, /isInternalRequest\(req\)/);
        assert.match(src, /buildErrorLogRow\(/);
        assert.match(src, /catch \(e\)/);
    });
});
