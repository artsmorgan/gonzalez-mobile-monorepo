import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { convertDateTimestampToLocalString } from '../hooks/convertDateTimestampToLocalString';

export type CambiosDisplayField = {
  prop: string;
  prop_label: string;
  kind: 'text' | 'signature_digital' | 'signature_image' | 'complex';
  display: string;
  raw?: string | null;
};

export type CambiosDisplayDiffLine = {
  label: string;
  before: string;
  after: string;
};

export type CambiosDisplayEntry = {
  prop: string;
  prop_label: string;
  kind: 'created' | 'deleted' | 'updated' | 'field';
  before_display?: string | null;
  after_display?: string | null;
  fields?: CambiosDisplayField[];
  diff_lines?: CambiosDisplayDiffLine[];
};

export type CambiosAppsModulesRow = {
  id: number;
  created_at: string | Date;
  empleado_nombre?: string | null;
  empleado_cedula?: string | null;
  cambios?: string;
  cambios_display?: CambiosDisplayEntry[];
};

type CambiosAppsModulesModalProps = {
  visible: boolean;
  title: string;
  items: CambiosAppsModulesRow[];
  onClose: () => void;
  loading?: boolean;
  loadingText?: string;
};

function formatSignatureForDisplay(value?: string | null): string {
  if (!value) return '';
  return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
}

function decodeFirmaHash(hash?: string | null): {
  sessionId?: string;
  empleadoId?: string;
  timestamp?: string;
} | null {
  if (!hash || typeof hash !== 'string') return null;
  const parts = hash.split('|');
  if (parts.length < 4) return null;
  return {
    sessionId: parts[0] || undefined,
    empleadoId: parts[1] || undefined,
    timestamp: parts[parts.length - 1] || undefined,
  };
}

function formatDigitalSignatureText(raw?: string | null): string {
  if (!raw) return 'Firma digital (no disponible)';
  const info = decodeFirmaHash(raw);
  if (!info) return 'Firma digital (formato no decodificable)';
  const hora = info.timestamp
    ? convertDateTimestampToLocalString(new Date(Number(info.timestamp)).toISOString())
    : 'N/A';
  return `Sesión: ${info.sessionId || 'N/A'}\nEmpleado: ${info.empleadoId || 'N/A'}\nHora: ${hora}`;
}

function formatCreatedAt(value: unknown): string {
  if (!value) return '—';
  try {
    const iso = value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
    return convertDateTimestampToLocalString(iso);
  } catch {
    return String(value);
  }
}

function renderFieldValue(field: CambiosDisplayField) {
  if (field.kind === 'signature_image' && field.raw) {
    return (
      <>
        <ThemedText style={styles.fieldValue}>{field.display}</ThemedText>
        <Image source={{ uri: formatSignatureForDisplay(field.raw) }} style={styles.signatureImage} resizeMode="contain" />
      </>
    );
  }
  if (field.kind === 'signature_digital' && field.raw) {
    return <ThemedText style={styles.fieldValue}>{formatDigitalSignatureText(field.raw)}</ThemedText>;
  }
  return <ThemedText style={styles.fieldValue}>{field.display}</ThemedText>;
}

function renderCambioEntry(entry: CambiosDisplayEntry, rowId: number, idx: number) {
  const key = `cambio-${rowId}-${idx}-${entry.prop}`;

  if (entry.kind === 'created' || entry.kind === 'deleted') {
    return (
      <ThemedView key={key} style={styles.changeCard}>
        <ThemedText style={styles.changeTitle}>{entry.prop_label}</ThemedText>
        {(entry.fields ?? []).map((field) => (
          <ThemedView key={`${key}-${field.prop}`} style={styles.fieldRow}>
            <ThemedText style={styles.fieldLabel}>{field.prop_label}</ThemedText>
            {renderFieldValue(field)}
          </ThemedView>
        ))}
      </ThemedView>
    );
  }

  if (entry.kind === 'updated') {
    return (
      <ThemedView key={key} style={styles.changeCard}>
        <ThemedText style={styles.changeTitle}>{entry.prop_label}</ThemedText>
        {(entry.diff_lines ?? []).length === 0 ? (
          <ThemedText style={styles.fieldValue}>Sin diferencias detectadas</ThemedText>
        ) : (
          (entry.diff_lines ?? []).map((line, lineIdx) => (
            <ThemedView key={`${key}-diff-${lineIdx}`} style={styles.fieldRow}>
              <ThemedText style={styles.fieldLabel}>{line.label}</ThemedText>
              <ThemedText style={styles.fieldValue}>Antes: {line.before}</ThemedText>
              <ThemedText style={styles.fieldValue}>Ahora: {line.after}</ThemedText>
            </ThemedView>
          ))
        )}
      </ThemedView>
    );
  }

  const field = entry.fields?.[0];
  if (field && (field.kind === 'signature_image' || field.kind === 'signature_digital')) {
    return (
      <ThemedView key={key} style={styles.changeCard}>
        <ThemedText style={styles.fieldLabel}>{entry.prop_label}</ThemedText>
        {renderFieldValue(field)}
      </ThemedView>
    );
  }

  const hasBefore = entry.before_display != null && entry.before_display !== entry.after_display;
  return (
    <ThemedView key={key} style={styles.changeCard}>
      <ThemedText style={styles.fieldLabel}>{entry.prop_label}</ThemedText>
      {hasBefore ? (
        <>
          <ThemedText style={styles.fieldValue}>Antes: {entry.before_display}</ThemedText>
          <ThemedText style={styles.fieldValue}>Ahora: {entry.after_display ?? '—'}</ThemedText>
        </>
      ) : (
        <ThemedText style={styles.fieldValue}>{entry.after_display ?? '—'}</ThemedText>
      )}
    </ThemedView>
  );
}

export default function CambiosAppsModulesModal({
  visible,
  title,
  items,
  onClose,
  loading = false,
  loadingText = 'Cargando cambios...',
}: CambiosAppsModulesModalProps) {
  const [expandedCambioId, setExpandedCambioId] = useState<number | null>(null);

  const handleClose = () => {
    setExpandedCambioId(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <ThemedView style={styles.modalCard}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>{title}</ThemedText>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </ThemedView>

          <ScrollView
            style={{ maxHeight: Dimensions.get('window').height * 0.75 }}
            contentContainerStyle={styles.scrollContent}
          >
            {loading ? (
              <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <ThemedText style={styles.loadingText}>{loadingText}</ThemedText>
              </ThemedView>
            ) : items.length === 0 ? (
              <ThemedView style={styles.emptyContainer}>
                <ThemedText style={styles.emptyText}>No hay cambios registrados</ThemedText>
              </ThemedView>
            ) : (
              items.map((row) => {
                const entries = Array.isArray(row.cambios_display) ? row.cambios_display : [];
                const isOpen = expandedCambioId === row.id;
                return (
                  <ThemedView key={`chg-${row.id}`} style={styles.recordCard}>
                    <TouchableOpacity
                      style={styles.recordHeader}
                      onPress={() => setExpandedCambioId((prev) => (prev === row.id ? null : row.id))}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={styles.recordTitle}>{formatCreatedAt(row.created_at)}</ThemedText>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#007AFF" />
                    </TouchableOpacity>

                    {isOpen ? (
                      <ThemedView style={styles.recordBody}>
                        <ThemedView style={styles.metaCard}>
                          <ThemedText style={styles.metaLabel}>Cambio realizado por</ThemedText>
                          <ThemedText style={styles.metaValue}>
                            {row.empleado_nombre || 'Desconocido'}
                            {row.empleado_cedula ? ` — Cédula: ${row.empleado_cedula}` : ''}
                          </ThemedText>
                        </ThemedView>

                        {entries.length > 0 ? (
                          <ThemedView style={styles.changesSection}>
                            <ThemedText style={styles.sectionLabel}>Cambios</ThemedText>
                            {entries.map((entry, idx) => renderCambioEntry(entry, row.id, idx))}
                          </ThemedView>
                        ) : (
                          <ThemedText style={styles.fieldValue}>Sin detalle de cambios</ThemedText>
                        )}
                      </ThemedView>
                    ) : null}
                  </ThemedView>
                );
              })
            )}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    flex: 1,
    paddingRight: 12,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  recordCard: {
    marginBottom: 12,
    backgroundColor: '#EEF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E8FF',
    overflow: 'hidden',
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    flex: 1,
    paddingRight: 8,
  },
  recordBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#D6E8FF',
  },
  metaCard: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E8FF',
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  changesSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  changeCard: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E8FF',
    marginBottom: 8,
  },
  changeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
  },
  fieldRow: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 13,
    color: '#333',
    lineHeight: 19,
  },
  signatureImage: {
    width: 160,
    height: 72,
    borderWidth: 1,
    borderColor: '#DDD',
    marginTop: 6,
    backgroundColor: '#FFF',
  },
});
