import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { calendarDaysUntil, shouldShowTrialExpiryBanner } from '../../lib/subscription';
import { styles } from './styles';

export default function ExpirationBanner({
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
