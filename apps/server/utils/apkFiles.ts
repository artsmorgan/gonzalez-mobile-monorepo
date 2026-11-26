/**
 * Nombres de los instaladores del catálogo `/app-versions` (issue #179, H10).
 * Cada versión se sube como `MonitoreApp-{version}-{abi}.apk` (uno por arquitectura) y, opcionalmente, `MonitoreApp-{version}.apk` (universal).
 * La lista debe coincidir con `apps/mobile/plugins/androidAbiSplits.js` (lo comprueba `apkPorAbi.test.ts`).
 */
export const SERVER_APK_ABIS = ["arm64-v8a", "armeabi-v7a", "x86_64"] as const;

/** Una versión es texto como `1.0.3` o `1.0.3-rc.1`; cualquier otra cosa (rutas, `..`, controles) no arma un nombre de archivo. */
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/;

/**
 * Archivos a intentar, en orden: primero el de la arquitectura pedida y al final el universal. Una arquitectura vacía o desconocida no es un
 * error (se ofrece solo el universal). `null` si la versión no es válida.
 */
export function apkFileCandidates(version: unknown, abi?: unknown): string[] | null {
    const v = typeof version === "string" ? version.trim() : "";
    if (!v || v.includes("..") || !VERSION_RE.test(v)) return null;
    const universal = `MonitoreApp-${v}.apk`;
    const a = typeof abi === "string" ? abi : "";
    if ((SERVER_APK_ABIS as readonly string[]).includes(a)) return [`MonitoreApp-${v}-${a}.apk`, universal];
    return [universal];
}
