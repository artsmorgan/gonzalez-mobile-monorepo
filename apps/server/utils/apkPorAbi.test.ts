import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const splits = require("../../mobile/plugins/androidAbiSplits.js");
import { APK_ABIS as MOBILE_ABIS, pickApkAbi } from "../../mobile/hooks/apkAbi";
import { VERSION_CHECK_MIN_INTERVAL_MS, shouldCheckVersion } from "../../mobile/hooks/versionCheckThrottle";
import { SERVER_APK_ABIS, apkFileCandidates } from "./apkFiles";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const server = path.resolve(__dirname, "..");
const leer = (base: string, rel: string) => fs.readFileSync(path.join(base, rel), "utf8");

/** Fragmento mínimo con la forma del `android/app/build.gradle` que genera Expo (solo estructura, sin datos de negocio). */
const gradleBase = () => `android {
    defaultConfig {
        versionCode 1
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        release {
        }
    }
}
`;

describe("APK por arquitectura: plugin de Gradle (issue #179, H10)", () => {
    it("agrega splits por ABI con las arquitecturas de la lista y sin APK universal", () => {
        const out: string = splits.applyAbiSplitsToBuildGradle(gradleBase());
        assert.match(out, /splits\s*\{\s*abi\s*\{/);
        assert.match(out, /universalApk = false/);
        assert.match(out, /reset\(\)/);
        const incl = /include ([^\n]+)/.exec(out)![1]!;
        const abis = [...incl.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
        assert.deepEqual(abis, [...splits.APK_ABIS]);
    });
    it("queda dentro del bloque android { }", () => {
        const out: string = splits.applyAbiSplitsToBuildGradle(gradleBase());
        assert.ok(out.indexOf("splits {") > out.indexOf("android {"));
        assert.ok(out.indexOf("splits {") < out.lastIndexOf("}"));
    });
    it("es idempotente: aplicarlo dos veces no duplica el bloque", () => {
        const una = splits.applyAbiSplitsToBuildGradle(gradleBase());
        const dos = splits.applyAbiSplitsToBuildGradle(una);
        assert.equal(dos, una);
        assert.equal(dos.split("splits {").length - 1, 1);
    });
    it("un build.gradle sin signingConfigs tampoco rompe (se agrega al inicio de android { })", () => {
        const out: string = splits.applyAbiSplitsToBuildGradle("android {\n    defaultConfig {\n    }\n}\n");
        assert.match(out, /splits\s*\{\s*abi\s*\{/);
    });
    it("se puede apagar para desarrollo con -Papk.splitPerAbi=false", () => {
        assert.match(splits.applyAbiSplitsToBuildGradle(gradleBase()), /apk\.splitPerAbi/);
    });
    it("las arquitecturas nativas que se compilan son las mismas que se separan (no se compila x86 para tirarlo)", () => {
        assert.equal(splits.reactNativeArchitecturesValue(), [...splits.APK_ABIS].join(","));
    });
    it("el plugin está registrado en app.config.js (así sobrevive a expo prebuild)", () => {
        assert.match(leer(mobile, "app.config.js"), /\.\/plugins\/withAndroidAbiSplits\.js/);
        const plugin = leer(mobile, "plugins/withAndroidAbiSplits.js");
        assert.match(plugin, /withAppBuildGradle/);
        assert.match(plugin, /withGradleProperties/);
    });
    it("usa asignación (enable = …, universalApk = …) y no la sintaxis de método: el AGP de Expo 54 ya no la acepta (EAS: «Could not find method enable()»)", () => {
        const g = leer(mobile, "android/app/build.gradle");
        const out: string = splits.applyAbiSplitsToBuildGradle(gradleBase());
        for (const texto of [g, out]) {
            const bloque = /splits\s*\{\s*abi\s*\{([\s\S]*?)\}\s*\}/.exec(texto)![1]!;
            assert.match(bloque, /^\s*enable = /m);
            assert.match(bloque, /^\s*universalApk = (true|false)\s*$/m);
            assert.doesNotMatch(bloque, /^\s*enable\s*\(/m, "enable(...) como método falla en el AGP actual");
            assert.doesNotMatch(bloque, /^\s*universalApk\s+(true|false)/m, "universalApk false como método falla en el AGP actual");
        }
    });
    it("el build.gradle y gradle.properties commiteados salen de la misma política", () => {
        const g = leer(mobile, "android/app/build.gradle");
        assert.equal(splits.applyAbiSplitsToBuildGradle(g), g, "el build.gradle commiteado ya trae el bloque");
        assert.match(g, /universalApk = false/);
        assert.match(leer(mobile, "android/gradle.properties"), new RegExp(`^reactNativeArchitectures=${splits.reactNativeArchitecturesValue()}\\s*$`, "m"));
    });
});

describe("APK por arquitectura: el equipo elige su archivo (issue #179, H10)", () => {
    it("las listas de ABI del plugin, la app y el servidor coinciden", () => {
        assert.deepEqual([...MOBILE_ABIS], [...splits.APK_ABIS]);
        assert.deepEqual([...SERVER_APK_ABIS], [...splits.APK_ABIS]);
    });
    it("toma la primera arquitectura del equipo (orden de preferencia) que tenga APK", () => {
        assert.equal(pickApkAbi(["arm64-v8a", "armeabi-v7a", "armeabi"]), "arm64-v8a");
        assert.equal(pickApkAbi(["armeabi-v7a", "armeabi"]), "armeabi-v7a");
        assert.equal(pickApkAbi(["x86_64", "x86", "arm64-v8a"]), "x86_64");
        assert.equal(pickApkAbi(["x86", "armeabi-v7a"]), "armeabi-v7a");
    });
    it("sin arquitectura conocida devuelve null (se descarga el APK universal)", () => {
        for (const v of [undefined, null, "arm64-v8a", 7, {}, [], ["mips"], [null, 3, ""]]) assert.equal(pickApkAbi(v), null, JSON.stringify(v));
    });
    it("el servidor ofrece primero el APK de la arquitectura y luego el universal", () => {
        assert.deepEqual(apkFileCandidates("1.0.3", "arm64-v8a"), ["MonitoreApp-1.0.3-arm64-v8a.apk", "MonitoreApp-1.0.3.apk"]);
    });
    it("sin arquitectura, o con una que no existe, solo ofrece el universal (no es un error)", () => {
        assert.deepEqual(apkFileCandidates("1.0.3"), ["MonitoreApp-1.0.3.apk"]);
        for (const abi of ["", "mips", "ARM64-V8A", "../arm64-v8a", "arm64-v8a/../../x"]) assert.deepEqual(apkFileCandidates("1.0.3", abi), ["MonitoreApp-1.0.3.apk"], abi);
    });
    it("rechaza versiones que no son una versión (no se arma una ruta con ellas)", () => {
        for (const v of ["", "  ", "../1.0.3", "1.0.3/../../x", "a/b", "1.0.3\u0000", "1.0.3?x=1", "1 0", "..", "%2e%2e%2f"]) assert.equal(apkFileCandidates(v, "arm64-v8a"), null, JSON.stringify(v));
        assert.deepEqual(apkFileCandidates(" 1.0.3 ", "arm64-v8a")?.[0], "MonitoreApp-1.0.3-arm64-v8a.apk");
    });
    it("cableado: la ruta de descarga usa las candidatas y la pantalla manda su arquitectura", () => {
        const route = leer(server, "app/api/mobile-versions/[version]/route.ts");
        assert.match(route, /apkFileCandidates\(/);
        assert.equal(/MonitoreApp-\$\{versionTrim\}\.apk/.test(route), false, "la ruta no debe armar el nombre con la versión sin validar");
        const home = leer(mobile, "screens/HomeScreen.tsx");
        assert.match(home, /pickApkAbi\(/);
        assert.match(home, /abi=/);
    });
});

describe("sondeo de la versión disponible (issue #179, H10)", () => {
    const now = 1_800_000_000_000;
    it("no consulta si se consultó hace poco", () => {
        assert.equal(shouldCheckVersion({ lastCheckedAt: now - 60_000, now }), false);
        assert.equal(shouldCheckVersion({ lastCheckedAt: now - (VERSION_CHECK_MIN_INTERVAL_MS - 1), now }), false);
    });
    it("consulta al cumplirse el intervalo, si nunca se consultó o si el reloj no es confiable", () => {
        assert.equal(shouldCheckVersion({ lastCheckedAt: now - VERSION_CHECK_MIN_INTERVAL_MS, now }), true);
        assert.equal(shouldCheckVersion({ lastCheckedAt: null, now }), true);
        assert.equal(shouldCheckVersion({ lastCheckedAt: Number.NaN, now }), true);
        assert.equal(shouldCheckVersion({ lastCheckedAt: now + 3_600_000, now }), true, "una marca en el futuro no debe bloquear la consulta");
    });
    it("una consulta pedida explícitamente siempre se hace", () => {
        assert.equal(shouldCheckVersion({ lastCheckedAt: now, now, force: true }), true);
    });
    it("el intervalo es de al menos 15 minutos (antes se consultaba cada 60 s)", () => {
        assert.ok(VERSION_CHECK_MIN_INTERVAL_MS >= 15 * 60_000);
    });
    it("cableado: App.tsx consulta la versión solo cuando corresponde", () => {
        const app = leer(mobile, "App.tsx");
        assert.match(app, /shouldCheckVersion\(/);
        assert.match(app, /last_app_version_checked_at/);
    });
});
