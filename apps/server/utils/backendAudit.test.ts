import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { collectRouteFacts } from "../scripts/auditRoutes";
import { buildErrorLogRow, MAX_ERROR_MESSAGE_CHARS, redactSecrets } from "./errorLogRow";
import { OBJECT_FORBIDDEN_MESSAGE, authorizeMarcaAccess, authorizeSelfOrAdmin, denialBody, isDevRouteEnabled } from "./objectAccess";
import { analyzeRoute, stripComments, unauthenticatedDirectDb, verifiesCaller } from "./routeAudit";

const server = path.resolve(__dirname, "..");
const leer = (rel: string) => fs.readFileSync(path.join(server, rel), "utf8");

// Dos usuarios de distinto alcance (solo identificadores estructurales, sin datos de negocio).
const USUARIO_A = 101;
const USUARIO_B = 202;
const ADMIN = 999;
const esAdmin = (id: number) => async () => id === ADMIN;

describe("autorización por objeto: dos usuarios de distinto alcance (issue #181)", () => {
    it("el propio usuario accede a sí mismo; el otro recibe 403 `permission_denied` sin que se consulte al administrador", async () => {
        assert.deepEqual(await authorizeSelfOrAdmin({ callerId: USUARIO_A, targetId: USUARIO_A }), { allowed: true });
        let consultado = false;
        const d = await authorizeSelfOrAdmin({ callerId: USUARIO_B, targetId: USUARIO_A, isAdmin: async () => { consultado = true; return false; } });
        assert.equal(d.allowed, false);
        if (!d.allowed) {
            assert.equal(d.status, 403);
            assert.deepEqual(denialBody(d), { status: false, code: "permission_denied", message: OBJECT_FORBIDDEN_MESSAGE });
        }
        assert.equal(consultado, true, "solo consulta al administrador cuando es otra persona");
        let consultadoSelf = false;
        await authorizeSelfOrAdmin({ callerId: USUARIO_A, targetId: USUARIO_A, isAdmin: async () => { consultadoSelf = true; return true; } });
        assert.equal(consultadoSelf, false);
    });
    it("el administrador accede a cualquiera; si no se puede comprobar si lo es, se niega", async () => {
        assert.equal((await authorizeSelfOrAdmin({ callerId: ADMIN, targetId: USUARIO_A, isAdmin: esAdmin(ADMIN) })).allowed, true);
        assert.equal((await authorizeSelfOrAdmin({ callerId: USUARIO_B, targetId: USUARIO_A, isAdmin: async () => { throw new Error("BD caída"); } })).allowed, false);
        assert.equal((await authorizeSelfOrAdmin({ callerId: USUARIO_B, targetId: USUARIO_A })).allowed, false);
    });
    it("identificadores ausentes o raros se niegan", async () => {
        for (const bad of [undefined, null, "", "  ", "abc", "12abc", 0, -5, 1.5, Number.NaN, true, {}, []]) {
            assert.equal((await authorizeSelfOrAdmin({ callerId: bad, targetId: bad, isAdmin: async () => true })).allowed, false, `self ${JSON.stringify(bad)}`);
            assert.equal((await authorizeSelfOrAdmin({ callerId: USUARIO_A, targetId: bad, isAdmin: async () => true })).allowed, false, `target ${JSON.stringify(bad)}`);
        }
        assert.equal((await authorizeSelfOrAdmin({ callerId: "101", targetId: 101 })).allowed, true, "los ids numéricos en texto se aceptan (vienen de la URL)");
    });
    it("una marca es del titular o de quien lo reemplaza; de un tercero, 403; el administrador puede", async () => {
        const marca = { empleadoFijo_id: USUARIO_A, empleadoReemplaza_id: USUARIO_B };
        assert.equal((await authorizeMarcaAccess({ callerId: USUARIO_A, marca })).allowed, true);
        assert.equal((await authorizeMarcaAccess({ callerId: USUARIO_B, marca })).allowed, true);
        const ajena = { empleadoFijo_id: USUARIO_A, empleadoReemplaza_id: null };
        assert.equal((await authorizeMarcaAccess({ callerId: USUARIO_B, marca: ajena })).allowed, false);
        assert.equal((await authorizeMarcaAccess({ callerId: ADMIN, marca: ajena, isAdmin: esAdmin(ADMIN) })).allowed, true);
    });
    it("marca inexistente, sin dueños o con datos raros: se niega", async () => {
        for (const marca of [null, undefined, {}, { empleadoFijo_id: null, empleadoReemplaza_id: null }, { empleadoFijo_id: "x", empleadoReemplaza_id: 0 }]) {
            assert.equal((await authorizeMarcaAccess({ callerId: USUARIO_A, marca })).allowed, false, JSON.stringify(marca));
        }
        assert.equal((await authorizeMarcaAccess({ callerId: null, marca: { empleadoFijo_id: USUARIO_A } })).allowed, false);
    });
    it("las rutas de desarrollo se apagan solo en producción", () => {
        assert.equal(isDevRouteEnabled({ APP_MODE: "production" }), false);
        assert.equal(isDevRouteEnabled({ APP_MODE: " Production " }), false);
        for (const v of ["testing", "development", "", undefined]) assert.equal(isDevRouteEnabled({ APP_MODE: v }), true, String(v));
    });
});

/** Rutas que modifican o leen un objeto por ID y deben preguntar por el alcance ANTES de la primera operación de BD. */
const ROUTES_WITH_SCOPE: Array<{ file: string; guard: RegExp; before: RegExp }> = [
    { file: "app/api/check-permissions/route.ts", guard: /authorizeSelfOrAdmin\(/, before: /prisma\.c_empleado\.findUnique/ },
    { file: "app/api/attendance/user/[id]/route.ts", guard: /authorizeSelfOrAdmin\(/, before: /prisma\.|callDynamicPrisma\(/ },
    { file: "app/api/attendance/user/[id]/next/route.ts", guard: /authorizeSelfOrAdmin\(/, before: /prisma\.|callDynamicPrisma\(/ },
    { file: "app/api/attendance/[id]/route.ts", guard: /authorizeMarcaAccess\(/, before: /case "entrada":/ },
    { file: "app/api/attendance/[id]/revert-leaving/route.ts", guard: /authorizeMarcaAccess\(/, before: /prisma\.c_empleado\.findUnique/ },
    { file: "app/api/attendance/[id]/absent-reason/route.ts", guard: /authorizeMarcaAccess\(/, before: /prisma\.c_empleado\.findUnique/ },
    { file: "app/api/attendance/[id]/early-leaving/route.ts", guard: /authorizeSelfOrAdmin\(/, before: /prisma\.c_marca_dia\.findFirst/ },
    { file: "app/api/lunch-time/[id]/test-ending-time/route.ts", guard: /authorizeMarcaAccess\(/, before: /Date|toZonedTime\(/ },
    { file: "app/api/attendance/[id]/dev-create-marca/route.ts", guard: /authorizeSelfOrAdmin\(/, before: /callDynamicPrisma\(/ },
];

describe("las rutas con ID de objeto verifican alcance antes de leer o escribir (issue #181)", () => {
    for (const r of ROUTES_WITH_SCOPE) {
        it(r.file, () => {
            const code = stripComments(leer(r.file));
            const iGuard = code.search(r.guard);
            assert.ok(iGuard >= 0, "no llama al control de alcance");
            const iAfter = code.slice(iGuard).search(r.before);
            assert.ok(iAfter >= 0, "la prueba de orden no encontró la operación posterior (revisar la expresión)");
            assert.match(code, /verifyAccessTokenByApi\(/, "debe verificar la sesión");
            assert.match(code, /permission_denied|denialBody\(/, "el 403 lleva el código `permission_denied`");
        });
    }
    it("las rutas de desarrollo y de prueba están apagadas en producción", () => {
        for (const f of ["app/api/attendance/[id]/dev-create-marca/route.ts", "app/api/lunch-time/[id]/test-ending-time/route.ts"]) {
            const code = stripComments(leer(f));
            assert.match(code, /isDevRouteEnabled\(/, f);
            assert.ok(code.indexOf("isDevRouteEnabled(") < code.indexOf("verifyAccessTokenByApi("), "se apaga antes de gastar una verificación");
        }
    });
});

describe("ninguna ruta toca la base de datos sin verificar a quien llama (issue #181)", () => {
    const facts = collectRouteFacts();
    /** Públicas por diseño: la credencial es otra (contraseña, refresh token, token de recuperación) o no hay dato sensible. */
    const PUBLIC_BY_DESIGN = new Set([
        "auth/login", "auth/refresh-token", "auth/logout",
        "password/forgot-password", "password/check-recovery-password-token", "password/recover-password/[token]",
        "server-time",
        // Rutas internas del servidor que el repo ya decidió ignorar (se reenvían a la API dinámica, que exige MOBILE_ACCESS_TOKEN):
        "dynamic-prisma/auth/login", "dynamic-prisma/auth/logout", "dynamic-prisma/auth/refresh-token", "dynamic-prisma/reportes",
        // Sin código vivo (el cuerpo está comentado): ver el inventario.
        "physical-minute-agenda", "physical-minute-agenda/[id]", "physical-minute-agenda/corpo/[corpo_id]",
    ]);
    it("el inventario cubre todas las rutas y reconoce los mecanismos de autenticación", () => {
        assert.ok(facts.length >= 250);
        assert.ok(facts.filter(verifiesCaller).length >= 240);
    });
    it("toda ruta que usa Prisma directamente verifica la sesión (salvo las públicas por diseño)", () => {
        const offenders = unauthenticatedDirectDb(facts, PUBLIC_BY_DESIGN).map((f) => `${f.endpoint} [${f.methods.join(",")}]`);
        assert.deepEqual(offenders, []);
    });
    it("toda ruta sin verificación de sesión está en la lista de públicas por diseño", () => {
        const sinVerificar = facts.filter((f) => !verifiesCaller(f) && !PUBLIC_BY_DESIGN.has(f.endpoint)).map((f) => f.endpoint);
        assert.deepEqual(sinVerificar, []);
    });
    it("las rutas públicas por diseño que quedan no acceden a datos de negocio directamente", () => {
        for (const f of facts.filter((x) => PUBLIC_BY_DESIGN.has(x.endpoint) && !x.endpoint.startsWith("dynamic-prisma/"))) {
            assert.equal(f.directDb && f.writes && !["auth/refresh-token", "password/recover-password/[token]", "password/forgot-password"].includes(f.endpoint) && !f.endpoint.startsWith("auth/"), false, f.endpoint);
        }
    });
    it("las rutas de Guardify exigen la llave de servidor en cada manejador", () => {
        for (const f of ["utils/guardifyReports/dbStatus.ts", "utils/guardifyReports/evidenciaVerificacion.ts", "utils/guardifyReports/forms.ts", "utils/guardifyReports/handler.ts", "utils/guardifyReports/structure.ts", "utils/documentos/guardifyApi.ts"]) {
            assert.match(stripComments(leer(f)), /verifyGuardifyApiKey\(/, f);
        }
    });
    it("ninguna ruta pasa el cuerpo de la petición tal cual a una escritura de Prisma (asignación masiva)", () => {
        const passthrough = /(^|,)\s*data\s*(,|$)|\bdata\s*:\s*(body|data|await\s+(req|request)\.json\(\)|req\.body)\s*(,|$)/;
        const offenders: string[] = [];
        for (const f of facts) {
            const code = stripComments(leer(f.file));
            for (const m of code.matchAll(/prisma\.[A-Za-z_]+\.(create|createMany|update|updateMany|upsert)\(\s*\{([^]*?)\}\s*\)/g)) {
                if (passthrough.test(m[2]!.trim())) offenders.push(`${f.endpoint}: ${m[0].replace(/\s+/g, " ").slice(0, 80)}`);
            }
        }
        assert.deepEqual(offenders, []);
    });
    it("el analizador ignora el código comentado", () => {
        const f = analyzeRoute("app/api/x/route.ts", `export async function GET() {\n /* const v = verifyAccessTokenByApi(req); prisma.a.findMany() */\n // prisma.b.findMany()\n return 1; }`);
        assert.equal(f.auth.length, 0);
        assert.equal(f.directDb, false);
    });
    it("una ruta nueva que usa Prisma sin verificar sesión se detecta", () => {
        const f = analyzeRoute("app/api/nueva/route.ts", `export async function GET() { return prisma.c_empleado.findMany({}); }`);
        assert.equal(unauthenticatedDirectDb([f], new Set()).length, 1);
    });
});

describe("no se registran secretos en reportError ni en los logs (issue #181)", () => {
    const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.firma-de-prueba";
    it("redacta Bearer, Basic, JWT y pares clave=valor de credenciales", () => {
        const entradas = [
            `fallo con Authorization: Bearer abcdefghijkl123456`,
            `Basic dXN1YXJpbzpjbGF2ZQ== rechazado`,
            `token inválido ${JWT}`,
            `GET /api/x?token=abc123secreto&mobileAccessToken=otro-secreto&id=5`,
            `{"password":"mi clave","accessToken":"zzz","refreshToken":'yyy'}`,
            `password: hunter2, client_secret=abc`,
            `contraseña=superclave`,
        ];
        for (const e of entradas) {
            const out = redactSecrets(e);
            for (const s of ["abcdefghijkl123456", "dXN1YXJpbzpjbGF2ZQ", JWT, "abc123secreto", "otro-secreto", "mi clave", "zzz", "yyy", "hunter2", "superclave"]) assert.equal(out.includes(s), false, `${s} sobrevive en: ${out}`);
        }
        assert.match(redactSecrets("GET /api/x?token=abc&id=5"), /id=5/, "lo demás se conserva");
    });
    it("no altera los mensajes normales ni se rompe con entradas raras", () => {
        for (const m of ["Token de Planillas no encontrado", "Refresh token inválido", "Marca del dia no encontrada", "Error desconocido"]) assert.equal(redactSecrets(m), m);
        for (const v of [undefined, null, 5, {}, [], new Error("x"), { a: { password: "p" } }]) assert.doesNotThrow(() => redactSecrets(v));
        assert.equal(redactSecrets({ a: { password: "p" } }).includes('"p"'), false);
        assert.equal(redactSecrets(redactSecrets(`password=x`)), redactSecrets(`password=x`), "idempotente");
    });
    it("la fila guarda el mensaje REAL del error, el código HTTP y el usuario, con límites de tamaño", () => {
        const now = new Date(0);
        const row = buildErrorLogRow({ endpoint: "api/x", method: "PUT", status: 404, message: "No se encontró la marca (Bearer aaaaaaaaaaaa)", userId: 7, now });
        assert.deepEqual({ ...row, message: row.message.includes("aaaaaaaaaaaa") }, { endpoint: "api/x", method: "PUT", status_code: 404, message: false, user_id: 7, created_at: now });
        assert.match(row.message, /No se encontró la marca/);
        const sinUsuario = buildErrorLogRow({ endpoint: "e", method: "GET", status: "abc", message: "m", userId: null, now });
        assert.equal(sinUsuario.user_id, null);
        assert.equal(sinUsuario.status_code, null);
        assert.equal(buildErrorLogRow({ endpoint: "e".repeat(999), method: "METHODLONGER", status: 500, message: "x".repeat(10_000), userId: 1, now }).message.length, MAX_ERROR_MESSAGE_CHARS);
    });
    it("reportError usa la fila segura y no revienta con un token inválido ni al fallar el registro", () => {
        const src = stripComments(leer("utils/reportError.ts"));
        assert.match(src, /buildErrorLogRow\(/);
        assert.equal(/user_id:\s*payload\.id/.test(src), false, "ya no desreferencia payload sin comprobar");
        assert.match(src, /catch \(e\)/);
    });
    it("ningún console.* del servidor imprime cabeceras, contraseñas o tokens como variable", () => {
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
                if (!/\.ts$/.test(e.name) || /\.test\.ts$/.test(e.name)) continue;
                const code = stripComments(fs.readFileSync(p, "utf8"));
                for (const m of code.matchAll(/console\.(?:log|error|warn|info)\(([^;]*?)\);?\s*$/gm)) {
                    const args = m[1]!.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
                    if (/\b(headers|authorization|password|passwd|contrasena|secret|refreshToken|accessToken|mobileAccessToken|planillasToken|cookie)\b/i.test(args)) {
                        offenders.push(`${path.relative(server, p)}: ${m[0].trim().slice(0, 110)}`);
                    }
                }
            }
        };
        walk(path.join(server, "app"));
        walk(path.join(server, "utils"));
        assert.deepEqual(offenders, []);
    });
});
