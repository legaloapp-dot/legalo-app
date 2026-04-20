import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { Profile } from '../../types/profile';
import { calendarDaysUntil, planLabelEs } from '../../lib/subscription';
import { styles } from './styles';

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
