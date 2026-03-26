import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { Profile } from '../types/profile';
import { calendarDaysUntil, planLabelEs } from '../lib/subscription';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-VE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function LawyerSubscriptionCard({ profile }: { profile: Profile | null }) {
  if (!profile) return null;
  const plan = profile.plan;
  const expires = profile.subscription_expires_at;
  const paid = profile.subscription_paid_at;
  const days = calendarDaysUntil(expires);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
        <Text style={styles.title}>Suscripción</Text>
      </View>
      <Text style={styles.planLine}>{planLabelEs(plan)}</Text>
      {plan === 'trial' && expires ? (
        <Text style={styles.line}>
          {days != null && days >= 0
            ? `Prueba: quedan ${days} ${days === 1 ? 'día' : 'días'} (hasta ${fmtDate(expires)}).`
            : `Prueba hasta ${fmtDate(expires)}.`}
        </Text>
      ) : expires ? (
        <Text style={styles.line}>Vigencia hasta: {fmtDate(expires)}</Text>
      ) : (
        <Text style={styles.muted}>Sin fecha de vigencia registrada.</Text>
      )}
      <Text style={styles.lineMuted}>
        Último pago registrado: {fmtDate(paid ?? null)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '88',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 13, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },
  planLine: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 6 },
  line: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 20 },
  lineMuted: { fontSize: 12, color: colors.outline, marginTop: 8 },
  muted: { fontSize: 13, color: colors.outline, fontStyle: 'italic' },
});
