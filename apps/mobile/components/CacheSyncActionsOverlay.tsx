import React from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export type CacheSyncActionsOverlayProps = {
  visible: boolean;
  fadeAnim: Animated.Value;
  onRequestClose: () => void;
  message?: string;
};

/** Ventana flotante de sincronización de acciones en caché (estilo modal de CorporateVehicles). */
export function CacheSyncActionsOverlay({
  visible,
  fadeAnim,
  onRequestClose,
  message = 'Sincronizando datos en caché, no cierre la aplicación',
}: CacheSyncActionsOverlayProps) {
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onRequestClose}>
      <Animated.View style={[styles.modalBackdrop, { opacity: fadeAnim }]}>
        <ThemedView style={styles.modalCard} lightColor="#FFFFFF" darkColor="#FFFFFF">
          <TouchableOpacity onPress={onRequestClose} style={styles.modalCloseBtn} activeOpacity={0.85}>
            <Ionicons name="close" size={22} color="#000" />
          </TouchableOpacity>
          <ThemedView style={styles.modalBody} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <ThemedText style={styles.message}>{message}</ThemedText>
            <ActivityIndicator size="large" color="#007AFF" style={styles.spinner} />
          </ThemedView>
        </ThemedView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#F2F2F2',
  },
  modalBody: {
    paddingTop: 44,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 36,
  },
  spinner: { marginTop: 4 },
});
