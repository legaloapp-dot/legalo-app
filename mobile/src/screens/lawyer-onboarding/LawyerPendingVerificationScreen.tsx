import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../../components/Logo';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../theme/colors';

const SUPPORT_EMAIL = 'soporte@legalo.app';

export default function LawyerPendingVerificationScreen() {
  const { refreshProfile } = useAuth();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void refreshProfile();
    });
    const interval = setInterval(() => void refreshProfile(), 45000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [refreshProfile]);

  const contactSupport = () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=Verificación%20de%20perfil%20LÉGALO`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Soporte', `Escríbenos a ${SUPPORT_EMAIL}`)
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.blob} pointerEvents="none" />
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Logo size="small" />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Ayuda',
                'Tu perfil está en revisión. Cuando un administrador lo apruebes, podrás usar la app con normalidad.'
              )
            }
            hitSlop={12}
          >
            <Text style={styles.headerLink}>Ayuda</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Cerrar sesión', '¿Salir de la cuenta?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Cerrar sesión', style: 'destructive', onPress: () => void supabase.auth.signOut() },
              ])
            }
            hitSlop={12}
          >
            <Text style={styles.headerLogout}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.cardAnchor}>
          <View style={styles.cardGlow} />
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={44} color={colors.primary} />
            </View>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>Verificación en curso</Text>
            </View>
          </View>
        </View>

        <Text style={styles.title}>
          Estamos validando tu{'\n'}perfil profesional
        </Text>
        <Text style={styles.body}>
          Estamos verificando tus credenciales con el Colegio de Abogados. Recibirás una notificación
          en menos de 24 horas para empezar a recibir casos.
        </Text>

        <View style={styles.grid}>
          <View style={[styles.infoCard, styles.infoCardBrown]}>
            <Ionicons name="time-outline" size={22} color={colors.secondary} />
            <Text style={styles.infoTitle}>Tiempo estimado</Text>
            <Text style={styles.infoBody}>
              El proceso suele completarse en el transcurso del primer día hábil.
            </Text>
          </View>
          <View style={[styles.infoCard, styles.infoCardBlue]}>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            <Text style={styles.infoTitle}>Notificación push</Text>
            <Text style={styles.infoBody}>
              Te enviaremos un correo y una notificación una vez aprobada tu cuenta.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.supportWrap} onPress={contactSupport} activeOpacity={0.7}>
          <Text style={styles.supportLine}>
            ¿TIENES DUDAS SOBRE EL PROCESO?{' '}
            <Text style={styles.supportCta}>CONTACTAR SOPORTE</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  blob: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.secondary,
    opacity: 0.12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logoWrap: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: colors.secondaryContainer + '99',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  headerLink: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.outline,
  },
  headerLogout: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.error,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  cardAnchor: {
    marginTop: 16,
    marginBottom: 28,
    alignItems: 'center',
  },
  cardGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.secondary,
    opacity: 0.06,
    top: -20,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 8,
    maxWidth: 400,
    width: '100%',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryContainer + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLow,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.secondary,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 400,
    marginBottom: 28,
  },
  grid: {
    width: '100%',
    maxWidth: 440,
    gap: 12,
  },
  infoCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 18,
    borderLeftWidth: 2,
  },
  infoCardBrown: {
    borderLeftColor: colors.secondary,
  },
  infoCardBlue: {
    borderLeftColor: colors.primary,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  supportWrap: {
    marginTop: 32,
    paddingVertical: 8,
  },
  supportLine: {
    fontSize: 11,
    textAlign: 'center',
    color: colors.outline,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    lineHeight: 20,
  },
  supportCta: {
    color: colors.secondary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
