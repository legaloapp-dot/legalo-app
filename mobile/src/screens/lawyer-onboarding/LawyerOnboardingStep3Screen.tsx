import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../../components/Logo';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

/** Solo dígitos nacionales (10), ej. 4121234567 → almacenado +584121234567 */
function digitsNational(raw: string): string {
  return raw.replace(/\D/g, '');
}

function toE164Ve(national10: string): string {
  const d = national10.replace(/\D/g, '');
  if (d.length !== 10) return '';
  return `+58${d}`;
}

function formatDisplay(national10: string): string {
  const d = digitsNational(national10).slice(0, 10);
  if (d.length <= 3) return d;
  return `${d.slice(0, 3)} ${d.slice(3)}`;
}

function parseInitialPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return '';
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('58')) d = d.slice(2);
  return d.slice(0, 10);
}

interface LawyerOnboardingStep3ScreenProps {
  userId: string;
  initialPhone?: string | null;
  onComplete: () => void;
  onBack: () => void | Promise<void>;
}

export default function LawyerOnboardingStep3Screen({
  userId,
  initialPhone,
  onComplete,
  onBack,
}: LawyerOnboardingStep3ScreenProps) {
  const [primary, setPrimary] = useState(() => parseInitialPhone(initialPhone ?? null));
  const [confirm, setConfirm] = useState(() => parseInitialPhone(initialPhone ?? null));
  const [saving, setSaving] = useState(false);

  const primaryDigits = useMemo(() => digitsNational(primary).slice(0, 10), [primary]);
  const confirmDigits = useMemo(() => digitsNational(confirm).slice(0, 10), [confirm]);

  const setPrimaryFromText = (t: string) => {
    const d = digitsNational(t).slice(0, 10);
    setPrimary(d);
  };

  const setConfirmFromText = (t: string) => {
    const d = digitsNational(t).slice(0, 10);
    setConfirm(d);
  };

  const handleContinue = async () => {
    if (primaryDigits.length !== 10) {
      Alert.alert('WhatsApp', 'Introduce un número móvil venezolano de 10 dígitos (ej. 412 1234567).');
      return;
    }
    if (!primaryDigits.startsWith('4')) {
      Alert.alert('WhatsApp', 'El número móvil debe comenzar por 4 (ej. 412, 414, 424).');
      return;
    }
    if (primaryDigits !== confirmDigits) {
      Alert.alert('Confirmación', 'Los números no coinciden. Repite el mismo número en ambos campos.');
      return;
    }

    const e164 = toE164Ve(primaryDigits);
    if (!e164) {
      Alert.alert('WhatsApp', 'Número no válido.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          phone: e164,
          lawyer_onboarding_step: 4,
        })
        .eq('id', userId);

      if (error) throw error;
      onComplete();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar el número.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.topNav}>
          <View style={styles.topNavLeft}>
            <TouchableOpacity onPress={() => void onBack()} style={styles.iconBtn} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.outline} />
            </TouchableOpacity>
            <Text style={styles.topBrand}>LÉGALO</Text>
          </View>
          <View style={styles.topNavRight}>
            <Text style={styles.stepPill}>Paso 3 de 4</Text>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroLogoBox}>
              <Logo size="small" style={styles.heroLogo} />
            </View>
            <View style={styles.heroLine} />
          </View>

          <Text style={styles.title}>Configuración de Contacto</Text>
          <Text style={styles.subtitle}>
            Para que tus clientes puedan contactarte directamente, necesitamos validar tu número de
            WhatsApp.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Número de WhatsApp</Text>
            <View style={styles.waRow}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color={colors.primary + '99'}
                style={styles.waChatIcon}
              />
              <View style={styles.waInputWrap}>
                <View style={styles.prefixBox}>
                  <Text style={styles.flag}>🇻🇪</Text>
                  <Text style={styles.prefixText}>+58</Text>
                </View>
                <TextInput
                  style={styles.waInput}
                  placeholder="412 1234567"
                  placeholderTextColor={colors.outline + 'AA'}
                  value={formatDisplay(primaryDigits)}
                  onChangeText={setPrimaryFromText}
                  keyboardType="phone-pad"
                  maxLength={12}
                />
              </View>
            </View>

            <Text style={[styles.label, styles.labelSp]}>Confirmar número de WhatsApp</Text>
            <View style={styles.confirmWrap}>
              <Ionicons
                name="checkmark-circle-outline"
                size={22}
                color={colors.primary + '99'}
                style={styles.confirmIcon}
              />
              <TextInput
                style={styles.confirmInput}
                placeholder="Repite tu número"
                placeholderTextColor={colors.outline + 'AA'}
                value={formatDisplay(confirmDigits)}
                onChangeText={setConfirmFromText}
                keyboardType="phone-pad"
                maxLength={12}
              />
            </View>

            <TouchableOpacity
              style={[styles.cta, saving && styles.ctaDisabled]}
              onPress={() => void handleContinue()}
              disabled={saving}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Text style={styles.ctaText}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={22} color={colors.onPrimary} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.legalBox}>
              <Ionicons name="hammer-outline" size={18} color={colors.secondary} />
              <Text style={styles.legalText}>
                Tus datos están protegidos bajo estándares de seguridad jurídica.
              </Text>
            </View>
          </View>

          <View style={styles.supportBlock}>
            <Text style={styles.supportLabel}>Asistencia técnica</Text>
            <Text style={styles.supportBody}>
              ¿No recibes el código? Asegúrate de que tu número esté vinculado a una cuenta activa
              de WhatsApp Business para una mejor experiencia profesional.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.bottomItem}
            onPress={() =>
              Alert.alert(
                'Ayuda',
                'Usa el mismo número que tienes en WhatsApp. Sin espacios extra: código de área (412, 414, etc.) y siete dígitos.'
              )
            }
          >
            <Ionicons name="help-circle-outline" size={22} color={colors.outline} />
            <Text style={styles.bottomLabel}>Ayuda</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomItem}
            onPress={() => {
              Alert.alert('Salir', '¿Cerrar sesión?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: () => void supabase.auth.signOut() },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.outline} />
            <Text style={styles.bottomLabel}>Salir</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },

  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  topBrand: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: '#002366',
  },
  topNavRight: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  stepPill: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#002366',
    marginBottom: 6,
  },
  progressTrack: {
    width: 128,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
  },
  progressFill: {
    width: '75%',
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  iconBtn: { padding: 4 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  heroLogoBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLogo: { width: 44, height: 44 },
  heroLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.surfaceContainerLow,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.8,
    lineHeight: 40,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: colors.onSurfaceVariant,
    lineHeight: 26,
    marginBottom: 28,
    maxWidth: 520,
  },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginBottom: 10,
  },
  labelSp: { marginTop: 20 },
  waRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waChatIcon: {
    marginBottom: 2,
  },
  waInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 52,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceContainerHigh,
    borderRightWidth: 1,
    borderRightColor: colors.outlineVariant + '33',
    gap: 6,
  },
  flag: { fontSize: 18 },
  prefixText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  waInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  confirmWrap: {
    position: 'relative',
  },
  confirmIcon: {
    position: 'absolute',
    left: 14,
    top: 15,
    zIndex: 2,
  },
  confirmInput: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingVertical: 14,
    paddingLeft: 44,
    paddingRight: 16,
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },

  cta: {
    marginTop: 28,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaDisabled: { opacity: 0.85 },
  ctaText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  legalBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 20,
    padding: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8,
  },
  legalText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },

  supportBlock: {
    marginTop: 36,
    marginLeft: 8,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: colors.secondary,
  },
  supportLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginBottom: 8,
  },
  supportBody: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.surface + 'E6',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '22',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  bottomItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
    gap: 4,
  },
  bottomLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.outline,
  },
});
