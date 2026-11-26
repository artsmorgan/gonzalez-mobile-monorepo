import React, { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { dateToYmd, isRangeActive, ymdToDmy, ymdToLocalDate, type DateRange } from '../hooks/filtrosFechas';

type Props = {
  /** Qué fecha se filtra (por ejemplo «Fecha de creación»). */
  label: string;
  value: DateRange;
  onChange: (next: DateRange) => void;
};

/**
 * Filtro de fecha como rango «Desde — Hasta». Nace vacío: sin fechas elegidas no oculta nada (ver `hooks/filtrosFechas.ts`).
 */
export default function DateRangeFilter({ label, value, onChange }: Props) {
  const [picking, setPicking] = useState<'desde' | 'hasta' | null>(null);

  const renderField = (which: 'desde' | 'hasta', title: string) => (
    <ThemedView style={styles.field}>
      <ThemedText style={styles.fieldTitle}>{title}</ThemedText>
      <TouchableOpacity style={styles.dateBtn} onPress={() => setPicking(which)} activeOpacity={0.85} accessibilityLabel={`${label}: ${title}`}>
        <ThemedText style={styles.dateBtnText}>{value[which] ? ymdToDmy(value[which]) : 'Elegir fecha'}</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.group}>
      <ThemedText style={styles.label}>{label}:</ThemedText>
      <ThemedView style={styles.row}>
        {renderField('desde', 'Desde')}
        {renderField('hasta', 'Hasta')}
      </ThemedView>
      {isRangeActive(value) ? (
        <TouchableOpacity onPress={() => onChange({ desde: null, hasta: null })} style={styles.clearWrap}>
          <ThemedText style={styles.clearText}>Quitar filtro de fecha</ThemedText>
        </TouchableOpacity>
      ) : null}
      {picking ? (
        <DateTimePicker
          value={value[picking] ? ymdToLocalDate(value[picking]) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: { type?: string }, d?: Date) => {
            const which = picking;
            setPicking(null);
            if (event?.type === 'dismissed' || !d || !which) return;
            onChange({ ...value, [which]: dateToYmd(d) });
          }}
        />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: '#F8F9FA' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  row: { flexDirection: 'row', gap: 10, backgroundColor: '#F8F9FA' },
  field: { flex: 1, backgroundColor: '#F8F9FA' },
  fieldTitle: { fontSize: 12, color: '#555', marginBottom: 4 },
  dateBtn: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, backgroundColor: '#F7F7F7' },
  dateBtnText: { fontSize: 16, color: '#000' },
  clearWrap: { marginTop: 6 },
  clearText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
});
