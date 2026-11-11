import Constants from 'expo-constants';
import * as Application from 'expo-application';

export type AppVariant = 'lite' | 'full' | 'prod';

function variantFromPackage(packageId: unknown): AppVariant | null {
  const id = String(packageId ?? '').trim().toLowerCase();
  if (id.endsWith('.prod')) return 'prod';
  if (id.endsWith('.lite')) return 'lite';
  if (id.endsWith('.full')) return 'full';
  return null;
}

/**
 * Variante REAL de la app instalada (lite / full / prod).
 *
 * Se toma del `applicationId` de la build nativa (`com.abrjpo98.MonitoreApp.<variante>`), que es el flavor de Gradle que se compiló,
 * y no de la configuración de Expo embebida: esa depende de las variables de entorno que haya visto `app.config.js` al construir y
 * puede no coincidir con el flavor (por ejemplo, un APK de prod que muestre la información de lite). Solo si el paquete no es
 * reconocible (Expo Go, web) se usa la variante de la configuración y, al final, lite.
 */
export function resolveRuntimeAppVariant(): AppVariant {
  const fromNative = variantFromPackage(Application.applicationId);
  if (fromNative) return fromNative;
  const configured = String(Constants.expoConfig?.extra?.APP_VARIANT ?? '').trim().toLowerCase();
  if (configured === 'lite' || configured === 'full' || configured === 'prod') return configured;
  return variantFromPackage(Constants.expoConfig?.android?.package) ?? 'lite';
}

export type EmbeddedAppVersionInfo = {
  id?: string;
  name?: string;
  version?: string;
  created_at?: string;
  title?: string;
  description?: string;
  notas?: Array<string | { title?: string; description?: string }>;
};

/** Información de versión embebida que corresponde a la variante real de la app instalada. */
export function getEmbeddedAppVersionInfo(): EmbeddedAppVersionInfo {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, any>;
  const byVariant = extra.APP_VERSION_INFO_BY_VARIANT;
  const picked = byVariant && typeof byVariant === 'object' ? byVariant[resolveRuntimeAppVariant()] : null;
  const raw = picked ?? extra.APP_VERSION_INFO;
  return raw && typeof raw === 'object' ? (raw as EmbeddedAppVersionInfo) : {};
}
