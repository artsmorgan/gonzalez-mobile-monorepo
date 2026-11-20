import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";

// app.config.js sin las variables de Guardify: ninguna build sale encendida, apuntando a un Guardify ni con un cliente fijo.
const mobile = path.resolve(__dirname, "../../mobile");
const require_ = createRequire(__filename);
const VARS = ["EXPO_PUBLIC_GUARDIFY_ENABLED", "GUARDIFY_ENABLED", "EXPO_PUBLIC_GUARDIFY_URL", "GUARDIFY_URL", "EXPO_PUBLIC_GUARDIFY_COMPANY_CODE", "GUARDIFY_COMPANY_CODE"];

function extraWith(env: Record<string, string>) {
    const saved = Object.fromEntries(VARS.map((k) => [k, process.env[k]]));
    for (const k of VARS) delete process.env[k];
    Object.assign(process.env, env);
    try {
        const file = path.join(mobile, "app.config.js");
        delete require_.cache[require_.resolve(file)];
        const cfg = require_(file)({ config: {} });
        return (cfg.expo ?? cfg).extra as Record<string, unknown>;
    } finally {
        for (const k of VARS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }
}

describe("app.config.js · Guardify sin valores por defecto", () => {
    it("sin variables: apagado, sin URL y sin código de empresa", () => {
        const e = extraWith({});
        assert.equal(e.GUARDIFY_ENABLED, "");
        assert.equal(e.GUARDIFY_URL, "");
        assert.equal(e.GUARDIFY_COMPANY_CODE, "");
    });
    it("lo que trae el perfil se respeta", () => {
        const e = extraWith({ EXPO_PUBLIC_GUARDIFY_ENABLED: "true", EXPO_PUBLIC_GUARDIFY_URL: "https://guardify.example", EXPO_PUBLIC_GUARDIFY_COMPANY_CODE: "empresa-x" });
        assert.deepEqual([e.GUARDIFY_ENABLED, e.GUARDIFY_URL, e.GUARDIFY_COMPANY_CODE], ["true", "https://guardify.example", "empresa-x"]);
    });
    it("solo el perfil guardify-pruebas enciende Guardify; los de producción y preview no", () => {
        const eas = JSON.parse(readFileSync(path.join(mobile, "eas.json"), "utf8")).build as Record<string, { env?: Record<string, string> }>;
        const on = Object.entries(eas).filter(([, p]) => p.env?.EXPO_PUBLIC_GUARDIFY_ENABLED === "true").map(([k]) => k);
        assert.deepEqual(on, ["guardify-pruebas"]);
        assert.ok(eas["guardify-pruebas"]!.env!.EXPO_PUBLIC_GUARDIFY_URL, "el perfil de pruebas trae su URL");
    });
});
