/**
 * APK por arquitectura (issue #179, H10). Parte PURA, sin dependencias, para probarla en Node y para que `withAndroidAbiSplits.js`
 * (el plugin de Expo) y el `build.gradle` commiteado salgan SIEMPRE del mismo lugar.
 *
 * El APK universal pesa ~130 MB porque lleva las librerías nativas de todas las arquitecturas. Con un APK por arquitectura cada equipo
 * descarga solo la suya. El nombre con el que se sube al catálogo es `MonitoreApp-{version}-{abi}.apk` (ver docs/apk-por-arquitectura.md).
 */

/** Arquitecturas para las que se genera APK. x86 (32 bits) no existe en equipos reales y solo servía en emuladores antiguos. */
const APK_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'];

const MARKER = '// APK por ABI (issue #179)';

function buildSplitsBlock() {
  const include = APK_ABIS.map((a) => `"${a}"`).join(', ');
  return `    ${MARKER}: el APK universal pesa ~130 MB; cada equipo descarga solo el de su arquitectura.
    // Para desarrollo se puede apagar con -Papk.splitPerAbi=false.
    splits {
        abi {
            enable = (findProperty('apk.splitPerAbi') ?: 'true').toBoolean()
            reset()
            include ${include}
            universalApk = false
        }
    }
`;
}

/** Valor de `reactNativeArchitectures` (gradle.properties): se compila solo para lo que se separa. */
function reactNativeArchitecturesValue() {
  return APK_ABIS.join(',');
}

/** Agrega el bloque `splits` dentro de `android { }`. Idempotente: si ya está, devuelve el mismo texto. */
function applyAbiSplitsToBuildGradle(contents) {
  if (contents.includes(MARKER)) return contents;
  const crlf = contents.includes('\r\n');
  const text = contents.replace(/\r\n/g, '\n');
  const block = buildSplitsBlock();

  let out;
  if (/\n    signingConfigs\s*\{/.test(text)) {
    out = text.replace(/\n    signingConfigs\s*\{/, `\n${block}    signingConfigs {`);
  } else {
    out = text.replace(/android\s*\{\s*\n/, (m) => `${m}${block}`);
  }
  return crlf ? out.replace(/\n/g, '\r\n') : out;
}

module.exports = {
  APK_ABIS,
  buildSplitsBlock,
  reactNativeArchitecturesValue,
  applyAbiSplitsToBuildGradle,
};
