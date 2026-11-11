import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildWazeLinks, formatCoordinates, parseCoordinate, parsePuestoPoint } from "../../mobile/hooks/puestoLocation";
import { compareAppVersions, isNewerAppVersion } from "../../mobile/hooks/versionCompare";
import { parseUpdateRequired } from "../../mobile/hooks/updateRequiredCore";

const mobile = path.resolve(__dirname, "..", "..", "mobile");
const leer = (rel: string) => fs.readFileSync(path.join(mobile, rel), "utf8").replace(/\r\n/g, "\n");

describe("ubicación del puesto: coordenadas y Waze", () => {
    it("acepta números y textos numéricos dentro del rango y rechaza lo demás", () => {
        assert.equal(parseCoordinate(9.934739, "lat"), 9.934739);
        assert.equal(parseCoordinate("-84.087502", "lng"), -84.087502);
        assert.equal(parseCoordinate("9,93", "lat"), 9.93, "coma decimal");
        for (const v of [null, undefined, "", "abc", NaN, 91, -91]) assert.equal(parseCoordinate(v, "lat"), null, String(v));
        assert.equal(parseCoordinate(181, "lng"), null);
        assert.equal(parseCoordinate(180, "lng"), 180);
    });

    it("un puesto sin coordenadas utilizables (o en 0,0) no tiene punto", () => {
        assert.deepEqual(parsePuestoPoint({ lat: 9.93, lng: -84.08 }), { lat: 9.93, lng: -84.08 });
        assert.deepEqual(parsePuestoPoint({ lat: "9.93", lng: "-84.08" }), { lat: 9.93, lng: -84.08 });
        assert.equal(parsePuestoPoint({ lat: 9.93, lng: null }), null);
        assert.equal(parsePuestoPoint({ lat: 0, lng: 0 }), null);
        assert.equal(parsePuestoPoint(null), null);
        assert.equal(parsePuestoPoint(undefined), null);
    });

    it("formatea las coordenadas y arma los enlaces de Waze con el puesto como destino", () => {
        assert.equal(formatCoordinates({ lat: 9.934739, lng: -84.087502 }), "9.934739, -84.087502");
        assert.equal(formatCoordinates(null), "—");
        const links = buildWazeLinks({ lat: 9.934739, lng: -84.087502 });
        assert.equal(links.app, "waze://?ll=9.934739,-84.087502&navigate=yes");
        assert.equal(links.web, "https://waze.com/ul?ll=9.934739%2C-84.087502&navigate=yes&zoom=17");
    });

    it("el componente muestra el botón, las coordenadas, el mapa con la ubicación actual y el botón de Waze, y avisa si faltan coordenadas", () => {
        const c = leer("components/PuestoLocationBlock.tsx");
        assert.match(c, /Mostrar ubicación del puesto/);
        assert.match(c, /<OutOfRangeMap deviceLat=\{device\?\.lat \?\? null\}/);
        assert.match(c, /Cómo llegar con Waze/);
        assert.match(c, /Linking\.openURL\(links\.app\)/);
        assert.match(c, /Este puesto no tiene coordenadas definidas/);
    });
});

describe("versión de la app: comparación, banner y cabeceras", () => {
    it("compara por partes numéricas (1.0.10 es mayor que 1.0.9)", () => {
        assert.ok(compareAppVersions("1.0.10", "1.0.9") > 0);
        assert.ok(compareAppVersions("1.0.5", "1.0.5") === 0);
        assert.ok(compareAppVersions("1.0.4", "1.0.5") < 0);
        assert.ok(compareAppVersions("v2.0", "1.9.9") > 0);
        assert.equal(isNewerAppVersion("1.0.6", "1.0.5"), true);
        assert.equal(isNewerAppVersion("1.0.5", "1.0.5"), false);
    });

    it("interpreta el 426 del control de versión", () => {
        assert.deepEqual(parseUpdateRequired({ update_required: true, message: " Actualiza ", required_version: "1.0.6" }), { message: "Actualiza", requiredVersion: "1.0.6" });
        assert.equal(parseUpdateRequired({ status: false, message: "otro error" }), null);
        assert.equal(parseUpdateRequired(null), null);
        assert.match(parseUpdateRequired({ update_required: true })!.message, /actualiza/i);
    });

    it("todas las URLs de archivos con token llevan la versión y las descargas nativas mandan la cabecera", () => {
        const dirs = ["screens", "components", "hooks"];
        let total = 0;
        for (const d of dirs) {
            for (const file of fs.readdirSync(path.join(mobile, d)).filter((n) => /\.(ts|tsx)$/.test(n))) {
                const src = leer(`${d}/${file}`);
                const tokens = src.match(/token=\$\{encodeURIComponent\((?:[^()]|\([^()]*\))*\)\}/g) ?? [];
                for (const t of tokens) {
                    total++;
                    assert.ok(src.includes(t + "${appVersionQuery()}"), `${d}/${file}: URL con token sin versión`);
                }
                if (tokens.length) assert.match(src, /import \{ appVersionQuery \} from/, `${d}/${file}: falta el import`);
            }
        }
        assert.ok(total >= 29, `se esperaban al menos 29 URLs con token y hay ${total}`);
        assert.match(leer("hooks/downloadReportFileToDevice.ts"), /headers: \{ \.\.\.appVersionHeaders\(\), \.\.\.params\.headers \}/);
        assert.match(leer("hooks/installEvidenceFetch.ts"), /X-App-Version/);
        assert.match(leer("hooks/installEvidenceFetch.ts"), /response\.status === 426/);
    });

    it("el banner de producción muestra la versión y el de lite sigue siendo el de prueba", () => {
        const b = leer("components/TrialVersionBanner.tsx");
        assert.match(b, /const version = getAppVersionString\(\);/);
        assert.match(b, /trialBannerText\(version\) : releaseBannerText\(version\)/);
        assert.match(b, /`Versión de prueba - \$\{v\}`/);
        assert.equal(/GIT_COMMIT_LAST4|last4/.test(b), false, "ya no muestra los caracteres del commit");
        assert.match(b, /if \(resolveRuntimeAppVariant\(\) === 'lite'\) return TRIAL_VERSION_BANNER_ENABLED \? 'trial' : null;/);
    });

    it("el inicio de sesión muestra la versión, busca actualización y descarga sin token", () => {
        assert.match(leer("screens/LoginScreen.tsx"), /<AppVersionNotice \/>/);
        const c = leer("components/AppVersionNotice.tsx");
        assert.match(c, /Buscar actualización/);
        assert.match(c, /\/api\/mobile-versions`/);
        assert.match(c, /downloadAndShareLargeFile\(/);
        assert.equal(/downloadAndShareLargeAuthedFile|authedFetch/.test(c), false, "sin sesión");
    });
});
