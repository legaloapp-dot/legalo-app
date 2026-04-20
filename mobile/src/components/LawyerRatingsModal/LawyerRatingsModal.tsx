import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { LegalCaseRow } from '../../lib/legalDashboard';
import { styles } from './styles';

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
