import React, { useEffect, useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/profile';
import {
  LAWYER_SPECIALTY_OPTIONS,
  type SpecialtyId,
} from '../lawyer-onboarding/LawyerOnboardingStep1Screen';
import { colors } from '../../theme/colors';

const BIO_MAX = 600;

export default function LawyerProfileEditTab({
  profile,
  userId,
  email,
  onSignOut,
  onClose,
  refreshProfile,
}: {
  profile: Profile | null;
  userId: string | undefined;
  email: string;
  onSignOut: () => void;
  onClose: () => void;
  refreshProfile: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [inpre, setInpre] = useState('');
  const [specialty, setSpecialty] = useState<SpecialtyId | null>(null);
  const [specialtyOther, setSpecialtyOther] = useState('');
  const [yearsText, setYearsText] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name?.trim() ?? '');
    setPhone(profile.phone?.trim() ?? '');
    setInpre(profile.inpre_number?.trim() ?? '');
    const knownIds = new Set(LAWYER_SPECIALTY_OPTIONS.map((o) => o.id));
    const s = profile.specialty?.trim() || null;
    if (s && knownIds.has(s as SpecialtyId)) {
      setSpecialty(s as SpecialtyId);
      setSpecialtyOther(s === 'Otro' ? profile.specialty_other?.trim() ?? '' : '');
    } else if (s) {
      setSpecialty('Otro');
      setSpecialtyOther(profile.specialty_other?.trim() || s);
    } else {
      setSpecialty(null);
      setSpecialtyOther('');
    }
    const y = profile.years_experience;
    setYearsText(y != null && y >= 0 ? String(y) : '');
    setBio(profile.professional_bio?.trim() ?? '');
  }, [profile]);

  const yearsNum = yearsText.trim() === '' ? null : parseInt(yearsText, 10);
  const yearsInvalid =
    yearsText.trim() !== '' && (Number.isNaN(yearsNum) || yearsNum! < 0 || yearsNum! > 80);

  const handleSave = async () => {
    if (!userId) return;
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
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          inpre_number: inpre.trim() || null,
          specialty: specialty === 'Otro' ? 'Otro' : specialty,
          specialty_other: specialty === 'Otro' ? specialtyOther.trim() : null,
          years_experience: yearsNum,
          professional_bio: bio.trim() || null,
        })
        .eq('id', userId);

      if (error) throw error;
      await refreshProfile();
      Alert.alert('Guardado', 'Tu perfil profesional se actualizó.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mi perfil</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color={colors.primary} />
          </View>
          <Text style={styles.email}>{email}</Text>

          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Tu nombre"
            placeholderTextColor={colors.outline}
          />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+58 …"
            placeholderTextColor={colors.outline}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Número INPRE (opcional)</Text>
          <TextInput
            style={styles.input}
            value={inpre}
            onChangeText={setInpre}
            placeholder="Registro profesional"
            placeholderTextColor={colors.outline}
          />

          <Text style={styles.label}>Especialidad principal</Text>
          <View style={styles.specGrid}>
            {LAWYER_SPECIALTY_OPTIONS.map((opt) => {
              const on = specialty === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.specChip, on && styles.specChipOn]}
                  onPress={() => setSpecialty(opt.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={on ? colors.primary : colors.outline}
                  />
                  <Text style={[styles.specChipText, on && styles.specChipTextOn]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {specialty === 'Otro' ? (
            <>
              <Text style={styles.label}>Describe tu especialidad</Text>
              <TextInput
                style={styles.input}
                value={specialtyOther}
                onChangeText={setSpecialtyOther}
                placeholder="Ej.: Derecho deportivo"
                placeholderTextColor={colors.outline}
              />
            </>
          ) : null}

          <Text style={styles.label}>Años de experiencia</Text>
          <TextInput
            style={styles.input}
            value={yearsText}
            onChangeText={setYearsText}
            placeholder="0"
            placeholderTextColor={colors.outline}
            keyboardType="number-pad"
          />
          {yearsInvalid ? (
            <Text style={styles.errHint}>Introduce un número entre 0 y 80.</Text>
          ) : null}

          <Text style={styles.label}>Bio profesional</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={bio}
            onChangeText={setBio}
            placeholder="Breve descripción para clientes"
            placeholderTextColor={colors.outline}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.counter}>
            {bio.length}/{BIO_MAX}
          </Text>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.signOutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.primary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  email: {
    fontSize: 14,
    color: colors.outline,
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.onSurfaceVariant,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.outlineVariant + '99',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 16,
  },
  inputMultiline: { minHeight: 120, paddingTop: 12 },
  errHint: { color: colors.error, fontSize: 12, marginTop: -10, marginBottom: 12 },
  counter: { fontSize: 12, color: colors.outline, textAlign: 'right', marginTop: -10, marginBottom: 16 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '99',
    backgroundColor: colors.surfaceContainerLow,
  },
  specChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  specChipText: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  specChipTextOn: { color: colors.primary, fontWeight: '700' },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  signOutText: { color: colors.error, fontSize: 16, fontWeight: '700' },
});
