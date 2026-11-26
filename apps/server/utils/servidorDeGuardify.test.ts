import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { decideServerChange, getPolicyServerUrl, normalizeServerUrl, parseAllowedHosts, resolveApiServer, sameServerUrl, setPolicyServerUrl } from "../../mobile/hooks/apiServerCore";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8").replace(/\r\n/g, "\n");

const BUILD = "https://api-gonzalez-mobile-monorepo-production.up.railway.app";
const PROD = "https://gonzalez-mobile-server-production.up.railway.app";
const HOSTS = ["gonzalez-mobile-server-production.up.railway.app", "api-gonzalez-mobile-monorepo-production.up.railway.app"];

describe("#214: la URL del servidor la entrega Guardify, validada contra una lista fija del build", () => {
    it("sin URL en la política, la app usa la del build tal como viene (igual que antes)", () => {
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: null, allowedHosts: HOSTS }), BUILD);
        assert.equal(resolveApiServer({ fallback: BUILD + "/", policyUrl: "", allowedHosts: HOSTS }), BUILD + "/");
        assert.equal(resolveApiServer({ fallback: "", policyUrl: undefined, allowedHosts: [] }), "");
    });

    it("con la URL de pruebas o de producción en la lista, la app la usa", () => {
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: PROD, allowedHosts: HOSTS }), PROD);
        assert.equal(resolveApiServer({ fallback: PROD, policyUrl: PROD + "/", allowedHosts: HOSTS }), PROD, "quita la barra final");
    });

    it("con un dominio que no está en la lista, la ignora y usa la del build", () => {
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: "https://servidor-ajeno.example.com", allowedHosts: HOSTS }), BUILD);
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: "https://gonzalez-mobile-server-production.up.railway.app.evil.com", allowedHosts: HOSTS }), BUILD);
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: "https://evil.com/gonzalez-mobile-server-production.up.railway.app", allowedHosts: HOSTS }), BUILD);
    });

    it("exige https y rechaza credenciales, parámetros y fragmentos", () => {
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: "http://gonzalez-mobile-server-production.up.railway.app", allowedHosts: HOSTS }), BUILD);
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: "https://user:clave@gonzalez-mobile-server-production.up.railway.app", allowedHosts: HOSTS }), BUILD);
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: PROD + "?x=1", allowedHosts: HOSTS }), BUILD);
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: "no es una url", allowedHosts: HOSTS }), BUILD);
    });

    it("sin lista (o vacía) la política nunca puede cambiar el servidor; con comodín solo valen los subdominios", () => {
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: PROD, allowedHosts: [] }), BUILD);
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: "https://api.gonzalez.cr", allowedHosts: ["*.gonzalez.cr"] }), "https://api.gonzalez.cr");
        assert.equal(resolveApiServer({ fallback: BUILD, policyUrl: "https://gonzalez.cr", allowedHosts: ["*.gonzalez.cr"] }), BUILD);
    });

    it("lee la lista del build separada por comas, sin espacios ni repetidos", () => {
        assert.deepEqual(parseAllowedHosts(" A.example.com , b.example.com,,a.example.com "), ["a.example.com", "b.example.com"]);
        assert.deepEqual(parseAllowedHosts(["X.com", " y.com "]), ["x.com", "y.com"]);
        assert.deepEqual(parseAllowedHosts(undefined), []);
        assert.deepEqual(parseAllowedHosts(""), []);
    });

    it("guarda en memoria la URL de la política y se puede quitar", () => {
        setPolicyServerUrl(PROD);
        assert.equal(getPolicyServerUrl(), PROD);
        setPolicyServerUrl(null);
        assert.equal(getPolicyServerUrl(), null);
    });
});

describe("#214: cuando cambia la URL del servidor, la app cierra la sesión y borra sus datos", () => {
    it("la barra final y las mayúsculas del dominio no cuentan como cambio", () => {
        assert.equal(sameServerUrl(PROD, PROD + "/"), true);
        assert.equal(sameServerUrl("https://API.Ejemplo.cr", "https://api.ejemplo.cr"), true);
        assert.equal(sameServerUrl(BUILD, PROD), false);
        assert.equal(normalizeServerUrl(null), "");
    });

    it("la primera vez (nada guardado) se compara con la del build: antes de esta versión la app siempre la usaba", () => {
        assert.equal(decideServerChange({ last: null, next: BUILD, buildUrl: BUILD }), "none");
        assert.equal(decideServerChange({ last: null, next: PROD, buildUrl: BUILD }), "switch");
        assert.equal(decideServerChange({ last: "  ", next: BUILD, buildUrl: BUILD }), "none");
    });

    it("con una URL guardada, solo cambia si la nueva es otra", () => {
        assert.equal(decideServerChange({ last: PROD, next: PROD + "/", buildUrl: BUILD }), "none");
        assert.equal(decideServerChange({ last: PROD, next: BUILD, buildUrl: BUILD }), "switch", "Guardify dejó de dar URL: vuelve a la del build");
        assert.equal(decideServerChange({ last: BUILD, next: PROD, buildUrl: BUILD }), "switch");
    });
});

describe("#214: en la app, un solo punto de lectura", () => {
    const archivos: string[] = [];
    (function walk(dir: string) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.isDirectory()) {
                if (!["node_modules", "android", "ios", "vendor", ".expo"].includes(e.name)) walk(path.join(dir, e.name));
            } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) archivos.push(path.join(dir, e.name));
        }
    })(mobile);

    it("ninguna pantalla ni módulo lee `extra.API_SERVER` directamente: todos usan `apiServer()`", () => {
        const directas = archivos
            .filter((f) => !/app\.config\.js$|utils[\\/]apiServer\.ts$/.test(f))
            .filter((f) => /expoConfig\??\.extra\??\.API_SERVER/.test(fs.readFileSync(f, "utf8").replace(/^\s*(\*|\/\/).*$/gm, "")))
            .map((f) => path.relative(mobile, f));
        assert.deepEqual(directas, []);
    });

    it("cada archivo que llama a `apiServer()` lo importa de `utils/apiServer`, con una ruta que existe", () => {
        let usan = 0;
        for (const f of archivos) {
            const s = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
            if (/utils[\\/]apiServer\.ts$/.test(f) || !/\bapiServer\(\)/.test(s.replace(/^\s*(\*|\/\/).*$/gm, ""))) continue;
            usan++;
            const m = /^import \{ apiServer(?:, [\w, ]+)? \} from '([^']+)';$/m.exec(s);
            assert.ok(m, `${path.relative(mobile, f)}: falta importar apiServer`);
            const destino = path.resolve(path.dirname(f), m![1]!);
            assert.ok(fs.existsSync(destino + ".ts"), `${path.relative(mobile, f)}: ${m![1]} no existe`);
        }
        assert.ok(usan >= 100, `archivos que usan apiServer(): ${usan}`);
    });

    it("los archivos que pasaron a `apiServer()` no dejan `Constants` importado sin usar", () => {
        for (const f of archivos) {
            const s = fs.readFileSync(f, "utf8");
            if (!/\bapiServer\(\)/.test(s) || !/^import Constants from ['"]expo-constants['"];?/m.test(s)) continue;
            const sinImport = s.replace(/^import Constants from ['"]expo-constants['"];?\r?\n/m, "");
            assert.match(sinImport, /\bConstants\b/, `${path.relative(mobile, f)}: importa Constants y no lo usa`);
        }
    });

    it("`apiServer()` valida con la lista fija del build y cae a la del build", () => {
        const u = leer("utils/apiServer.ts");
        assert.match(u, /resolveApiServer\(\{ fallback: buildApiServer\(\), policyUrl: getPolicyServerUrl\(\), allowedHosts: allowedServerHosts\(\) \}\)/);
        assert.match(u, /parseAllowedHosts\(extra\(\)\.ALLOWED_SERVER_HOSTS\)/);
    });

    it("la lista de dominios sale del build, no de la red", () => {
        const cfg = leer("app.config.js");
        assert.match(cfg, /ALLOWED_SERVER_HOSTS: resolveAllowedServerHosts\(/);
        assert.match(cfg, /EXPO_PUBLIC_ALLOWED_SERVER_HOSTS/);
        const eas = JSON.parse(leer("eas.json"));
        assert.equal(eas.build["production-prod"].env.EXPO_PUBLIC_ALLOWED_SERVER_HOSTS, "gonzalez-mobile-server-production.up.railway.app");
        assert.equal(eas.build["guardify-pruebas"].env.EXPO_PUBLIC_ALLOWED_SERVER_HOSTS, "api-gonzalez-mobile-monorepo-production.up.railway.app");
    });

    it("el servidor de desarrollo (trycloudflare) no es valor por defecto de ningún build", () => {
        for (const rel of ["app.config.js", "eas.json"]) assert.equal(/trycloudflare/.test(leer(rel)), false, rel);
        for (const f of archivos) {
            if (/\.test\./.test(f)) continue;
            assert.equal(/trycloudflare/.test(fs.readFileSync(f, "utf8")), false, path.relative(mobile, f));
        }
    });

    it("Guardify aplica la URL de la política antes de dejar pasar al inicio de sesión, y de nuevo cuando la política puede cambiar", () => {
        const g = leer("hooks/guardifyClient.ts");
        assert.match(g, /publishIdentity\(\);\s*await syncServerUrl\(\);/);
        assert.match(g, /setGuardifyIdentity\(\{ deviceId: client\?\.deviceId, sessionId: client\?\.session\?\.id \}\);\s*void syncServerUrl\(\);/);
        assert.match(g, /patch\(\{ sdk: dev\.state\(\) \}\);\s*void syncServerUrl\(\);/);
        assert.match(g, /const next = dev\.serverUrl\(\{ allowedHosts: allowedServerHosts\(\), fallback: build \}\);/);
    });

    it("sin equipo registrado (sin política) no se cambia nada", () => {
        const g = leer("hooks/guardifyClient.ts");
        assert.match(g, /const dev = client;\s*if \(!dev\?\.deviceId\) return;\s*const build = buildApiServer\(\);/);
    });

    it("al cambiar de servidor: primero cierra la sesión (todavía con el servidor anterior), luego borra los datos y guarda la URL nueva", () => {
        const g = leer("hooks/guardifyClient.ts");
        assert.match(
            g,
            /=== 'switch'\) \{[\s\S]*?await handlers\?\.logout\(\)\.catch\(\(\) => undefined\);[\s\S]*?await wipeAllLocalData\(\);\s*\}\s*setPolicyServerUrl\(sameServerUrl\(next, build\) \? null : next\);\s*await guardifyStorage\.set\(LAST_SERVER_URL_KEY, next\)/,
        );
    });

    it("la última URL se guarda donde el borrado de datos no la toca (llaves `guardify.`)", async () => {
        const { shouldKeepKeyOnWipe } = await import("../../mobile/hooks/guardifyWipe");
        assert.equal(shouldKeepKeyOnWipe("guardify.last_server_url"), true);
        const g = leer("hooks/guardifyClient.ts");
        assert.match(g, /const LAST_SERVER_URL_KEY = 'last_server_url';/);
    });

    it("las colas por organización usan el servidor vigente, no el del build", () => {
        const q = leer("hooks/installQueueOwnership.ts");
        assert.match(q, /const url = String\(apiServer\(\) \?\? ''\)\.trim\(\);/);
    });
});
