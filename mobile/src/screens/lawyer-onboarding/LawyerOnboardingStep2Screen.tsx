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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

interface LawyerOnboardingStep2ScreenProps {
  userId: string;
  initialInpreNumber?: string | null;
  onComplete: () => void;
  onBack: () => void | Promise<void>;
}

async function uploadLawyerDoc(
  userId: string,
  uri: string,
  mimeType: string | undefined,
  prefix: 'inpre' | 'cedula'
): Promise<string> {
  const ext =
    mimeType?.includes('png') ? 'png' : mimeType?.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
  const res = await fetch(uri);
  const blob = await res.blob();
  const { error } = await supabase.storage.from('lawyer-cards').upload(path, blob, {
    contentType: mimeType || 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) throw error;
  return path;
}

export default function LawyerOnboardingStep2Screen({
  userId,
  initialInpreNumber,
  onComplete,
  onBack,
}: LawyerOnboardingStep2ScreenProps) {
  const [inpreNumber, setInpreNumber] = useState(initialInpreNumber ?? '');
  const [inpreLocalUri, setInpreLocalUri] = useState<string | null>(null);
  const [inpreMime, setInpreMime] = useState<string | undefined>();
  const [cedulaLocalUri, setCedulaLocalUri] = useState<string | null>(null);
  const [cedulaMime, setCedulaMime] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const pickImage = async (which: 'inpre' | 'cedula') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos', 'Necesitamos acceso a la galería para subir el documento.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (which === 'inpre') {
      setInpreLocalUri(asset.uri);
      setInpreMime(asset.mimeType ?? 'image/jpeg');
    } else {
      setCedulaLocalUri(asset.uri);
      setCedulaMime(asset.mimeType ?? 'image/jpeg');
    }
  };

  const handleSubmit = async () => {
    const n = inpreNumber.trim();
    if (!n) {
      Alert.alert('Inpreabogado', 'Indica tu número de Inpreabogado.');
      return;
    }
    if (!inpreLocalUri) {
      Alert.alert('Documentos', 'Sube la foto del carnet de Inpreabogado.');
      return;
    }
    if (!cedulaLocalUri) {
      Alert.alert('Documentos', 'Sube la foto de tu cédula de identidad.');
      return;
    }

    setSaving(true);
    try {
      const inprePath = await uploadLawyerDoc(userId, inpreLocalUri, inpreMime, 'inpre');
      const cedulaPath = await uploadLawyerDoc(userId, cedulaLocalUri, cedulaMime, 'cedula');

      const { error } = await supabase
        .from('profiles')
        .update({
          inpre_number: n,
          lawyer_inpre_card_path: inprePath,
          lawyer_cedula_path: cedulaPath,
          lawyer_onboarding_step: 3,
        })
        .eq('id', userId);

      if (error) throw error;
      onComplete();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar la verificación.');
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
        <View style={styles.topBar}>
          <View style={styles.topBarSide}>
            <TouchableOpacity onPress={() => void onBack()} style={styles.iconBtn} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#002366" />
            </TouchableOpacity>
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
                  'Necesitas tu número de Inpreabogado y fotos legibles del carnet y de tu cédula. Un equipo revisará en 24–48 h hábiles.'
                )
              }
            >
              <Ionicons name="help-circle-outline" size={26} color="#002366" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepRow}>
            <View style={styles.stepLine} />
            <Text style={styles.stepLabel}>Paso 02 • Verificación</Text>
          </View>

          <Text style={styles.title}>
            Validación de{'\n'}identidad legal.
          </Text>
          <Text style={styles.subtitle}>
            Para garantizar la integridad de nuestra red, requerimos la validación oficial de sus
            credenciales ante el Colegio de Abogados de Venezuela.
          </Text>

          <View style={styles.vettingCard}>
            <View style={styles.vettingIcon}>
              <Ionicons name="shield-checkmark" size={28} color={colors.onPrimary} />
            </View>
            <View style={styles.vettingText}>
              <Text style={styles.vettingTitle}>Vetting Protocol</Text>
              <Text style={styles.vettingDesc}>Validación de identidad legal en Venezuela.</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Número de Inpreabogado</Text>
          <View style={styles.inpreWrap}>
            <TextInput
              style={styles.inpreInput}
              placeholder="Ej: 123.456"
              placeholderTextColor={colors.outlineVariant + 'CC'}
              value={inpreNumber}
              onChangeText={setInpreNumber}
              autoCapitalize="none"
              keyboardType="default"
            />
            <View style={styles.inpreIcon}>
              <Ionicons name="hammer-outline" size={22} color={colors.outline} />
            </View>
          </View>

          <Text style={[styles.fieldLabel, styles.labelSp]}>Foto del carnet de Inpreabogado</Text>
          <TouchableOpacity
            style={styles.uploadBox}
            onPress={() => void pickImage('inpre')}
            activeOpacity={0.85}
          >
            {inpreLocalUri ? (
              <Image source={{ uri: inpreLocalUri }} style={styles.uploadPreview} />
            ) : (
              <>
                <View style={styles.uploadCircle}>
                  <Ionicons name="camera-outline" size={28} color={colors.primary} />
                </View>
                <Text style={styles.uploadTitle}>Cargar anverso</Text>
                <Text style={styles.uploadHint}>Formatos: JPG, PNG o PDF</Text>
              </>
            )}
            {inpreLocalUri && (
              <View style={styles.uploadBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.secondary} />
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.fieldLabel, styles.labelSp]}>Foto de la Cédula de Identidad</Text>
          <TouchableOpacity
            style={styles.uploadBox}
            onPress={() => void pickImage('cedula')}
            activeOpacity={0.85}
          >
            {cedulaLocalUri ? (
              <Image source={{ uri: cedulaLocalUri }} style={styles.uploadPreview} />
            ) : (
              <>
                <View style={styles.uploadCircle}>
                  <Ionicons name="add" size={32} color={colors.primary} />
                </View>
                <Text style={styles.uploadTitle}>Cargar documento</Text>
                <Text style={styles.uploadHint}>Imagen clara y legible</Text>
              </>
            )}
            {cedulaLocalUri && (
              <View style={styles.uploadBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.secondary} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.securityBox}>
            <Ionicons name="shield-outline" size={22} color={colors.secondary} />
            <Text style={styles.securityText}>
              Sus documentos se cifran bajo el estándar AES-256. LÉGALO nunca comparte sus datos
              personales con terceros sin su consentimiento explícito conforme a la Ley de
              Protección de Datos.
            </Text>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, saving && styles.ctaDisabled]}
            onPress={() => void handleSubmit()}
            disabled={saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Text style={styles.ctaText}>Finalizar Registro</Text>
                <Ionicons name="arrow-forward" size={22} color={colors.onPrimary} />
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            Validación sujeta a revisión en 24-48 horas hábiles
          </Text>
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
  topBarSide: { width: 100, flexDirection: 'row', alignItems: 'center' },
  topBarSideEnd: { justifyContent: 'flex-end' },
  iconBtn: { padding: 4 },
  brand: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#002366',
    letterSpacing: -0.3,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  stepLine: {
    width: 32,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.secondary,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -1,
    lineHeight: 42,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
    marginBottom: 28,
    maxWidth: 420,
  },
  vettingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
    marginBottom: 28,
    overflow: 'hidden',
  },
  vettingIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  vettingText: { flex: 1 },
  vettingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  vettingDesc: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.primary,
    marginBottom: 8,
    marginLeft: 2,
  },
  labelSp: { marginTop: 8 },
  inpreWrap: { position: 'relative', marginBottom: 8 },
  inpreInput: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 18,
    paddingRight: 52,
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  inpreIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -11,
  },
  uploadBox: {
    minHeight: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  uploadCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 10,
    color: colors.outline,
  },
  uploadPreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  uploadBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.surface + 'E6',
    borderRadius: 12,
  },
  securityBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerLow + '80',
    marginTop: 16,
    alignItems: 'flex-start',
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.surface + 'F2',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '22',
  },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaDisabled: { opacity: 0.85 },
  ctaText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  disclaimer: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.outline,
  },
});
