import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { eventBus } from '@/hooks/eventBus';
import {
  clearDeviceBlock,
  DEVICE_NOT_APPROVED_EVENT,
  describeDeviceStatus,
  getCurrentDeviceBlock,
  type DeviceBlock,
} from '@/hooks/deviceNotApproved';

type Props = {
  /** Cierra la sesión local (la API ya no acepta este equipo). */
  logout: () => Promise<unknown>;
};

/**
 * Pantalla de estado del equipo (issue #146): se muestra encima de toda la app cuando el servidor responde `device_not_approved`
 * (equipo bloqueado, rechazado, retirado o pendiente). No cierra la sesión sola: si el estado cambia, «Reintentar» la libera.
 */
export default function DeviceStatusModal({ logout }: Props) {
  const [block, setBlock] = useState<DeviceBlock | null>(getCurrentDeviceBlock());

  useEffect(() => {
    const onChange = (next: DeviceBlock | null) => setBlock(next);
    eventBus.on(DEVICE_NOT_APPROVED_EVENT, onChange);
    return () => {
      eventBus.off(DEVICE_NOT_APPROVED_EVENT, onChange);
    };
  }, []);

  if (!block) return null;
  const info = describeDeviceStatus(block.status, block.reason);

  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.container}>
        <Text style={styles.title}>{info.title}</Text>
        <Text style={styles.body}>{info.body}</Text>
        {info.canRetry ? (
          <TouchableOpacity style={styles.primary} onPress={() => clearDeviceBlock()} accessibilityRole="button">
            <Text style={styles.primaryText}>Reintentar</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.secondary}
          onPress={async () => {
            clearDeviceBlock();
            await logout();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#111111', textAlign: 'center', marginBottom: 16 },
  body: { fontSize: 16, color: '#333333', textAlign: 'center', marginBottom: 32 },
  primary: { backgroundColor: '#007AFF', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondary: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryText: { color: '#007AFF', fontSize: 16 },
});
