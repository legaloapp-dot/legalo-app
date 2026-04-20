import React, { useState } from 'react';
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
import { LAWYER_SPECIALTY_OPTIONS } from '../../config/specialties';
import type { SpecialtyId } from '../../types/lawyers';

export type { SpecialtyId };
export { LAWYER_SPECIALTY_OPTIONS };

const BIO_MAX = 300;

/** Alias para compatibilidad interna del paso 1 */
const SPECIALTIES = LAWYER_SPECIALTY_OPTIONS;

interface LawyerOnboardingStep1ScreenProps {
  userId: string;
  onContinue: () => void;
  onBack: () => void;
}

export default function LawyerOnboardingStep1Screen({
  userId,
  onContinue,
  onBack,
}: LawyerOnboardingStep1ScreenProps) {
  const [specialty, setSpecialty] = useState<SpecialtyId | null>(null);
  const [specialtyOther, setSpecialtyOther] = useState('');
  const [yearsText, setYearsText] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const yearsNum = yearsText.trim() === '' ? null : parseInt(yearsText, 10);
  const yearsInvalid =
    yearsText.trim() !== '' && (Number.isNaN(yearsNum) || yearsNum! < 0 || yearsNum! > 80);

  const handleContinue = async () => {
    if (!specialty) {
      Alert.alert('Especialidad', 'Selecciona tu especialidad principal.');
      return;
    }
    if (specialty === 'Otro' && !specialtyOther.trim()) {
      Alert.alert('Especialidad', 'Indica cuál es tu especialidad.');
      return;
    }
    if (yearsInvalid) {
      Alert.alert('Experiencia', 'Introduce un número válido de años (0–80).');
      return;
    }
    if (bio.length > BIO_MAX) {
      Alert.alert('Bio', `Máximo ${BIO_MAX} caracteres.`);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          specialty: specialty === 'Otro' ? 'Otro' : specialty,
          specialty_other: specialty === 'Otro' ? specialtyOther.trim() : null,
          years_experience: yearsNum,
          professional_bio: bio.trim() || null,
          lawyer_onboarding_step: 2,
        })
        .eq('id', userId);

      if (error) throw error;
      onContinue();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarSide}>
            <TouchableOpacity onPress={onBack} style={styles.iconBtn} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Logo size="small" style={styles.logoTiny} />
          </View>
          <Text style={styles.brand} numberOfLines={1}>
            LÉGALO
          </Text>
          <View style={[styles.topBarSide, styles.topBarSideEnd]}>
            <TouchableOpacity
              style={styles.iconBtn}
              hitSlop={12}
              onPress={() =>
                Alert.alert(
                  'Ayuda',
                  'Completa tu perfil para que los clientes te encuentren según tu especialidad.'
                )
              }
            >
              <Ionicons name="help-circle-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressHeader}>
            <Text style={styles.progressLeft}>Paso 1 de 4</Text>
            <Text style={styles.progressRight}>Perfil Profesional</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>

          <Text style={styles.title}>Perfil Profesional</Text>
          <Text style={styles.subtitle}>
            Define tu especialidad para que la IA te recomiende a los clientes adecuados.
          </Text>

          <Text style={styles.fieldLabel}>Especialidad Principal</Text>
          <View style={styles.grid}>
            {SPECIALTIES.map((item) => {
              const selected = specialty === item.id;
              const isOtro = item.id === 'Otro';
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.gridCard,
                    isOtro && styles.gridCardOtro,
                    selected && styles.gridCardSelected,
                  ]}
                  onPress={() => setSpecialty(item.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={item.icon}
                    size={26}
                    color={selected ? colors.onPrimary : isOtro ? colors.outline : colors.primary}
                  />
                  <Text
                    style={[
                      styles.gridLabel,
                      selected && styles.gridLabelSelected,
                      isOtro && !selected && styles.gridLabelMuted,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {specialty === 'Otro' && (
            <TextInput
              style={styles.otherInput}
              placeholder="Especifica tu especialidad"
              placeholderTextColor={colors.outline + '99'}
              value={specialtyOther}
              onChangeText={setSpecialtyOther}
              maxLength={80}
            />
          )}

          <Text style={styles.fieldLabel}>Años de Experiencia</Text>
          <View style={styles.yearsRow}>
            <TextInput
              style={[styles.yearsInput, yearsInvalid && styles.inputError]}
              placeholder="Ej: 10"
              placeholderTextColor={colors.outline + '99'}
              value={yearsText}
              onChangeText={(t) => setYearsText(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.yearsSuffix}>años</Text>
          </View>

          <View style={styles.bioHeader}>
            <Text style={styles.fieldLabel}>Bio Profesional</Text>
            <Text style={styles.bioCount}>
              {bio.length}/{BIO_MAX} caracteres
            </Text>
          </View>
          <TextInput
            style={styles.bioInput}
            placeholder="Resume tu trayectoria y fortalezas..."
            placeholderTextColor={colors.outline + '99'}
            value={bio}
            onChangeText={(t) => t.length <= BIO_MAX && setBio(t)}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.bioHint}>
            Este resumen será visible para clientes potenciales en tu perfil público.
          </Text>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, saving && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.continueText}>Continuar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  topBarSide: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarSideEnd: {
    justifyContent: 'flex-end',
  },
  iconBtn: { padding: 4 },
  logoTiny: { width: 32, height: 28, marginBottom: 0 },
  brand: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#002366',
    letterSpacing: -0.3,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLeft: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.secondary,
  },
  progressRight: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.outline,
  },
  progressTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
    marginBottom: 28,
  },
  progressFill: {
    width: '25%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.primary,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  gridCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: '45%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  gridCardOtro: {
    backgroundColor: colors.surfaceContainerLow,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant + 'AA',
  },
  gridCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  gridLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  gridLabelSelected: {
    color: colors.onPrimary,
  },
  gridLabelMuted: {
    color: colors.outline,
  },
  otherInput: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.primary,
    marginBottom: 24,
    marginTop: 4,
  },
  yearsRow: {
    position: 'relative',
    marginBottom: 24,
  },
  yearsInput: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingRight: 72,
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  yearsSuffix: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -10,
    fontSize: 15,
    fontWeight: '500',
    color: colors.outline,
  },
  inputError: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  bioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  bioCount: {
    fontSize: 10,
    color: colors.outline,
    marginBottom: 4,
  },
  bioInput: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 15,
    color: colors.primary,
    minHeight: 120,
    lineHeight: 22,
  },
  bioHint: {
    fontSize: 12,
    color: colors.outlineVariant,
    fontStyle: 'italic',
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 8,
    backgroundColor: colors.surfaceContainerLow + 'CC',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '22',
  },
  continueBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  continueBtnDisabled: { opacity: 0.85 },
  continueText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
});
