import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const policy = require("../../mobile/plugins/androidSecurityPolicy.js");

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8");
const manifest = () => leer("android/app/src/main/AndroidManifest.xml");

/** Permisos ACTIVOS del manifiesto (los marcados `tools:node="remove"` están quitados). */
function permisosActivos(xml: string): string[] {
    return [...xml.matchAll(/<uses-permission\s+([^>]*?)\/>/g)]
        .filter((m) => !/tools:node="remove"/.test(m[1]!))
        .map((m) => /android:name="([^"]+)"/.exec(m[1]!)![1]!);
}
function permisosQuitados(xml: string): string[] {
    return [...xml.matchAll(/<uses-permission\s+([^>]*?)\/>/g)]
        .filter((m) => /tools:node="remove"/.test(m[1]!))
        .map((m) => /android:name="([^"]+)"/.exec(m[1]!)![1]!);
}
const permitidos: { permission: string; funcion: string; cuando: string }[] = JSON.parse(leer("android-permissions.json")).permitidos;

describe("permisos de Android (issue #180)", () => {
    it("el manifiesto no tiene ningún permiso activo que no esté en la lista permitida y justificada", () => {
        const lista = permitidos.map((p) => p.permission);
        const sinJustificar = permisosActivos(manifest()).filter((p) => !lista.includes(p));
        assert.deepEqual(sinJustificar, []);
    });
    it("cada permiso permitido dice qué función lo usa y cuándo se pide", () => {
        for (const p of permitidos) {
            assert.ok(p.funcion.trim().length > 10, `${p.permission}: falta la función`);
            assert.ok(p.cuando.trim().length > 5, `${p.permission}: falta cuándo se pide`);
        }
        assert.equal(new Set(permitidos.map((p) => p.permission)).size, permitidos.length, "hay permisos repetidos");
    });
    it("los permisos que la app no usa están quitados (SYSTEM_ALERT_WINDOW y el almacenamiento compartido)", () => {
        const xml = manifest();
        for (const p of policy.REMOVED_PERMISSIONS) {
            assert.equal(permisosActivos(xml).includes(p), false, `${p} sigue activo`);
            assert.ok(permisosQuitados(xml).includes(p), `${p} debe llevar tools:node="remove" para que tampoco entre por una librería`);
        }
        assert.match(xml, /xmlns:tools="http:\/\/schemas\.android\.com\/tools"/);
    });
    it("lo quitado y lo permitido no se cruzan", () => {
        const lista = permitidos.map((p) => p.permission);
        assert.deepEqual(policy.REMOVED_PERMISSIONS.filter((p: string) => lista.includes(p)), []);
    });
    it("el modo debug conserva su propio SYSTEM_ALERT_WINDOW (menú de desarrollo) y el de release no lo tiene", () => {
        assert.match(leer("android/app/src/debug/AndroidManifest.xml"), /SYSTEM_ALERT_WINDOW/);
        assert.equal(permisosActivos(manifest()).includes("android.permission.SYSTEM_ALERT_WINDOW"), false);
    });
    it("los permisos que pide app.config.js están todos en la lista permitida", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cfg = require("../../mobile/app.config.js")({ config: {} });
        const lista = permitidos.map((p) => p.permission);
        assert.deepEqual((cfg.expo.android.permissions as string[]).filter((p) => !lista.includes(p)), []);
    });
    it("los permisos sensibles se piden al usar la función, no al arrancar (cámara, micrófono, notificaciones)", () => {
        assert.match(leer("components/QRScannerModal.tsx"), /useCameraPermissions\(/);
        assert.match(leer("hooks/useAudioRecording.ts"), /requestRecordingPermissionsAsync\(/);
        assert.match(leer("hooks/pushNotificationsService.ts"), /requestPermissionsAsync\(/);
    });
});

describe("política que aplica el plugin sobre el manifiesto (issues #177 y #180)", () => {
    const base = () => ({
        manifest: {
            $: { "xmlns:android": "http://schemas.android.com/apk/res/android" } as Record<string, string>,
            "uses-permission": [
                { $: { "android:name": "android.permission.CAMERA" } },
                { $: { "android:name": "android.permission.SYSTEM_ALERT_WINDOW" } },
                { $: { "android:name": "android.permission.READ_EXTERNAL_STORAGE" } },
                { $: { "android:name": "android.permission.INTERNET" } },
            ],
            application: [{ $: { "android:allowBackup": "true" } as Record<string, string> }],
        },
    });
    it("quita los permisos sobrantes, agrega las marcas tools:node=remove y enlaza las reglas de backup", () => {
        const m: any = policy.applySecurityPolicyToManifest(base());
        const activos = m.manifest["uses-permission"].filter((p: any) => !p.$["tools:node"]).map((p: any) => p.$["android:name"]);
        assert.deepEqual(activos, ["android.permission.CAMERA", "android.permission.INTERNET"]);
        const quitados = m.manifest["uses-permission"].filter((p: any) => p.$["tools:node"] === "remove").map((p: any) => p.$["android:name"]).sort();
        assert.deepEqual(quitados, [...policy.REMOVED_PERMISSIONS].sort());
        assert.equal(m.manifest.$["xmlns:tools"], "http://schemas.android.com/tools");
        assert.deepEqual([m.manifest.application[0].$["android:fullBackupContent"], m.manifest.application[0].$["android:dataExtractionRules"]], ["@xml/backup_rules", "@xml/data_extraction_rules"]);
        assert.equal(m.manifest.application[0].$["android:allowBackup"], "true"); // lo existente se conserva
    });
    it("es idempotente: aplicarla dos veces no duplica nada", () => {
        const una = JSON.stringify(policy.applySecurityPolicyToManifest(base()));
        const dos = JSON.stringify(policy.applySecurityPolicyToManifest(JSON.parse(una)));
        assert.equal(dos, una);
    });
    it("un manifiesto sin permisos ni application tampoco rompe", () => {
        const m: any = policy.applySecurityPolicyToManifest({ manifest: {} });
        assert.equal(m.manifest["uses-permission"].length, policy.REMOVED_PERMISSIONS.length);
    });
});

describe("reglas de exclusión de backup (issue #177)", () => {
    it("excluyen todos los dominios con datos de la app en el backup en la nube y en la transferencia entre equipos", () => {
        const doms = policy.BACKUP_EXCLUDED_DOMAINS as string[];
        assert.ok(["file", "database", "sharedpref"].every((d) => doms.includes(d)), "SecureStore (sharedpref), AsyncStorage (database) y los archivos deben quedar fuera");
        const nube = policy.buildDataExtractionRulesXml() as string;
        assert.match(nube, /<cloud-backup>[\s\S]*<\/cloud-backup>/);
        assert.match(nube, /<device-transfer>[\s\S]*<\/device-transfer>/);
        const viejo = policy.buildFullBackupContentXml() as string;
        for (const d of doms) for (const xml of [nube, viejo]) assert.match(xml, new RegExp(`<exclude domain="${d}" path="\\." />`), d);
        for (const xml of [nube, viejo]) assert.equal(/<include\b/.test(xml), false, "no se incluye nada explícitamente");
    });
    it("el manifiesto enlaza las reglas y los archivos referenciados existen con el contenido que genera la política", () => {
        const xml = manifest();
        assert.match(xml, /android:fullBackupContent="@xml\/backup_rules"/);
        assert.match(xml, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
        for (const [nombre, build] of Object.entries(policy.BACKUP_FILES) as [string, () => string][]) {
            const f = path.join(mobile, "android/app/src/main/res/xml", nombre);
            assert.ok(fs.existsSync(f), `${nombre} no existe`);
            assert.equal(fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n"), build());
        }
    });
    it("el plugin está registrado en app.config.js (así sobrevive a expo prebuild) y existe", () => {
        assert.match(leer("app.config.js"), /\.\/plugins\/withAndroidSecurityPolicy\.js/);
        assert.ok(fs.existsSync(path.join(mobile, "plugins/withAndroidSecurityPolicy.js")));
        assert.match(leer("plugins/withAndroidSecurityPolicy.js"), /withAndroidManifest/);
        assert.match(leer("plugins/withAndroidSecurityPolicy.js"), /withDangerousMod/);
    });
});
