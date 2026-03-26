import React, { useState, useEffect } from 'react';
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
  caseStatusLabel,
  finalizeClientCase,
  type LegalCaseRow,
} from '../../lib/legalDashboard';
import { relativeTimeEs } from '../../lib/format';
import { colors } from '../../theme/colors';

export default function ClientCaseDetailModal({
  visible,
  caseRow,
  lawyerName,
  onClose,
  onFinalized,
}: {
  visible: boolean;
  caseRow: LegalCaseRow | null;
  lawyerName: string;
  onClose: () => void;
  onFinalized: () => void;
}) {
  const [ratingOpen, setRatingOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setRatingOpen(false);
      setStars(5);
      setComment('');
    }
  }, [visible]);

  const resetRating = () => {
    setRatingOpen(false);
    setStars(5);
    setComment('');
  };

  const handleClose = () => {
    if (submitting) return;
    resetRating();
    onClose();
  };

  const submitFinalize = async () => {
    if (!caseRow) return;
    setSubmitting(true);
    try {
      await finalizeClientCase(caseRow.id, stars, comment.trim() || null);
      resetRating();
      onFinalized();
      onClose();
      Alert.alert('Gracias', 'Tu calificación fue registrada. El caso quedó cerrado.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo finalizar el caso.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!caseRow) return null;

  const pill = caseStatusLabel(caseRow.status);
  const canFinalize =
    caseRow.status === 'active' && (caseRow.client_rating == null || caseRow.client_rating === undefined);
  const hasRating =
    caseRow.client_rating != null &&
    caseRow.client_rating >= 1 &&
    caseRow.client_rating <= 5;

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.headerBtn} hitSlop={12}>
                <Ionicons name="close" size={26} color={colors.chatPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Detalle del caso</Text>
              <View style={styles.headerBtn} />
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.hintTop}>
                El título y la descripción los define el cliente al crear la solicitud. Tras la
                aprobación del abogado no se pueden modificar desde la app.
              </Text>

              <Text style={styles.label}>Estado</Text>
              <View style={[styles.pill, pill.tone === 'success' && styles.pillOk]}>
                <Text style={[styles.pillText, pill.tone === 'success' && styles.pillTextOk]}>
                  {pill.text}
                </Text>
              </View>

              <Text style={styles.label}>Abogado</Text>
              <Text style={styles.value}>{lawyerName}</Text>

              <Text style={styles.label}>Título</Text>
              <View style={styles.readonlyBox}>
                <Text style={styles.readonlyText}>{caseRow.title}</Text>
              </View>

              <Text style={styles.label}>Descripción</Text>
              <View style={[styles.readonlyBox, styles.readonlyTall]}>
                <Text style={styles.readonlyText}>
                  {caseRow.description?.trim() ? caseRow.description : 'Sin descripción.'}
                </Text>
              </View>

              <Text style={styles.label}>Observaciones del abogado</Text>
              <View style={[styles.readonlyBox, styles.readonlyTall]}>
                <Text style={styles.readonlyText}>
                  {caseRow.lawyer_observations?.trim()
                    ? caseRow.lawyer_observations
                    : 'El abogado aún no dejó observaciones en este caso.'}
                </Text>
              </View>

              {hasRating ? (
                <View style={styles.ratingDone}>
                  <Text style={styles.ratingDoneTitle}>Tu calificación</Text>
                  <View style={styles.starsRow}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Ionicons
                        key={i}
                        name={i < (caseRow.client_rating ?? 0) ? 'star' : 'star-outline'}
                        size={22}
                        color={colors.chatSecondary}
                      />
                    ))}
                  </View>
                  {caseRow.client_rating_comment?.trim() ? (
                    <Text style={styles.ratingComment}>{caseRow.client_rating_comment}</Text>
                  ) : null}
                  {caseRow.client_rating_at ? (
                    <Text style={styles.ratingMeta}>
                      {relativeTimeEs(caseRow.client_rating_at)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {canFinalize ? (
                <TouchableOpacity
                  style={styles.finalizeBtn}
                  onPress={() => setRatingOpen(true)}
                  activeOpacity={0.88}
                >
                  <Ionicons name="star" size={20} color={colors.chatSurface} />
                  <Text style={styles.finalizeBtnText}>Finalizar caso y calificar abogado</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={ratingOpen} transparent animationType="fade" onRequestClose={() => setRatingOpen(false)}>
        <View style={styles.ratingBackdrop}>
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>¿Cómo fue tu experiencia?</Text>
            <Text style={styles.ratingSub}>
              Califica al abogado contratado en este caso (1 a 5 estrellas). Al confirmar, el caso se
              cerrará.
            </Text>
            <View style={styles.starsPick}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setStars(n)} hitSlop={8}>
                  <Ionicons
                    name={n <= stars ? 'star' : 'star-outline'}
                    size={36}
                    color={n <= stars ? colors.chatSecondary : colors.chatOutline}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.commentLabel}>Comentario (opcional)</Text>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Breve comentario sobre la atención recibida…"
              placeholderTextColor={colors.chatOutline}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.ratingActions}>
              <TouchableOpacity
                style={styles.ratingCancel}
                onPress={() => setRatingOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.ratingCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ratingOk, submitting && styles.ratingOkDisabled]}
                onPress={() => void submitFinalize()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.chatSurface} />
                ) : (
                  <Text style={styles.ratingOkText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.chatContainer },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.chatOutlineVariant + '44',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.chatPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  hintTop: {
    fontSize: 12,
    color: colors.chatOutline,
    lineHeight: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.chatOutline,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  value: { fontSize: 16, fontWeight: '700', color: colors.chatOnSurface, marginBottom: 14 },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.chatContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 16,
  },
  pillOk: { backgroundColor: '#d1fae5' },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.chatOnSurface,
    textTransform: 'uppercase',
  },
  pillTextOk: { color: '#047857' },
  readonlyBox: {
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
    borderRadius: 10,
    padding: 14,
    backgroundColor: colors.chatSurface,
    marginBottom: 14,
  },
  readonlyTall: { minHeight: 88 },
  readonlyText: {
    fontSize: 15,
    color: colors.chatOnSurface,
    lineHeight: 22,
  },
  ratingDone: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.chatPrimaryContainer,
    borderWidth: 1,
    borderColor: colors.chatSecondary + '33',
    marginBottom: 16,
  },
  ratingDoneTitle: { fontSize: 13, fontWeight: '800', color: colors.chatPrimary, marginBottom: 8 },
  starsRow: { flexDirection: 'row', gap: 4 },
  ratingComment: { marginTop: 10, fontSize: 14, color: colors.chatOnSurface, lineHeight: 20 },
  ratingMeta: { marginTop: 8, fontSize: 11, color: colors.chatOutline },
  finalizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.chatSecondary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  finalizeBtnText: { color: colors.chatSurface, fontSize: 15, fontWeight: '800' },
  ratingBackdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    padding: 24,
  },
  ratingCard: {
    backgroundColor: colors.chatSurface,
    borderRadius: 16,
    padding: 20,
  },
  ratingTitle: { fontSize: 18, fontWeight: '800', color: colors.chatPrimary, marginBottom: 8 },
  ratingSub: { fontSize: 13, color: colors.chatOutline, lineHeight: 20, marginBottom: 16 },
  starsPick: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  commentLabel: { fontSize: 12, fontWeight: '700', color: colors.chatOutline, marginBottom: 8 },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '99',
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    fontSize: 15,
    color: colors.chatOnSurface,
    marginBottom: 16,
  },
  ratingActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  ratingCancel: { paddingVertical: 12, paddingHorizontal: 16 },
  ratingCancelText: { fontSize: 15, fontWeight: '700', color: colors.chatOutline },
  ratingOk: {
    backgroundColor: colors.chatSecondary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  ratingOkDisabled: { opacity: 0.7 },
  ratingOkText: { color: colors.chatSurface, fontSize: 15, fontWeight: '800' },
});
