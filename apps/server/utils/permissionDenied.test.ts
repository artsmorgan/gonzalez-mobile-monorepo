import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PERMISSION_DENIED_CODE, isPermissionDeniedPayload } from "../../mobile/hooks/permissionDenied";
import { classifyHttpFailure } from "../../mobile/hooks/apiFailure";

const leer = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

describe("403 por falta de permiso no cierra la sesión (issues #169 y #174)", () => {
    it("solo el código estable permission_denied cuenta como permiso insuficiente", () => {
        assert.equal(PERMISSION_DENIED_CODE, "permission_denied");
        assert.equal(isPermissionDeniedPayload({ status: false, message: "No tienes permiso", code: "permission_denied" }), true);
        for (const v of [null, undefined, "permission_denied", 403, [], {}, { code: "otro" }, { message: "No tienes permiso" }, { code: "device_not_approved" }, { code: "Permission_Denied" }]) {
            assert.equal(isPermissionDeniedPayload(v), false, JSON.stringify(v));
        }
    });
    it("authedFetch devuelve la respuesta (sin logout) ante un 403 permission_denied y mantiene el logout para los demás 401/403", () => {
        // Desde el issue #174 authedFetch decide con `classifyHttpFailure` (apiFailure.ts); `isPermissionDeniedPayload` y el clasificador deben coincidir.
        const src = leer("../mobile/hooks/authedFetch.ts");
        assert.match(src, /classifyHttpFailure\(/);
        // la excepción va antes del logout genérico
        assert.ok(src.indexOf("failure === 'permission_denied'") < src.indexOf("await logout();"));
        assert.match(src, /shouldCloseSession\(failure\)/);
        for (const payload of [{ code: "permission_denied" }, { code: "otro" }, { message: "permission_denied" }, null, [], "x"]) {
            assert.equal(classifyHttpFailure(403, payload) === "permission_denied", isPermissionDeniedPayload(payload), JSON.stringify(payload));
        }
    });
    it("el servidor marca el 403 de /api/reportes con ese código", () => {
        assert.match(leer("app/api/reportes/route.ts"), /code: "permission_denied"/);
    });
});
