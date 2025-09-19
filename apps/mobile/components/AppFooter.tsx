import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React from 'react';
import { StyleSheet } from 'react-native';

interface AppFooterProps {
  children?: React.ReactNode;
}

export default function AppFooter({ children }: AppFooterProps) {
  return (
    <ThemedView style={styles.footer}>
      {children || (
        <ThemedText type="subtitle" style={styles.footerText}>
          © 2024 Gonzalez App
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
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
});
