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
import { type LegalCaseRow, updateLawyerCase, caseStatusLabel } from '../../lib/legalDashboard';
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
  const [lawyerObservations, setLawyerObservations] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!caseRow) return;
    setLawyerObservations(caseRow.lawyer_observations ?? '');
  }, [caseRow]);

  const handleApproveCase = async () => {
    if (!lawyerId || !caseRow) return;
    setSaving(true);
    try {
      const row = await updateLawyerCase(caseRow.id, lawyerId, {
        status: 'active',
        last_activity: 'Caso aceptado por el abogado',
        lawyer_observations: lawyerObservations.trim() || null,
      });
      onSaved(row);
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo aprobar.');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectCase = () => {
    if (!lawyerId || !caseRow) return;
    Alert.alert(
      'No tomar este caso',
      'El caso quedará en reasignación: el cliente podrá en «Mis casos» usar cupón de conexión (misma especialidad) o solicitar reembolso del fee.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: () => void confirmReject(),
        },
      ]
    );
  };

  const confirmReject = async () => {
    if (!lawyerId || !caseRow) return;
    setSaving(true);
    try {
      const row = await updateLawyerCase(caseRow.id, lawyerId, {
        status: 'reassignment_pending',
        last_activity: 'El abogado no aceptó tomar este caso (reasignación)',
        lawyer_observations: lawyerObservations.trim() || null,
      });
      onSaved(row);
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo rechazar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveObservations = async () => {
    if (!lawyerId || !caseRow) return;
    setSaving(true);
    try {
      const row = await updateLawyerCase(caseRow.id, lawyerId, {
        lawyer_observations: lawyerObservations.trim() || null,
      });
      onSaved(row);
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const statusPill = caseRow ? caseStatusLabel(caseRow.status) : null;

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
            {!caseRow ? null : (
              <>
            <View style={styles.meta}>
              <Text style={styles.metaLabel}>Cliente</Text>
              <Text style={styles.metaValue}>
                {caseRow.client_display_name?.trim() || 'Cliente'}
              </Text>
              <Text style={styles.metaHint}>Creado {relativeTimeEs(caseRow.created_at)}</Text>
            </View>

            {caseRow.status === 'pending_approval' ? (
              <View style={styles.approvalBox}>
                <Text style={styles.approvalTitle}>Solicitud nueva</Text>
                <Text style={styles.approvalHint}>
                  El cliente ya pagó el fee de contacto. Acepta para iniciar el trabajo o rechaza si no
                  puedes tomar el caso. El estado del caso solo cambia con estas acciones.
                </Text>
                <View style={styles.approvalRow}>
                  <TouchableOpacity
                    style={[styles.approvalBtn, styles.approveBtn]}
                    onPress={() => void handleApproveCase()}
                    disabled={saving}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={colors.onPrimary} />
                    <Text style={styles.approveBtnText}>Aprobar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approvalBtn, styles.rejectBtn]}
                    onPress={() => void handleRejectCase()}
                    disabled={saving}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                    <Text style={styles.rejectBtnText}>No tomar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <Text style={styles.label}>Estado</Text>
            <View style={styles.statusReadonly}>
              <Text style={styles.statusReadonlyText}>{statusPill?.text ?? '—'}</Text>
            </View>

            <Text style={styles.label}>Título (del cliente)</Text>
            <View style={styles.readonlyBox}>
              <Text style={styles.readonlyText}>{caseRow.title}</Text>
            </View>

            <Text style={styles.label}>Descripción (del cliente)</Text>
            <View style={[styles.readonlyBox, styles.readonlyMultiline]}>
              <Text style={styles.readonlyText}>
                {caseRow.description?.trim() ? caseRow.description : 'Sin descripción.'}
              </Text>
            </View>

            <Text style={styles.label}>Observaciones (solo abogado)</Text>
            <Text style={styles.hint}>
              Notas internas para ti; el cliente no edita este campo. Puedes guardarlas sin aprobar ni
              rechazar la solicitud.
            </Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={lawyerObservations}
              onChangeText={setLawyerObservations}
              placeholder="Ej.: puntos a revisar, documentos pendientes, próximos pasos…"
              placeholderTextColor={colors.outline}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={() => void handleSaveObservations()}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>Guardar observaciones</Text>
              )}
            </TouchableOpacity>
              </>
            )}
          </ScrollView>
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
  approvalBox: {
    backgroundColor: colors.primaryContainer + '99',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  approvalTitle: { fontSize: 15, fontWeight: '800', color: colors.primary },
  approvalHint: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 8,
    lineHeight: 20,
  },
  approvalRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  approvalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  approveBtn: { backgroundColor: colors.primary },
  rejectBtn: { backgroundColor: colors.errorContainer, borderWidth: 1, borderColor: colors.error + '33' },
  approveBtnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '800' },
  rejectBtnText: { color: colors.error, fontSize: 15, fontWeight: '800' },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: colors.outline,
    marginBottom: 10,
    lineHeight: 18,
  },
  statusReadonly: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 18,
  },
  statusReadonlyText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  readonlyBox: {
    borderWidth: 1,
    borderColor: colors.outlineVariant + '99',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 18,
  },
  readonlyMultiline: { minHeight: 100, paddingTop: 12 },
  readonlyText: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
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
  inputMultiline: { minHeight: 120, paddingTop: 12 },
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
