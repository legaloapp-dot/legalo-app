import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { sortLawyerCasesForDisplay, type LegalCaseRow } from '../../lib/legalDashboard';
import { colors } from '../../theme/colors';
import LawyerCaseList from './LawyerCaseList';

export default function LawyerCasosPanel({
  cases,
  refreshing,
  onRefresh,
  onSelectCase,
}: {
  cases: LegalCaseRow[];
  refreshing: boolean;
  onRefresh: () => void;
  onSelectCase: (c: LegalCaseRow) => void;
}) {
  const sorted = sortLawyerCasesForDisplay(cases);
  const pendingCount = cases.filter((c) => c.status === 'pending_approval').length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Mis casos</Text>
      <Text style={styles.sub}>
        Solicitudes pendientes de tu respuesta, casos en curso y cerrados. Toca una tarjeta para ver
        el detalle o responder.
      </Text>

      {pendingCount > 0 ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerText}>
            Tienes {pendingCount} {pendingCount === 1 ? 'caso pendiente' : 'casos pendientes'} de
            aprobación. Toca una tarjeta para aceptar o rechazar.
          </Text>
        </View>
      ) : null}

      <LawyerCaseList
        cases={sorted}
        onSelectCase={onSelectCase}
        emptyHint="No hay casos todavía. Cuando un cliente te contrate, aparecerán aquí."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  sub: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: 16,
    lineHeight: 20,
  },
  pendingBanner: {
    backgroundColor: colors.tertiaryContainer + 'AA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  pendingBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    lineHeight: 20,
  },
});
