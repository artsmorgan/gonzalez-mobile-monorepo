import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

/** Cambiar a `true` para volver a mostrar el banner de "Versión de prueba". */
const SHOW_TRIAL_VERSION_BANNER = true;

/**
 * Banner fijo en la parte superior de toda la app (versión de prueba + últimos 4 del commit).
 */
export default function TrialVersionBanner() {
  const insets = useSafeAreaInsets();
  const last4 = String(Constants.expoConfig?.extra?.GIT_COMMIT_LAST4 || '----')
    .trim()
    .slice(-4)
    .toLowerCase();

  if (!SHOW_TRIAL_VERSION_BANNER) {
    return null;
  }

  return (
    <View style={[styles.safeWrap, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.banner}>
        <Text style={styles.text} numberOfLines={1}>
          {`Versión de prueba - ${last4}`}
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
  banner: {
    backgroundColor: '#FF6A00',
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
