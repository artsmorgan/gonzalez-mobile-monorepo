import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { REPORTES_OPERATIONS, ReportesApiError, authorizeReportesOperation } from "./reportesAccess";
import { REPORTES_SECURITY_FIELDS, buildReportesPayload } from "./reportesPayload";
import { findCredentialKeys, slimRefreshTokenRow, tokenRef } from "./reportesUserLogin";

const raiz = path.resolve(__dirname, "..");
const leer = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

const actor = (empleadoId: number, admin: boolean) => ({ empleadoId, isAdmin: async () => admin });

describe("control de acceso por operación de /api/reportes (issue #169)", () => {
    it("un empleado sin rol de administración recibe 403 en las operaciones de administración", async () => {
        for (const op of ["previewUserLoginRefreshTokens", "purgeOldReports"]) {
            const r = await authorizeReportesOperation(op, actor(10, false));
            assert.deepEqual([r.ok, !r.ok && r.httpStatus], [false, 403], op);
        }
    });
    it("un administrador puede ejecutarlas", async () => {
        for (const op of ["previewUserLoginRefreshTokens", "purgeOldReports"]) assert.equal((await authorizeReportesOperation(op, actor(10, true))).ok, true, op);
    });
    it("las operaciones de reportes y búsquedas siguen abiertas a cualquier empleado con sesión, y no consultan el rol", async () => {
        let consultas = 0;
        const a = { empleadoId: 10, isAdmin: async () => (consultas++, false) };
        for (const op of ["previewActividades", "searchEmployees", "listReports", "createReportJob", "previewLoginMarca"]) assert.equal((await authorizeReportesOperation(op, a)).ok, true, op);
        assert.equal(consultas, 0);
    });
    it("una operación nueva, sin entrada en la tabla, se deniega aunque quien la pide sea administrador", async () => {
        for (const op of ["operacionNueva", "", "  ", "constructor", "__proto__", "toString", "previewActividades ", "PREVIEWACTIVIDADES"]) {
            const r = await authorizeReportesOperation(op, actor(10, true));
            // «previewActividades » con espacio se normaliza: es la misma operación; el resto no existe
            if (op.trim() === "previewActividades") assert.equal(r.ok, true);
            else assert.equal(r.ok, false, JSON.stringify(op));
        }
    });
    it("sin identidad de empleado (token sin id) no se permite nada, ni siquiera lo abierto", async () => {
        for (const id of [NaN, 0, -1]) assert.equal((await authorizeReportesOperation("previewActividades", actor(id, true))).ok, false, String(id));
        assert.equal((await authorizeReportesOperation("purgeOldReports", actor(NaN, true))).ok, false);
    });
    it("si falla la consulta del rol se deniega", async () => {
        const r = await authorizeReportesOperation("purgeOldReports", { empleadoId: 10, isAdmin: async () => { throw new Error("BD caída"); } });
        assert.equal(r.ok, false);
    });
    it("el error de acceso lleva su código HTTP (403, no un 500 genérico)", () => {
        const e = new ReportesApiError("No tienes permiso", 403);
        assert.deepEqual([e.httpStatus, e instanceof Error, e.message], [403, true, "No tienes permiso"]);
    });
    it("TODA operación que implementa create.ts tiene entrada en la tabla (una nueva sin entrada hace fallar esta prueba)", () => {
        const ops = [...leer("app/api/reportes/create.ts").matchAll(/op === "([A-Za-z0-9_]+)"/g)].map((m) => m[1]!);
        assert.ok(ops.length >= 40, `se esperaban muchas operaciones, hay ${ops.length}`);
        const sinEntrada = [...new Set(ops)].filter((o) => !(o in REPORTES_OPERATIONS));
        assert.deepEqual(sinEntrada, []);
        // y la tabla no guarda operaciones que ya no existen
        const huerfanas = Object.keys(REPORTES_OPERATIONS).filter((o) => !ops.includes(o));
        assert.deepEqual(huerfanas, []);
    });
    it("solo las dos operaciones de administración exigen rol de administración", () => {
        const admin = Object.entries(REPORTES_OPERATIONS).filter(([, v]) => v === "admin").map(([k]) => k).sort();
        assert.deepEqual(admin, ["previewUserLoginRefreshTokens", "purgeOldReports"]);
    });
});

describe("el cuerpo del cliente no puede sobrescribir los campos de seguridad (issue #169)", () => {
    const base = { mobileAccessToken: "TOKEN-DEL-SERVIDOR", accessToken: "JWT-DEL-USUARIO" };
    it("shouldVerifyAccessToken, token y mobileAccessToken ajenos no cambian el payload", () => {
        const body = { operation: "listReports", shouldVerifyAccessToken: false, token: "JWT-AJENO", mobileAccessToken: "OTRO" };
        const p = buildReportesPayload({ body, ...base });
        assert.equal(p.shouldVerifyAccessToken, true);
        assert.equal(p.token, "JWT-DEL-USUARIO");
        assert.equal(p.mobileAccessToken, "TOKEN-DEL-SERVIDOR");
        assert.equal(p.operation, "listReports"); // lo demás del cuerpo se conserva
    });
    it("sin token de usuario en la petición, un token del cuerpo tampoco se adopta", () => {
        const p = buildReportesPayload({ body: { operation: "x", token: "JWT-AJENO" }, mobileAccessToken: "S", accessToken: undefined });
        assert.equal(p.token, undefined);
    });
    it("cubre exactamente los tres campos de seguridad", () => {
        assert.deepEqual([...REPORTES_SECURITY_FIELDS].sort(), ["mobileAccessToken", "shouldVerifyAccessToken", "token"]);
        const body: Record<string, unknown> = Object.fromEntries(REPORTES_SECURITY_FIELDS.map((k) => [k, "intruso"]));
        const p = buildReportesPayload({ body, mobileAccessToken: "S", accessToken: "U" }) as Record<string, unknown>;
        assert.deepEqual([p.mobileAccessToken, p.shouldVerifyAccessToken, p.token], ["S", true, "U"]);
    });
});

describe("ninguna respuesta de reportes devuelve credenciales (issue #169)", () => {
    const hash = "a".repeat(58) + "f00d42";
    const fila = {
        id: 1, token: hash, createdAt: new Date(0), expiresAt: new Date(1), sessionId: "s-1", revoked: false, empleadoId: 7, device: "equipo",
        c_empleado: { id: 7, nombre: "N", primer_apellido: "A", segundo_apellido: "B", codigo: "C" },
    };
    it("la fila de ingresos de usuario no trae el token ni su hash, solo una referencia corta", () => {
        const s = slimRefreshTokenRow(fila);
        assert.equal(JSON.stringify(s).includes(hash), false);
        assert.deepEqual(findCredentialKeys(s), []);
        assert.equal(s.tokenRef, "…f00d42");
        assert.equal("token" in s, false);
    });
    it("el recorrido detecta propiedades de credencial en cualquier nivel", () => {
        assert.deepEqual(findCredentialKeys({ a: [{ b: { token: "x" } }], refreshToken: "y", nested: { passwordHash: "z", ok: 1 } }).sort(), ["$.a[0].b.token", "$.nested.passwordHash", "$.refreshToken"]);
        assert.deepEqual(findCredentialKeys({ tokenRef: "…abc", sessionId: "s", device: "d" }), []);
        assert.deepEqual(findCredentialKeys(null), []);
    });
    it("tokenRef tolera vacíos y valores cortos", () => {
        assert.equal(tokenRef(null), "");
        assert.equal(tokenRef(""), "");
        assert.equal(tokenRef("abc"), "…abc");
    });
});

describe("cableado: el servidor usa estas piezas (issue #169)", () => {
    it("create.ts autoriza cada operación antes de ejecutarla y no devuelve token", () => {
        const src = leer("app/api/reportes/create.ts");
        assert.match(src, /authorizeReportesOperation\(/);
        assert.match(src, /slimRefreshTokenRow\(/);
        assert.equal(/token:\s*r\.token/.test(src), false, "create.ts no debe devolver r.token");
        // la autorización va antes de la primera operación
        assert.ok(src.indexOf("authorizeReportesOperation(") < src.indexOf('op === "purgeOldReports"'));
    });
    it("callDynamicReportesApi arma el payload con buildReportesPayload (cuerpo del cliente primero)", () => {
        const src = leer("utils/callDynamicReportesApi.ts");
        assert.match(src, /buildReportesPayload\(/);
        assert.equal(/\.\.\.body,?\s*\n?\s*\}/.test(src), false, "no debe haber un `...body` al final del payload");
        assert.match(src, /ReportesApiError/);
    });
    it("el Excel de ingresos de usuario tampoco incluye el token", () => {
        const src = leer("utils/reports-functions/userLogin.ts");
        assert.equal(/\brow\.token\b,/.test(src), false, "el Excel no debe escribir row.token");
        assert.match(src, /tokenRef\(/);
    });
    it("la ruta responde con el código HTTP del error de acceso", () => {
        assert.match(leer("app/api/reportes/route.ts"), /ReportesApiError/);
    });
});
