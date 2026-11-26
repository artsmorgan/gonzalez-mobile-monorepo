/**
 * Arquitectura del APK que debe descargar este equipo (issue #179, H10). Módulo puro, sin Expo/React Native, para poder probarlo en Node.
 * Debe coincidir con `plugins/androidAbiSplits.js` y con `apps/server/utils/apkFiles.ts` (lo comprueba `apkPorAbi.test.ts`).
 */
export const APK_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'] as const;

/**
 * Recibe `Device.supportedCpuArchitectures` (el sistema las ordena de la preferida a la menos preferida) y devuelve la primera que tiene
 * APK. `null` si no se conoce ninguna: entonces se descarga el APK universal.
 */
export function pickApkAbi(supported: unknown): (typeof APK_ABIS)[number] | null {
  if (!Array.isArray(supported)) return null;
  for (const abi of supported) {
    if (typeof abi === 'string' && (APK_ABIS as readonly string[]).includes(abi)) return abi as (typeof APK_ABIS)[number];
  }
  return null;
}
