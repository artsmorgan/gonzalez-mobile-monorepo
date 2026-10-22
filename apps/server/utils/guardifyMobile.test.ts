import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    apkFileName,
    batteryPercent,
    commandEffect,
    compareVersions,
    decideUpdate,
    gateScreenFor,
    isGateOpen,
    normalizeCompanyCode,
    renewDue,
    resolveGuardifyConfig,
} from "../../mobile/hooks/guardifyLogic";
import { describeDeviceStatus } from "../../mobile/hooks/deviceNotApproved";
import { compararVersiones } from "./guardifyDevices";

describe("versiones", () => {
    it("compara numéricamente y coincide con la regla del servidor", () => {
        assert.ok(compareVersions("1.0.9", "1.0.10") < 0);
        assert.ok(compareVersions("1.2", "1.1.9") > 0);
        assert.equal(compareVersions("1.0", "1.0.0"), 0);
        for (const [a, b] of [["1.0.2", "1.0.10"], ["2.0", "1.9.9"], ["1.0.0", "1.0"]] as const) {
            assert.equal(Math.sign(compareVersions(a, b)), Math.sign(compararVersiones(a, b)));
        }
    });
    it("decide si la actualización es obligatoria o solo opcional", () => {
        const apk = { version: "1.0.5", downloadUrl: "https://g/apk/1" };
        assert.deepEqual(
            { r: decideUpdate("1.0.2", { minAppVersion: "1.0.4", latest: apk }).required, a: decideUpdate("1.0.2", { minAppVersion: "1.0.4", latest: apk }).available },
            { r: true, a: true },
        );
        const opcional = decideUpdate("1.0.4", { minAppVersion: "1.0.4", latest: apk });
        assert.deepEqual([opcional.required, opcional.available, opcional.version], [false, true, "1.0.5"]);
        const alDia = decideUpdate("1.0.5", { minAppVersion: null, latest: apk });
        assert.deepEqual([alDia.required, alDia.available], [false, false]);
        // sin catálogo (o sin APK subido) no hay nada que ofrecer, pero una mínima sí obliga
        assert.deepEqual([decideUpdate("1.0.0", null).required, decideUpdate("1.0.0", null).available], [false, false]);
        assert.equal(decideUpdate("1.0.0", { minAppVersion: "1.0.1", latest: null }).required, true);
    });
});

describe("configuración", () => {
    it("queda apagada sin URL y toma valores por defecto", () => {
        assert.equal(resolveGuardifyConfig({}, "lite").enabled, false);
        assert.equal(resolveGuardifyConfig(undefined, "prod").enabled, false);
        const c = resolveGuardifyConfig({ GUARDIFY_URL: "https://guardify.test///", GUARDIFY_COMPANY_CODE: "  Corporacion-Gonzalez " }, "prod");
        assert.deepEqual([c.enabled, c.baseUrl, c.appKey, c.companyCode, c.variant], [true, "https://guardify.test", "monitoreapp", "corporacion-gonzalez", "prod"]);
    });
    it("normaliza el código de empresa", () => {
        assert.equal(normalizeCompanyCode("  ABC "), "abc");
        assert.equal(normalizeCompanyCode(undefined), "");
    });
});

describe("pantallas de estado", () => {
    const sinActualizar = { needsCode: false, updateRequired: false };
    it("deja usar la app con el equipo habilitado", () => {
        for (const state of [{ kind: "signed_out" }, { kind: "operational", online: true }, { kind: "operational", online: false }] as const) {
            assert.equal(gateScreenFor(state, sinActualizar), null);
            assert.equal(isGateOpen(state), true);
        }
    });
    it("sin registrar: pide el código solo si la build no lo trae", () => {
        assert.equal(gateScreenFor({ kind: "unregistered" }, { needsCode: true, updateRequired: false })!.mode, "register");
        assert.equal(gateScreenFor({ kind: "unregistered" }, sinActualizar)!.mode, "status");
    });
    it("cada estado del SDK tiene su pantalla", () => {
        const s = (k: Parameters<typeof gateScreenFor>[0]) => gateScreenFor(k, sinActualizar)!;
        assert.deepEqual([s({ kind: "pending" }).status, s({ kind: "pending" }).canRetry], ["PENDING", true]);
        assert.deepEqual([s({ kind: "rejected", reason: "duplicado" }).status, s({ kind: "rejected", reason: "duplicado" }).reason, s({ kind: "rejected" }).canRetry], ["REJECTED", "duplicado", false]);
        assert.deepEqual([s({ kind: "blocked", reason: "perdido" }).status, s({ kind: "blocked", reason: "perdido" }).reason], ["BLOCKED", "perdido"]);
        assert.equal(s({ kind: "retired" }).status, "RETIRED");
        const locked = s({ kind: "locked", reason: "offline" });
        assert.deepEqual([locked.status, locked.canRetry, typeof locked.message], ["LOCKED", true, "string"]);
        assert.equal(isGateOpen({ kind: "pending" }), false);
    });
    it("una versión obligatoria pasa por encima de cualquier estado", () => {
        assert.equal(gateScreenFor({ kind: "operational", online: true }, { needsCode: false, updateRequired: true })!.mode, "update");
        assert.equal(gateScreenFor({ kind: "blocked" }, { needsCode: false, updateRequired: true })!.mode, "update");
    });
});

describe("versión obligatoria desde el servidor", () => {
    it("el 403 UPDATE_REQUIRED se explica como actualización, no como bloqueo", () => {
        const info = describeDeviceStatus("UPDATE_REQUIRED", "Actualiza la app a la versión 1.0.4 o posterior.");
        assert.deepEqual([info.title, info.canRetry, info.body], ["Actualiza la app", false, "Actualiza la app a la versión 1.0.4 o posterior."]);
        assert.match(describeDeviceStatus("UPDATE_REQUIRED", null).body, /versión más reciente/);
    });
});

describe("órdenes de la consola", () => {
    it("cierra la sesión con LOGOUT_ALL y con LOGOUT_USER solo si es la persona con sesión", () => {
        assert.equal(commandEffect("LOGOUT_ALL", {}, "1-0000-0000"), "logout");
        assert.equal(commandEffect("LOGOUT_USER", { externalUserId: "1-0000-0000" }, "1-0000-0000"), "logout");
        assert.equal(commandEffect("LOGOUT_USER", { externalUserId: "9-9999-9999" }, "1-0000-0000"), "none");
        assert.equal(commandEffect("LOGOUT_USER", { externalUserId: "1-0000-0000" }, null), "none");
    });
    it("WIPE borra, FORCE_UPDATE revisa el catálogo y PING solo se confirma", () => {
        assert.equal(commandEffect("WIPE", {}, null), "wipe");
        assert.equal(commandEffect("force_update", {}, null), "check_update");
        assert.equal(commandEffect("PING", {}, null), "none");
        assert.equal(commandEffect("OTRA", null, null), "none");
    });
});

describe("renovación y latidos", () => {
    it("renueva al llegar a la mitad del permiso o cuando queda menos de un minuto", () => {
        const base = { leaseMs: 15 * 60_000, now: 1_000_000 };
        assert.equal(renewDue({ ...base, expMs: base.now + 14 * 60_000 }), false);
        assert.equal(renewDue({ ...base, expMs: base.now + 7 * 60_000 }), true);
        assert.equal(renewDue({ leaseMs: 60_000, now: 0, expMs: 50_000 }), true);
        assert.equal(renewDue({ leaseMs: 60_000, now: 0, expMs: 90_000 }), false);
        assert.equal(renewDue({ ...base, expMs: base.now - 1 }), true);
    });
    it("batería en porcentaje entero", () => {
        assert.equal(batteryPercent(0.876), 88);
        assert.equal(batteryPercent(1), 100);
        assert.equal(batteryPercent(-1), undefined);
        assert.equal(batteryPercent(NaN), undefined);
        assert.equal(batteryPercent(undefined), undefined);
    });
    it("nombre del APK sin caracteres raros", () => {
        assert.equal(apkFileName("prod", "1.0.5"), "MonitoreApp-prod-1.0.5.apk");
        assert.equal(apkFileName("li te", "1.0/5"), "MonitoreApp-lite-1.05.apk");
    });
});
