import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Profile } from '../../types/profile';
import { colors } from '../../theme/colors';
import LawyerSubscriptionCard from '../../components/LawyerSubscriptionCard';

export default function LawyerPaymentsTab({
  profile,
  refreshing,
  onRefresh,
}: {
  profile: Profile | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Pagos y suscripción</Text>
      <Text style={styles.sub}>
        Aquí ves el estado de tu suscripción a LÉGALO. Los pagos de la plataforma los confirma el equipo;
        si necesitas facturación o renovación, contacta por los canales oficiales.
      </Text>

      <LawyerSubscriptionCard profile={profile} />

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
        <Text style={styles.infoText}>
          El plan Premium mantiene tu perfil con prioridad en el directorio. El plan básico aplica cuando
          termina la prueba sin renovación activa.
        </Text>
      </View>
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
    lineHeight: 20,
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.tertiaryContainer + '55',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '66',
  },
  infoText: { flex: 1, fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 20 },
});
