import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  type LegalCaseRow,
  CASE_STATUS_EDIT_OPTIONS,
  updateLawyerCase,
  caseStatusLabel,
} from '../../lib/legalDashboard';
import { relativeTimeEs } from '../../lib/format';
import { colors } from '../../theme/colors';

export default function LawyerCaseDetailModal({
  visible,
  lawyerId,
  caseRow,
  onClose,
  onSaved,
}: {
  visible: boolean;
  lawyerId: string | undefined;
  caseRow: LegalCaseRow | null;
  onClose: () => void;
  onSaved: (row: LegalCaseRow) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<LegalCaseRow['status']>('active');
  const [lastActivity, setLastActivity] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!caseRow) return;
    setTitle(caseRow.title);
    setDescription(caseRow.description ?? '');
    setStatus(caseRow.status);
    setLastActivity(caseRow.last_activity ?? '');
  }, [caseRow]);

  const handleSave = async () => {
    if (!lawyerId || !caseRow) return;
    const t = title.trim();
    if (!t) {
      Alert.alert('Título', 'El título del caso es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const row = await updateLawyerCase(caseRow.id, lawyerId, {
        title: t,
        description: description.trim() || null,
        status,
        last_activity: lastActivity.trim() || null,
      });
      onSaved(row);
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible && !!caseRow}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          {!caseRow ? null : (
            <>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Detalle del caso</Text>
            <View style={styles.headerBtn} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.meta}>
              <Text style={styles.metaLabel}>Cliente</Text>
              <Text style={styles.metaValue}>
                {caseRow.client_display_name?.trim() || 'Cliente'}
              </Text>
              <Text style={styles.metaHint}>
                Creado {relativeTimeEs(caseRow.created_at)}
              </Text>
            </View>

            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Título del caso"
              placeholderTextColor={colors.outline}
            />

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Resumen o notas internas"
              placeholderTextColor={colors.outline}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>Estado</Text>
            <View style={styles.statusGrid}>
              {CASE_STATUS_EDIT_OPTIONS.map((opt) => {
                const selected = status === opt.value;
                const pill = caseStatusLabel(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.statusChip, selected && styles.statusChipOn]}
                    onPress={() => setStatus(opt.value)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.statusChipText, selected && styles.statusChipTextOn]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.statusChipHint, selected && styles.statusChipHintOn]}>
                      {pill.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Última actividad (nota)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={lastActivity}
              onChangeText={setLastActivity}
              placeholder="Ej.: Audiencia fijada, documentos enviados…"
              placeholderTextColor={colors.outline}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={() => void handleSave()}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>Guardar cambios</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '55',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  meta: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.outline,
    textTransform: 'uppercase',
  },
  metaValue: { fontSize: 17, fontWeight: '700', color: colors.primary, marginTop: 4 },
  metaHint: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 6 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant + '99',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.onSurface,
    backgroundColor: colors.surface,
    marginBottom: 18,
  },
  inputMultiline: { minHeight: 100, paddingTop: 12 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  statusChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '99',
    backgroundColor: colors.surfaceContainerLow,
    minWidth: '47%',
    flexGrow: 1,
  },
  statusChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  statusChipText: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  statusChipTextOn: { color: colors.primary },
  statusChipHint: { fontSize: 10, fontWeight: '600', color: colors.outline, marginTop: 2 },
  statusChipHintOn: { color: colors.primary },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
});
