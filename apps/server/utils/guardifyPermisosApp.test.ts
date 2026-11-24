import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { eventBus } from "../../mobile/hooks/eventBus";
import { classifyAttendanceLoadError } from "../../mobile/hooks/attendanceLoadError";
import {
    DENIAL_MEMORY_MS,
    NOTICE_COOLDOWN_MS,
    PERMISSION_DENIED_EVENT,
    denialKey,
    deniedResponse,
    notifyIfPermissionDenied,
    permissionFromBody,
    recentDenial,
    rememberDenial,
    resetPermissionDenials,
    shouldNotify,
} from "../../mobile/hooks/permissionDeniedNotice";

const server = path.resolve(__dirname, "..");
const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8").replace(/\r\n/g, "\n");

const respuesta403 = (message: string) => new Response(JSON.stringify({ status: false, expired: false, message }), { status: 403 });

describe("permisos de Guardify en la app: aviso y cola sin conexión", () => {
    beforeEach(() => resetPermissionDenials());

    it("saca el permiso del mensaje del servidor", () => {
        assert.equal(permissionFromBody({ message: "permission_denied|bitacora.registro-de-personas" }), "bitacora.registro-de-personas");
        assert.equal(permissionFromBody({ message: "otra cosa" }), null);
        assert.equal(permissionFromBody(null), null);
    });

    it("una escritura denegada se recuerda y no se reenvía durante un rato, y luego se vuelve a intentar", () => {
        const key = denialKey("POST", "https://api/api/visitors", '{"a":1}');
        assert.ok(key);
        assert.equal(recentDenial(key), null);
        rememberDenial(key, "bitacora.registro-de-personas", 1_000);
        assert.deepEqual(recentDenial(key, 1_000 + 60_000), { permission: "bitacora.registro-de-personas" });
        assert.equal(recentDenial(key, 1_000 + DENIAL_MEMORY_MS + 1), null, "pasado el tiempo, la acción se reintenta (por si ya le dieron el permiso)");
        // otra acción distinta de la misma pantalla no queda frenada
        assert.equal(recentDenial(denialKey("POST", "https://api/api/visitors", '{"a":2}'), 1_000 + 60_000), null);
    });

    it("solo se frenan escrituras identificables: las lecturas y los cuerpos que no son texto no", () => {
        assert.equal(denialKey("GET", "https://api/api/visitors", null), null);
        assert.equal(denialKey("POST", "https://api/api/visitors", { parts: [] }), null);
        assert.ok(denialKey("PUT", "https://api/api/x", null, "abc-123"), "con clave de idempotencia sí");
    });

    it("el aviso sale una vez por permiso y por minuto", () => {
        const T0 = 1_700_000_000_000;
        assert.equal(shouldNotify("a.b", T0), true);
        assert.equal(shouldNotify("a.b", T0 + NOTICE_COOLDOWN_MS - 1), false);
        assert.equal(shouldNotify("c.d", T0 + 5), true, "otro permiso avisa por separado");
        assert.equal(shouldNotify("a.b", T0 + NOTICE_COOLDOWN_MS + 1), true);
    });

    it("un 403 de permiso avisa a la app y recuerda la acción; otro 403 no", async () => {
        const eventos: unknown[] = [];
        const onDenied = (p: unknown) => eventos.push(p);
        eventBus.on(PERMISSION_DENIED_EVENT, onDenied);
        try {
            const req = { method: "POST", url: "https://api/api/visitors", body: '{"x":1}' };
            await notifyIfPermissionDenied(respuesta403("permission_denied|bitacora.registro-de-personas"), req);
            assert.deepEqual(eventos, [{ permission: "bitacora.registro-de-personas" }]);
            assert.ok(recentDenial(denialKey(req.method, req.url, req.body)));

            resetPermissionDenials();
            await notifyIfPermissionDenied(respuesta403("Token inválido"), req);
            await notifyIfPermissionDenied(new Response("{}", { status: 500 }), req);
            assert.equal(eventos.length, 1, "un 403 de sesión o un 500 no son falta de permiso");
            assert.equal(recentDenial(denialKey(req.method, req.url, req.body)), null);
        } finally {
            eventBus.off(PERMISSION_DENIED_EVENT, onDenied);
        }
    });

    it("la respuesta que se da sin salir a la red es la misma que daría el servidor y la app la reconoce como falta de permiso", async () => {
        const r = deniedResponse("bitacora.visitas-de-vehiculos");
        assert.equal(r.status, 403);
        const body = await r.json();
        assert.equal(body.message, "permission_denied|bitacora.visitas-de-vehiculos");
        assert.equal(body.code, "permission_denied");
    });

    it("el fetch global frena la acción denegada y avisa; la pantalla de Marcar no confunde la falta de permiso con una sesión vencida", () => {
        const f = leer(mobile, "hooks/installEvidenceFetch.ts");
        assert.match(f, /const blocked = recentDenial\(key\);\s*if \(blocked\) return deniedResponse\(blocked\.permission\);/);
        assert.match(f, /if \(response\.status === 403\) void notifyIfPermissionDenied\(response,/);
        const app = leer(mobile, "App.tsx");
        assert.match(app, /eventBus\.on\(PERMISSION_DENIED_EVENT, onPermissionDenied\);/);
        assert.match(app, /Alert\.alert\('Sin permiso', PERMISSION_DENIED_MESSAGE\)/);

        const info = classifyAttendanceLoadError({ stage: "respuesta_http", httpStatus: 403, serverCode: "permission_denied" });
        assert.equal(info.code, "SIN-PERMISO");
        assert.equal(classifyAttendanceLoadError({ stage: "respuesta_http", httpStatus: 403 }).code, "SESION");
        const pantalla = leer(mobile, "screens/MarcarIngresoSalidaScreen.tsx");
        assert.match(pantalla, /isPermissionDeniedPayload\(errorBody\) \? 'permission_denied'/);
    });
});

describe("rutas del servidor con permisos de Guardify (regresión de #210)", () => {
    it("modules-release valida con una condición simple: el operador coma hacía que todos recibieran 403", () => {
        const ruta = leer(server, "app/api/modules-release/[id]/route.ts");
        assert.match(ruta, /const superAdmin = await isAdminFor\(req, empleadoId, "administracion\.visibilidad-de-modulos"\);\s*if \(!superAdmin\) \{/);
    });

    it("ninguna ruta usa una condición con coma como `if (!x, \"...\")`", () => {
        const malas: string[] = [];
        (function walk(dir: string) {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) walk(p);
                else if (/\.tsx?$/.test(e.name) && /\bif\s*\(\s*!?\s*[A-Za-z_][\w.]*\s*,\s*["'`]/.test(fs.readFileSync(p, "utf8"))) malas.push(path.relative(server, p));
            }
        })(path.join(server, "app"));
        assert.deepEqual(malas, []);
    });

    it("reportes/create.ts llama a authorizeReportesOperation con los dos argumentos que recibe", () => {
        const create = leer(server, "app/api/reportes/create.ts");
        assert.match(create, /authorizeReportesOperation\(op, \{\s*empleadoId: auth\.empleadoId,\s*isAdmin: \(\) => isAdminFor\(req, auth\.empleadoId, PERM_REGISTROS_DE_OTROS\),\s*\}\);/);
    });
});
