import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { resolveRuntimeAppVariant } from '@/hooks/appVariant';
import { getAppVersionString } from '@/hooks/appVersionHeader';

/** Cambiar a `false` para ocultar el banner de "Versión de prueba" también en lite. */
const TRIAL_VERSION_BANNER_ENABLED = true;
/** Cambiar a `false` para ocultar el banner con el número de versión en prod y full. */
const RELEASE_VERSION_BANNER_ENABLED = true;

/** lite (pruebas): «Versión de prueba - X.Y.Z». prod y full (producción): «Versión X.Y.Z». */
export type VersionBannerKind = 'trial' | 'release';

export function versionBannerKind(): VersionBannerKind | null {
  if (resolveRuntimeAppVariant() === 'lite') return TRIAL_VERSION_BANNER_ENABLED ? 'trial' : null;
  return RELEASE_VERSION_BANNER_ENABLED ? 'release' : null;
}

/** Hay un banner fijo arriba (de prueba o de versión): el encabezado ya no reserva el área segura superior. */
export function shouldShowTrialVersionBanner(): boolean {
  return versionBannerKind() !== null;
}

/** Texto del banner de producción: «Versión 1.0.4» (sin número cuando no se conoce). */
export function releaseBannerText(version: string): string {
  const v = String(version ?? '').trim();
  return v ? `Versión ${v}` : 'Versión';
}

/** Texto del banner de pruebas: «Versión de prueba - 1.0.6» (antes llevaba los últimos 4 caracteres del commit). */
export function trialBannerText(version: string): string {
  const v = String(version ?? '').trim();
  return v ? `Versión de prueba - ${v}` : 'Versión de prueba';
}

/**
 * Banner fijo en la parte superior de toda la app, siempre con el número de versión instalada (1.0.1, 1.0.2…): en lite como «Versión de prueba - X.Y.Z»;
 * en prod y full como «Versión X.Y.Z».
 */
export default function TrialVersionBanner() {
  const insets = useSafeAreaInsets();
  const kind = versionBannerKind();
  if (!kind) {
    return null;
  }

  const version = getAppVersionString();
  const text = kind === 'trial' ? trialBannerText(version) : releaseBannerText(version);

  return (
    <View style={[styles.safeWrap, kind === 'release' && styles.safeWrapRelease, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={[styles.banner, kind === 'release' && styles.bannerRelease]}>
        <Text style={styles.text} numberOfLines={1}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeWrap: {
    backgroundColor: '#FF6A00',
    width: '100%',
  },
  safeWrapRelease: {
    backgroundColor: '#1F4F99',
  },
  banner: {
    backgroundColor: '#FF6A00',
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerRelease: {
    backgroundColor: '#1F4F99',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
