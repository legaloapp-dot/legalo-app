import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { calendarDaysUntil, shouldShowTrialExpiryBanner } from '../lib/subscription';

/**
 * Solo visible para abogados en prueba con 1–5 días restantes antes del vencimiento.
 */
export default function BannerVencimiento({
  plan,
  subscriptionExpiresAt,
}: {
  plan: string | null | undefined;
  subscriptionExpiresAt: string | null | undefined;
}) {
  if (!shouldShowTrialExpiryBanner(plan, subscriptionExpiresAt)) return null;
  const days = calendarDaysUntil(subscriptionExpiresAt)!;

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={22} color={colors.onPrimary} style={styles.icon} />
      <View style={styles.textCol}>
        <Text style={styles.title}>Tu periodo de prueba termina pronto</Text>
        <Text style={styles.body}>
          Quedan {days} {days === 1 ? 'día' : 'días'} de visibilidad completa en el directorio. Suscríbete
          para mantener tu perfil entre los abogados con prioridad y no pasar a plan básico.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  icon: { marginTop: 2 },
  textCol: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onPrimary,
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    color: colors.onPrimary,
    lineHeight: 19,
    opacity: 0.95,
  },
});
