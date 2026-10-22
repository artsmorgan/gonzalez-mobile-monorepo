import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AppFooterProps {
  children?: React.ReactNode;
}

const FOOTER_VERTICAL_PADDING = 16;

export default function AppFooter({ children }: AppFooterProps) {
  // Con la pantalla de borde a borde la barra de navegación del dispositivo (botón HOME / gestos) se dibuja encima de la app:
  // el área segura inferior se suma al relleno del footer para que su contenido quede por encima de esa barra.
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={[styles.footer, { paddingBottom: FOOTER_VERTICAL_PADDING + insets.bottom }]}>
      {children || (
        <ThemedText type="subtitle" style={styles.footerText}>
          © 2026 MonitoreApp
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: FOOTER_VERTICAL_PADDING,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
});
