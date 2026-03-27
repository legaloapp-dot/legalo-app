import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { LegalCaseRow } from '../lib/legalDashboard';

function formatRatingDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function StarsRow({ value }: { value: number }) {
  const n = Math.round(value);
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= n ? 'star' : 'star-outline'}
          size={18}
          color={colors.secondary}
        />
      ))}
    </View>
  );
}

export default function LawyerRatingsModal({
  visible,
  onClose,
  averageRating,
  ratedCases,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  averageRating: number | null;
  ratedCases: LegalCaseRow[];
  loading?: boolean;
}) {
  const avg =
    averageRating != null && !Number.isNaN(Number(averageRating))
      ? Number(averageRating).toFixed(1)
      : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.headerBtn} accessibilityRole="button">
            <Ionicons name="close" size={26} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Valoraciones</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.summary}>
          <Ionicons name="star" size={28} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Promedio en tu perfil</Text>
            <Text style={styles.summaryValue}>
              {avg != null ? `${avg} / 5.0` : 'Sin datos aún'}
            </Text>
            <Text style={styles.summaryHint}>
              {ratedCases.length === 0
                ? 'Cuando un cliente cierre un caso y te califique, aparecerá aquí.'
                : `${ratedCases.length} valoración${ratedCases.length === 1 ? '' : 'es'} de clientes`}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={ratedCases}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.outline} />
                <Text style={styles.emptyTitle}>Aún no hay valoraciones</Text>
                <Text style={styles.emptySub}>
                  Las calificaciones se registran cuando el cliente finaliza un caso y evalúa la atención
                  recibida.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.caseTitle} numberOfLines={2}>
                    {item.title?.trim() || 'Caso'}
                  </Text>
                  <StarsRow value={item.client_rating ?? 0} />
                </View>
                {item.client_rating_comment?.trim() ? (
                  <Text style={styles.comment}>"{item.client_rating_comment.trim()}"</Text>
                ) : (
                  <Text style={styles.noComment}>Sin comentario</Text>
                )}
                {item.client_display_name?.trim() ? (
                  <Text style={styles.clientHint}>Cliente: {item.client_display_name.trim()}</Text>
                ) : null}
                {item.client_rating_at ? (
                  <Text style={styles.date}>{formatRatingDate(item.client_rating_at)}</Text>
                ) : null}
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '66',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.primary },
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '44',
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: colors.outline, textTransform: 'uppercase' },
  summaryValue: { fontSize: 22, fontWeight: '900', color: colors.primary, marginTop: 4 },
  summaryHint: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 6, lineHeight: 18 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  listContent: { padding: 20, paddingBottom: 40, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '800', color: colors.primary },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '55',
  },
  cardTop: { gap: 8 },
  caseTitle: { fontSize: 15, fontWeight: '800', color: colors.primary },
  starsRow: { flexDirection: 'row', gap: 2 },
  comment: {
    marginTop: 10,
    fontSize: 14,
    color: colors.onSurface,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  noComment: { marginTop: 8, fontSize: 13, color: colors.outline, fontStyle: 'italic' },
  clientHint: { marginTop: 10, fontSize: 12, fontWeight: '600', color: colors.secondary },
  date: { marginTop: 6, fontSize: 11, color: colors.outline },
});
