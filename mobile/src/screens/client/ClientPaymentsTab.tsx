import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { fetchClientTransactions } from '../../lib/legalDashboard';
import { formatUsd, relativeTimeEs } from '../../lib/format';
import { colors } from '../../theme/colors';

function statusLabel(s: string): string {
  switch (s) {
    case 'pending':
      return 'Pendiente';
    case 'approved':
      return 'Aprobado';
    case 'rejected':
      return 'Rechazado';
    default:
      return s;
  }
}

export default function ClientPaymentsTab({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<
    { id: string; amount: unknown; status: string; created_at: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchClientTransactions(clientId);
      setRows(data as { id: string; amount: unknown; status: string; created_at: string }[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar pagos');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.chatSecondary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Pagos</Text>
      <Text style={styles.sub}>Historial de transacciones y escrow.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {rows.length === 0 && !error ? (
        <Text style={styles.empty}>No hay pagos registrados.</Text>
      ) : (
        rows.map((tx) => (
          <View key={tx.id} style={styles.row}>
            <View>
              <Text style={styles.amount}>{formatUsd(Number(tx.amount ?? 0))}</Text>
              <Text style={styles.date}>{relativeTimeEs(tx.created_at)}</Text>
            </View>
            <View
              style={[
                styles.badge,
                tx.status === 'approved' && styles.badgeOk,
                tx.status === 'pending' && styles.badgePending,
                tx.status === 'rejected' && styles.badgeBad,
              ]}
            >
              <Text style={styles.badgeText}>{statusLabel(tx.status)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.chatPrimary, marginBottom: 8 },
  sub: { fontSize: 14, color: colors.chatOutline, marginBottom: 20 },
  error: { color: colors.error, marginBottom: 12 },
  empty: { fontSize: 15, color: colors.chatOutline, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  amount: { fontSize: 18, fontWeight: '700', color: colors.chatOnSurface },
  date: { fontSize: 12, color: colors.chatOutline, marginTop: 4 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.chatContainer,
  },
  badgeOk: { backgroundColor: '#d1fae5' },
  badgePending: { backgroundColor: colors.chatSecondaryContainer },
  badgeBad: { backgroundColor: colors.errorContainer },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: colors.chatOnSurface },
});
