import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { evaluateAppVersion, isForceEnabled, isVersionGateExempt, normalizeAppVersion } from "./appVersionGate";

const on = { APP_LAST_VERSION: "1.0.5", FORCE_APP_LAST_VERSION: "true" };
const req = (over: Partial<Parameters<typeof evaluateAppVersion>[0]> = {}) => evaluateAppVersion({ pathname: "/api/attendance/user/3", method: "GET", headerVersion: "1.0.5", env: on, ...over });

describe("control de versión de la app (middleware)", () => {
    it("apagado por defecto: sin FORCE_APP_LAST_VERSION o sin APP_LAST_VERSION no bloquea nada", () => {
        assert.equal(req({ env: {}, headerVersion: null }).blocked, false);
        assert.equal(req({ env: { APP_LAST_VERSION: "1.0.5" }, headerVersion: "0.0.1" }).blocked, false);
        assert.equal(req({ env: { FORCE_APP_LAST_VERSION: "true" }, headerVersion: "0.0.1" }).blocked, false);
        assert.equal(req({ env: { APP_LAST_VERSION: "1.0.5", FORCE_APP_LAST_VERSION: "false" }, headerVersion: "0.0.1" }).blocked, false);
    });

    it("la versión exigida pasa y cualquier otra recibe 426 con el mensaje y la versión requerida", () => {
        assert.equal(req().blocked, false);
        assert.equal(req({ headerVersion: " v1.0.5 " }).blocked, false);
        for (const v of ["1.0.4", "1.0.6", "", null, undefined]) {
            const r = req({ headerVersion: v });
            assert.equal(r.blocked, true, String(v));
            if (r.blocked) {
                assert.equal(r.status, 426);
                assert.equal(r.body.update_required, true);
                assert.equal(r.body.required_version, "1.0.5");
                assert.match(r.body.message, /versión 1\.0\.5/);
            }
        }
    });

    it("la versión también puede venir en la URL (imágenes, audios y enlaces que no mandan cabeceras)", () => {
        assert.equal(req({ headerVersion: null, queryVersion: "1.0.5" }).blocked, false);
        assert.equal(req({ headerVersion: null, queryVersion: "1.0.4" }).blocked, true);
    });

    it("la consulta y la descarga de la última versión quedan exentas, también sin versión", () => {
        for (const p of ["/api/mobile-versions", "/api/mobile-versions/", "/api/mobile-versions/1.0.5"]) {
            assert.equal(req({ pathname: p, headerVersion: null }).blocked, false, p);
        }
        assert.equal(req({ pathname: "/api/mobile-versionsX", headerVersion: null }).blocked, true, "solo esa ruta, no las que empiezan igual");
    });

    it("OPTIONS y las llamadas internas o de Guardify no se bloquean; el resto sí", () => {
        assert.equal(isVersionGateExempt("/api/auth/login", "OPTIONS"), true);
        assert.equal(isVersionGateExempt("/api/dynamic-prisma", "POST"), true);
        assert.equal(isVersionGateExempt("/api/dynamic-prisma/files", "GET"), true);
        assert.equal(isVersionGateExempt("/api/guardify/reports", "GET"), true);
        for (const p of ["/api/auth/login", "/api/server-time", "/api/attendance/1", "/api/uploads/x"]) assert.equal(isVersionGateExempt(p, "POST"), false, p);
        assert.equal(req({ pathname: "/api/auth/login", method: "POST", headerVersion: null }).blocked, true);
    });

    it("lee la bandera y normaliza versiones", () => {
        for (const v of ["true", "1", "on", "YES", "sí"]) assert.equal(isForceEnabled(v), true, v);
        for (const v of ["", "false", "0", "off", undefined]) assert.equal(isForceEnabled(v), false, String(v));
        assert.equal(normalizeAppVersion(" V1.0.5"), "1.0.5");
    });

    it("el middleware usa el control y conserva las cabeceras CORS también en la respuesta de bloqueo", () => {
        const src = fs.readFileSync(path.resolve(__dirname, "..", "middleware.ts"), "utf8").replace(/\r\n/g, "\n");
        assert.match(src, /evaluateAppVersion\(/);
        assert.match(src, /if \(gate\.blocked\) return withCorsHeaders\(/);
        assert.match(src, /x-app-version/);
    });

    it("las rutas de versiones no piden token y el instalador se pide sin verificar sesión", () => {
        const lista = fs.readFileSync(path.resolve(__dirname, "..", "app", "api", "mobile-versions", "route.ts"), "utf8");
        const descarga = fs.readFileSync(path.resolve(__dirname, "..", "app", "api", "mobile-versions", "[version]", "route.ts"), "utf8");
        assert.equal(/verifyAccessTokenByApi/.test(lista) || /verifyAccessTokenByApi/.test(descarga), false);
        assert.match(descarga, /shouldVerifyAccessToken: false/);
    });
});

describe("middleware real: con FORCE_APP_LAST_VERSION apagada ya no hace falta la última versión", () => {
    const { NextRequest } = require("next/server") as typeof import("next/server");
    const { middleware } = require("../middleware") as typeof import("../middleware");

    const conEntorno = async <T>(env: { APP_LAST_VERSION?: string; FORCE_APP_LAST_VERSION?: string }, fn: () => T): Promise<T> => {
        const antes = { a: process.env.APP_LAST_VERSION, f: process.env.FORCE_APP_LAST_VERSION };
        for (const [k, v] of [["APP_LAST_VERSION", env.APP_LAST_VERSION], ["FORCE_APP_LAST_VERSION", env.FORCE_APP_LAST_VERSION]] as const) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
        try {
            return fn();
        } finally {
            if (antes.a === undefined) delete process.env.APP_LAST_VERSION; else process.env.APP_LAST_VERSION = antes.a;
            if (antes.f === undefined) delete process.env.FORCE_APP_LAST_VERSION; else process.env.FORCE_APP_LAST_VERSION = antes.f;
        }
    };
    const pide = (headers: Record<string, string> = {}, ruta = "/api/auth/login", method = "POST") =>
        middleware(new NextRequest(`http://localhost:3000${ruta}`, { method, headers }));

    it("FORCE_APP_LAST_VERSION=false (o sin definir) deja entrar con cualquier versión o sin versión", async () => {
        for (const force of ["false", "False", "0", "off", "no", "", undefined]) {
            await conEntorno({ APP_LAST_VERSION: "1.0.6", FORCE_APP_LAST_VERSION: force }, () => {
                for (const headers of [{}, { "x-app-version": "0.0.1" }, { "x-app-version": "1.0.5" }, { "x-app-version": "1.0.6" }]) {
                    const res = pide(headers);
                    assert.notEqual(res.status, 426, `FORCE=${String(force)} con ${JSON.stringify(headers)}`);
                    assert.equal(res.headers.get("access-control-allow-origin"), "*");
                }
            });
        }
    });

    it("FORCE_APP_LAST_VERSION=true exige exactamente la versión: otra o ninguna recibe 426, la correcta pasa", async () => {
        await conEntorno({ APP_LAST_VERSION: "1.0.6", FORCE_APP_LAST_VERSION: "true" }, async () => {
            assert.equal(pide({}).status, 426);
            assert.equal(pide({ "x-app-version": "1.0.5" }).status, 426);
            assert.notEqual(pide({ "x-app-version": "1.0.6" }).status, 426);
            const bloqueada = pide({ "x-app-version": "1.0.5" });
            assert.equal(bloqueada.headers.get("access-control-allow-origin"), "*", "la respuesta de bloqueo conserva CORS");
            const cuerpo = await bloqueada.json();
            assert.equal(cuerpo.update_required, true);
            assert.equal(cuerpo.required_version, "1.0.6");
            // consultar y descargar la última versión siguen disponibles aunque se exija otra
            assert.notEqual(pide({}, "/api/mobile-versions", "GET").status, 426);
            assert.notEqual(pide({}, "/api/mobile-versions/1.0.6", "GET").status, 426);
        });
    });

    it("la app no se bloquea a sí misma: ningún código del cliente decide por su cuenta cortar el acceso por versión", () => {
        const fs = require("node:fs") as typeof import("node:fs");
        const path = require("node:path") as typeof import("node:path");
        const aviso = fs.readFileSync(path.resolve(__dirname, "..", "..", "mobile", "components", "AppVersionNotice.tsx"), "utf8");
        assert.equal(/logout|disabled=\{!?isUpdate|bloque/i.test(aviso.replace(/disabled=\{state === 'checking'\}|disabled=\{downloading\}/g, "")), false);
    });
});
