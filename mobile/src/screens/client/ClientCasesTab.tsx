import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchClientCases, caseStatusLabel, type LegalCaseRow } from '../../lib/legalDashboard';
import { relativeTimeEs } from '../../lib/format';
import { colors } from '../../theme/colors';

export default function ClientCasesTab({ clientId }: { clientId: string }) {
  const [cases, setCases] = useState<LegalCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchClientCases(clientId);
      setCases(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar casos');
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
      <Text style={styles.title}>Mis casos</Text>
      <Text style={styles.sub}>
        Asuntos vinculados a tu cuenta cuando un abogado te represente en LÉGALO.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {cases.length === 0 && !error ? (
        <Text style={styles.empty}>No tienes casos registrados todavía.</Text>
      ) : (
        cases.map((c) => {
          const pill = caseStatusLabel(c.status);
          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardIcon}>
                <Ionicons name="folder-open-outline" size={22} color={colors.chatSecondary} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardMeta}>
                  {c.last_activity?.trim()
                    ? c.last_activity
                    : `Última actividad: ${relativeTimeEs(c.last_activity_at)}`}
                </Text>
                <View style={[styles.pill, pill.tone === 'success' && styles.pillOk]}>
                  <Text style={[styles.pillText, pill.tone === 'success' && styles.pillTextOk]}>
                    {pill.text}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.chatPrimary, marginBottom: 8 },
  sub: { fontSize: 14, color: colors.chatOutline, lineHeight: 20, marginBottom: 20 },
  error: { color: colors.error, marginBottom: 12, fontSize: 13 },
  empty: { fontSize: 15, color: colors.chatOutline, fontStyle: 'italic' },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.chatPrimaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.chatOnSurface },
  cardMeta: { fontSize: 12, color: colors.chatOutline, marginTop: 6 },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: colors.chatContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillOk: { backgroundColor: '#d1fae5' },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.chatOnSurface,
    textTransform: 'uppercase',
  },
  pillTextOk: { color: '#047857' },
});
