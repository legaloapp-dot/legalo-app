import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
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
import { colors } from '../../theme/colors';
import { DEFAULT_FEE_USD, PAYMENT_INSTRUCTIONS } from '../../config/mobilePayment';
import { uploadReceiptAndCreateTransaction, hasPendingTransaction } from '../../lib/clientPayments';

export interface PaymentLawyer {
  id: string;
  full_name: string | null;
  specialty: string | null;
  avatar_url?: string | null;
}

export default function LawyerPaymentScreen({
  lawyer,
  clientId,
  onBack,
}: {
  lawyer: PaymentLawyer;
  clientId: string;
  onBack: () => void;
}) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [mime, setMime] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<boolean | null>(null);

  const fee = DEFAULT_FEE_USD;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await hasPendingTransaction(clientId, lawyer.id);
        if (!cancelled) setPending(p);
      } catch {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, lawyer.id]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos', 'Necesitamos acceso a la galería para subir el comprobante.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setLocalUri(asset.uri);
    setMime(asset.mimeType ?? 'image/jpeg');
  };

  const submit = async () => {
    if (pending) {
      Alert.alert(
        'Pago en revisión',
        'Ya enviaste un comprobante para este abogado. Espera la confirmación del administrador en la pestaña Pagos.'
      );
      return;
    }
    if (!localUri) {
      Alert.alert('Comprobante', 'Selecciona una imagen del comprobante de pago.');
      return;
    }
    setSaving(true);
    try {
      await uploadReceiptAndCreateTransaction(clientId, lawyer.id, fee, localUri, mime);
      setPending(true);
      setLocalUri(null);
      Alert.alert(
        'Enviado',
        'Tu comprobante fue recibido. Cuando el administrador lo confirme, el botón de contacto con el abogado se habilitará.',
        [{ text: 'OK', onPress: onBack }]
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo registrar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const lawyerLabel = lawyer.full_name?.trim() || 'Abogado';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.chatPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pago y comprobante</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.lawyerCard}>
            <View style={styles.lawyerAvatarWrap}>
              {lawyer.avatar_url ? (
                <Image source={{ uri: lawyer.avatar_url }} style={styles.lawyerAvatarImg} />
              ) : (
                <Ionicons name="hammer-outline" size={28} color={colors.chatSecondary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lawyerName}>{lawyerLabel}</Text>
              {lawyer.specialty ? (
                <Text style={styles.lawyerSpec}>{lawyer.specialty}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Monto a pagar (fee)</Text>
            <Text style={styles.amountValue}>USD {fee.toFixed(2)}</Text>
          </View>

          <Text style={styles.sectionTitle}>{PAYMENT_INSTRUCTIONS.title}</Text>
          {PAYMENT_INSTRUCTIONS.lines.map((line) => (
            <Text key={line} style={styles.body}>
              • {line}
            </Text>
          ))}

          <View style={styles.pmBox}>
            <Text style={styles.pmRow}>
              <Text style={styles.pmKey}>Banco: </Text>
              {PAYMENT_INSTRUCTIONS.bank}
            </Text>
            <Text style={styles.pmRow}>
              <Text style={styles.pmKey}>Pago móvil: </Text>
              {PAYMENT_INSTRUCTIONS.phonePm}
            </Text>
            <Text style={styles.pmRow}>
              <Text style={styles.pmKey}>RIF: </Text>
              {PAYMENT_INSTRUCTIONS.rif}
            </Text>
            <Text style={styles.pmRow}>
              <Text style={styles.pmKey}>Beneficiario: </Text>
              {PAYMENT_INSTRUCTIONS.beneficiary}
            </Text>
          </View>

          {pending === true ? (
            <View style={styles.warnBox}>
              <Ionicons name="time-outline" size={22} color={colors.chatSecondary} />
              <Text style={styles.warnText}>
                Tienes un comprobante en revisión para este abogado. Revisa la pestaña Pagos.
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Subir comprobante</Text>
          <Text style={styles.body}>
            Captura o selecciona la imagen del comprobante del pago móvil. El administrador lo
            verificará en el panel.
          </Text>

          <TouchableOpacity style={styles.pickBtn} onPress={() => void pickImage()} disabled={!!pending}>
            {localUri ? (
              <Image source={{ uri: localUri }} style={styles.preview} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={36} color={colors.chatSecondary} />
                <Text style={styles.pickBtnText}>Toca para elegir imagen</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, (saving || pending) && styles.submitBtnDisabled]}
            onPress={() => void submit()}
            disabled={saving || !!pending}
          >
            {saving ? (
              <ActivityIndicator color={colors.chatSurface} />
            ) : (
              <Text style={styles.submitText}>Enviar comprobante</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.chatContainer },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.chatOutlineVariant + '44',
    backgroundColor: colors.chatSurface,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.chatPrimary },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  lawyerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.chatSurface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  lawyerAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.chatPrimaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lawyerAvatarImg: { width: '100%', height: '100%', borderRadius: 12 },
  lawyerName: { fontSize: 17, fontWeight: '800', color: colors.chatOnSurface },
  lawyerSpec: { fontSize: 13, color: colors.chatOutline, marginTop: 4 },
  amountBox: {
    backgroundColor: colors.chatPrimaryContainer,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  amountLabel: { fontSize: 12, fontWeight: '700', color: colors.chatOutline, marginBottom: 4 },
  amountValue: { fontSize: 28, fontWeight: '900', color: colors.chatPrimary },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.chatPrimary,
    marginBottom: 10,
    marginTop: 8,
  },
  body: { fontSize: 14, color: colors.chatOnSurface, lineHeight: 22, marginBottom: 8 },
  pmBox: {
    backgroundColor: colors.chatSurface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  pmRow: { fontSize: 14, color: colors.chatOnSurface, marginBottom: 6 },
  pmKey: { fontWeight: '700', color: colors.chatOutline },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.chatSecondaryContainer + '44',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  warnText: { flex: 1, fontSize: 13, color: colors.chatOnSurface, lineHeight: 20 },
  pickBtn: {
    minHeight: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.chatOutlineVariant + '99',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    backgroundColor: colors.chatSurface,
  },
  preview: { width: '100%', height: 200, resizeMode: 'cover' },
  pickBtnText: { marginTop: 8, fontSize: 14, fontWeight: '700', color: colors.chatSecondary },
  submitBtn: {
    backgroundColor: colors.chatSecondary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: colors.chatSurface, fontSize: 16, fontWeight: '800' },
});
