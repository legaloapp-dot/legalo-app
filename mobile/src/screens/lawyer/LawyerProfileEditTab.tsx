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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/profile';
import {
  LAWYER_SPECIALTY_OPTIONS,
  type SpecialtyId,
} from '../lawyer-onboarding/LawyerOnboardingStep1Screen';
import { colors } from '../../theme/colors';
import LocationAutocompleteInput from '../../components/LocationAutocompleteInput';
import LawyerSubscriptionCard from '../../components/LawyerSubscriptionCard';

const BIO_MAX = 600;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function LawyerProfileEditTab({
  profile,
  userId,
  email,
  onSignOut,
  onClose,
  refreshProfile,
  headerRight,
  topBanner,
}: {
  profile: Profile | null;
  userId: string | undefined;
  email: string;
  onSignOut: () => void;
  onClose: () => void;
  refreshProfile: () => Promise<void>;
  headerRight?: React.ReactNode;
  /** Aviso de fin de periodo de prueba (solo abogado) */
  topBanner?: React.ReactNode;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [inpre, setInpre] = useState('');
  const [specialty, setSpecialty] = useState<SpecialtyId | null>(null);
  const [specialtyOther, setSpecialtyOther] = useState('');
  const [yearsText, setYearsText] = useState('');
  const [bio, setBio] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

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
    setLocationLabel(profile.location_label?.trim() ?? '');
    setLatitude(profile.latitude != null && !Number.isNaN(Number(profile.latitude)) ? Number(profile.latitude) : null);
    setLongitude(
      profile.longitude != null && !Number.isNaN(Number(profile.longitude)) ? Number(profile.longitude) : null
    );
  }, [profile]);

  const yearsNum = yearsText.trim() === '' ? null : parseInt(yearsText, 10);
  const yearsInvalid =
    yearsText.trim() !== '' && (Number.isNaN(yearsNum) || yearsNum! < 0 || yearsNum! > 80);

  const labelFromGeocode = (r: Location.LocationGeocodedAddress): string => {
    const line1 =
      r.streetNumber && r.street
        ? `${r.streetNumber} ${r.street}`
        : r.street || r.name || undefined;
    const parts = [line1, r.district || r.city || r.subregion, r.region].filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0
    );
    if (parts.length > 0) return parts.join(', ');
    return [r.city, r.region, r.country].filter(Boolean).join(', ');
  };

  const pickOfficeLocation = async () => {
    setLocationBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos', 'Activa la ubicación para guardar las coordenadas de tu consultorio.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const label = rev[0] ? labelFromGeocode(rev[0]) : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setLatitude(lat);
      setLongitude(lng);
      setLocationLabel(label.trim());
    } catch (e) {
      Alert.alert('Ubicación', e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
    } finally {
      setLocationBusy(false);
    }
  };

  const clearOfficeLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setLocationLabel('');
  };

  const pickAndUploadAvatar = async () => {
    if (!userId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos', 'Necesitamos acceso a la galería para subir tu foto.');
      return;
    }
    // En Android el recorte nativo (allowsEditing) depende de cada marca y a veces no muestra
    // un botón claro para confirmar. En iOS el flujo suele ser claro; en Android usamos la foto tal cual (se ve en círculo).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS === 'ios',
      ...(Platform.OS === 'ios' ? { aspect: [1, 1] as [number, number] } : {}),
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mime = asset.mimeType ?? 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const path = `${userId}/avatar.${ext}`;

    setAvatarUploading(true);
    try {
      const { data: existing } = await supabase.storage.from('avatars').list(userId);
      if (existing?.length) {
        await supabase.storage
          .from('avatars')
          .remove(existing.map((f) => `${userId}/${f.name}`));
      }

      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const buffer = base64ToArrayBuffer(base64);
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, buffer, {
        upsert: true,
        contentType: mime,
        cacheControl: '3600',
      });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
      if (dbErr) throw dbErr;
      await refreshProfile();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo subir la foto.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const confirmRemoveAvatar = () => {
    if (!userId || !profile?.avatar_url) return;
    Alert.alert('Quitar foto', '¿Eliminar tu foto de perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => void removeAvatar(),
      },
    ]);
  };

  const removeAvatar = async () => {
    if (!userId) return;
    setAvatarUploading(true);
    try {
      const { data: files } = await supabase.storage.from('avatars').list(userId);
      if (files?.length) {
        const { error: rmErr } = await supabase.storage
          .from('avatars')
          .remove(files.map((f) => `${userId}/${f.name}`));
        if (rmErr) throw rmErr;
      }
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
      if (error) throw error;
      await refreshProfile();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo quitar la foto.');
    } finally {
      setAvatarUploading(false);
    }
  };

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
          latitude: latitude,
          longitude: longitude,
          location_label: locationLabel.trim() || null,
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
          <View style={styles.headerBtn}>{headerRight ?? null}</View>
        </View>

        {topBanner ? <View style={styles.topBannerSlot}>{topBanner}</View> : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <LawyerSubscriptionCard profile={profile} />
          <View style={styles.avatarBlock}>
            <TouchableOpacity
              style={styles.avatarTouchable}
              onPress={() => void pickAndUploadAvatar()}
              disabled={avatarUploading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Cambiar foto de perfil"
            >
              <View style={styles.avatar}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={48} color={colors.primary} />
                )}
                {avatarUploading ? (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator color={colors.onPrimary} />
                  </View>
                ) : (
                  <View style={styles.avatarCameraBadge}>
                    <Ionicons name="camera" size={16} color={colors.onPrimary} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>
              Toca la foto para cambiarla
              {Platform.OS === 'android' ? '\nEn Android se usa la imagen completa y se ve en círculo.' : ''}
            </Text>
            {profile?.avatar_url ? (
              <TouchableOpacity onPress={confirmRemoveAvatar} disabled={avatarUploading}>
                <Text style={styles.removePhoto}>Quitar foto</Text>
              </TouchableOpacity>
            ) : null}
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

          <Text style={styles.label}>Ubicación del consultorio</Text>
          <Text style={styles.hintBlock}>
            Los clientes podrán buscarte por ciudad o por cercanía. Al escribir verás sugerencias (como en
            otras apps); al elegir una se guardan la dirección y las coordenadas. También puedes usar el
            GPS en tu oficina.
          </Text>
          <View style={styles.locationInputWrap}>
            <LocationAutocompleteInput
              variant="lawyer"
              value={locationLabel}
              onChangeText={(t) => {
                setLocationLabel(t);
                setLatitude(null);
                setLongitude(null);
              }}
              onPickSuggestion={(s) => {
                setLocationLabel(s.label);
                setLatitude(s.latitude);
                setLongitude(s.longitude);
              }}
              placeholder="Ej.: Chacao, Caracas, Miranda"
              accessibilityLabel="Ubicación del consultorio"
              wrapperStyle={styles.locationAutocompleteFlex}
            />
          </View>
          {latitude != null && longitude != null ? (
            <Text style={styles.coordsHint}>
              Coordenadas guardadas: {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </Text>
          ) : null}
          <View style={styles.locRow}>
            <TouchableOpacity
              style={[styles.locBtn, locationBusy && styles.locBtnDisabled]}
              onPress={() => void pickOfficeLocation()}
              disabled={locationBusy}
              activeOpacity={0.85}
            >
              {locationBusy ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="navigate" size={18} color={colors.onPrimary} />
                  <Text style={styles.locBtnText}>Usar mi ubicación actual</Text>
                </>
              )}
            </TouchableOpacity>
            {(latitude != null && longitude != null) || locationLabel.trim() ? (
              <TouchableOpacity style={styles.locClear} onPress={clearOfficeLocation} disabled={locationBusy}>
                <Text style={styles.locClearText}>Quitar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

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
                    color={on ? colors.onPrimary : colors.outline}
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
  topBannerSlot: { paddingHorizontal: 16, marginBottom: 8 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarTouchable: { alignSelf: 'center' },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.outlineVariant + '66',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary + '99',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  avatarHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.outline,
    marginTop: 10,
  },
  removePhoto: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.error,
    marginTop: 8,
  },
  email: {
    fontSize: 14,
    color: colors.outline,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  hintBlock: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 19,
    marginBottom: 10,
  },
  locationInputWrap: {
    borderWidth: 1,
    borderColor: colors.outlineVariant + '99',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    zIndex: 50,
    elevation: 4,
  },
  locationAutocompleteFlex: { flex: 1 },
  coordsHint: {
    fontSize: 11,
    color: colors.outline,
    marginTop: -8,
    marginBottom: 10,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  locBtnDisabled: { opacity: 0.65 },
  locBtnText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  locClear: { paddingVertical: 8, paddingHorizontal: 4 },
  locClearText: { color: colors.error, fontSize: 14, fontWeight: '700' },
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
    backgroundColor: colors.primary,
  },
  specChipText: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
  specChipTextOn: { color: colors.onPrimary, fontWeight: '700' },
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
