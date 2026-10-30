import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ThemedText } from './ThemedText';
import {
  DEFAULT_MIN_APPROVAL_PERCENTAGE,
  QUIZ_QUESTION_TYPES,
  draftFromQuestion,
  emptyDraft,
  newQuestionId,
  questionFromDraft,
  quizSummary,
  validateDraft,
  type QuestionDraft,
  type QuizConfig,
  type QuizQuestion,
} from '../hooks/jobManualQuiz';

type Props = {
  value: QuizConfig;
  onChange: (next: QuizConfig) => void;
  disabled?: boolean;
};

const typeLabel = (t: QuizQuestion['type']) => QUIZ_QUESTION_TYPES.find((x) => x.key === t)?.label ?? t;

/**
 * Editor del quiz de un documento (formulario de edición): lista de preguntas con editar y borrar, y el mismo formulario de pregunta que el de creación
 * (tipo, opciones, respuesta correcta y puntaje). La pregunta se edita en un bloque dentro de la misma ventana (sin un segundo modal encima). Al editar una
 * pregunta se conserva su id. No guarda nada por sí solo: el padre manda todo al aceptar.
 */
export default function JobManualQuizEditor({ value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [optionInput, setOptionInput] = useState('');

  const openNew = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setOptionInput('');
    setOpen(true);
  };

  const openEdit = (q: QuizQuestion) => {
    setDraft(draftFromQuestion(q));
    setEditingId(q.id);
    setOptionInput('');
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditingId(null);
  };

  const save = () => {
    const problem = validateDraft(draft);
    if (problem) {
      Alert.alert('Error', problem);
      return;
    }
    const q = questionFromDraft(draft, editingId ?? newQuestionId());
    onChange({
      ...value,
      questions: editingId ? value.questions.map((x) => (x.id === editingId ? q : x)) : [...value.questions, q],
    });
    close();
  };

  const remove = (q: QuizQuestion) => {
    Alert.alert('Eliminar pregunta', '¿Eliminar esta pregunta del quiz?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onChange({ ...value, questions: value.questions.filter((x) => x.id !== q.id) }) },
    ]);
  };

  const needsOptions = draft.type === 'multiple_choice' || draft.type === 'multiple_select' || draft.type === 'list';

  const addOption = () => {
    const v = optionInput.trim();
    if (!v) return;
    if (draft.options.includes(v)) {
      Alert.alert('Error', 'Esa opción ya existe');
      return;
    }
    setDraft((d) => ({ ...d, options: [...d.options, v] }));
    setOptionInput('');
  };

  const removeOption = (opt: string) =>
    setDraft((d) => ({ ...d, options: d.options.filter((o) => o !== opt), answer: d.answer === opt ? '' : d.answer, answers: d.answers.filter((o) => o !== opt) }));

  return (
    <View>
      <ThemedText style={styles.summary}>{quizSummary(value)}</ThemedText>

      {value.questions.length > 0 && !open && (
        <View style={styles.minRow}>
          <ThemedText style={styles.formLabel}>Aprobación mínima (%)</ThemedText>
          <TextInput
            style={[styles.formInput, styles.minInput]}
            keyboardType="numeric"
            editable={!disabled}
            value={value.minApprovalPercentage !== undefined ? String(value.minApprovalPercentage) : ''}
            placeholder={String(DEFAULT_MIN_APPROVAL_PERCENTAGE)}
            placeholderTextColor="#999"
            onChangeText={(t) => {
              const n = parseFloat(t.replace(',', '.'));
              onChange({ ...value, minApprovalPercentage: Number.isFinite(n) && n > 0 && n <= 100 ? n : undefined });
            }}
          />
        </View>
      )}

      {!open &&
        value.questions.map((q, i) => (
          <View key={q.id} style={styles.questionRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.questionTitle}>
                {i + 1}. {q.title}
              </ThemedText>
              <ThemedText style={styles.questionMeta}>
                {typeLabel(q.type)} · {q.points} punto(s)
              </ThemedText>
            </View>
            <TouchableOpacity disabled={disabled} onPress={() => openEdit(q)} style={styles.iconButton} accessibilityLabel="Editar pregunta">
              <Ionicons name="create-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity disabled={disabled} onPress={() => remove(q)} style={styles.iconButton} accessibilityLabel="Eliminar pregunta">
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ))}

      {!open && (
        <TouchableOpacity disabled={disabled} style={[styles.actionButton, disabled && styles.disabled]} onPress={openNew}>
          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
          <ThemedText style={styles.actionButtonText}>Agregar pregunta</ThemedText>
        </TouchableOpacity>
      )}

      {open && (
        <View style={styles.questionCard}>
          <ThemedText style={styles.cardTitle}>{editingId ? 'Editar pregunta' : 'Agregar pregunta'}</ThemedText>

          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Título de la pregunta *</ThemedText>
            <TextInput style={styles.formInput} value={draft.title} onChangeText={(t) => setDraft((d) => ({ ...d, title: t }))} placeholder="Escribe la pregunta" placeholderTextColor="#999" />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Tipo *</ThemedText>
            <View style={styles.pills}>
              {QUIZ_QUESTION_TYPES.map((t) => {
                const active = draft.type === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setDraft((d) => ({ ...d, type: t.key, options: [], answer: '', answers: [] }))}
                  >
                    <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {needsOptions && (
            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Opciones *</ThemedText>
              <View style={styles.optionAddRow}>
                <TextInput style={[styles.formInput, { flex: 1 }]} value={optionInput} onChangeText={setOptionInput} placeholder="Nueva opción" placeholderTextColor="#999" onSubmitEditing={addOption} />
                <TouchableOpacity style={styles.optionAddButton} onPress={addOption}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {draft.options.map((opt) => (
                <View key={opt} style={styles.optionRow}>
                  <ThemedText style={{ flex: 1 }}>{opt}</ThemedText>
                  <TouchableOpacity onPress={() => removeOption(opt)}>
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {(draft.type === 'short' || draft.type === 'paragraph') && (
            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Respuesta correcta *</ThemedText>
              <TextInput style={[styles.formInput, draft.type === 'paragraph' && styles.textArea]} multiline={draft.type === 'paragraph'} value={draft.answer} onChangeText={(t) => setDraft((d) => ({ ...d, answer: t }))} placeholder="Respuesta esperada" placeholderTextColor="#999" />
            </View>
          )}

          {(draft.type === 'multiple_choice' || draft.type === 'list') && draft.options.length > 0 && (
            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Respuesta correcta *</ThemedText>
              {draft.options.map((opt) => {
                const selected = draft.answer === opt;
                return (
                  <TouchableOpacity key={opt} style={styles.optionRow} onPress={() => setDraft((d) => ({ ...d, answer: opt }))}>
                    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color="#007AFF" />
                    <ThemedText style={{ marginLeft: 8, flex: 1 }}>{opt}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {draft.type === 'multiple_select' && draft.options.length > 0 && (
            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Respuestas correctas *</ThemedText>
              {draft.options.map((opt) => {
                const selected = draft.answers.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={styles.optionRow}
                    onPress={() => setDraft((d) => ({ ...d, answers: selected ? d.answers.filter((o) => o !== opt) : [...d.answers, opt] }))}
                  >
                    <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={20} color="#007AFF" />
                    <ThemedText style={{ marginLeft: 8, flex: 1 }}>{opt}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Puntaje *</ThemedText>
            <TextInput style={styles.formInput} keyboardType="numeric" value={draft.points} onChangeText={(t) => setDraft((d) => ({ ...d, points: t }))} placeholder="Ej. 1" placeholderTextColor="#999" />
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity style={[styles.formButton, styles.cancelButton]} onPress={close}>
              <ThemedText style={styles.formButtonText}>Cancelar</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.formButton, styles.confirmButton]} onPress={save}>
              <ThemedText style={styles.formButtonText}>Confirmar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Mismos colores, bordes y tamaños que los formularios de «Documentos».
const styles = StyleSheet.create({
  summary: { fontSize: 13, color: '#555555', marginBottom: 8 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#000000' },
  formGroup: { marginBottom: 16 },
  formInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: '#FFFFFF', color: '#000000' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  minRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  minInput: { width: 80, textAlign: 'center' },
  questionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  questionTitle: { fontSize: 14, fontWeight: '600', color: '#000000' },
  questionMeta: { fontSize: 12, color: '#777777' },
  iconButton: { padding: 6 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginTop: 6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  questionCard: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, backgroundColor: '#FFFFFF', padding: 12, marginTop: 6 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#000000' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF' },
  pillActive: { borderColor: '#007AFF', backgroundColor: '#EAF3FF' },
  pillText: { fontSize: 13, color: '#333333' },
  pillTextActive: { color: '#007AFF', fontWeight: '600' },
  optionAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionAddButton: { backgroundColor: '#007AFF', borderRadius: 8, padding: 9 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  formActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  formButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
  cancelButton: { backgroundColor: '#FF3B30' },
  confirmButton: { backgroundColor: '#34C759' },
  formButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
