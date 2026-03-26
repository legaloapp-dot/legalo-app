import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { consumeConnectionCreditForLawyer } from '../lib/connectionCredits';
import { colors } from '../theme/colors';

export interface CreateCaseLawyer {
  id: string;
  full_name: string | null;
  phone: string | null;
}

export default function CreateCaseScreen({
  visible,
  lawyer,
  clientId,
  clientDisplayName,
  onClose,
  onCaseCreated,
  deductConnectionCredit,
}: {
  visible: boolean;
  lawyer: CreateCaseLawyer;
  clientId: string;
  clientDisplayName: string;
  onClose: () => void;
  onCaseCreated: (payload: {
    title: string;
    lawyer: CreateCaseLawyer;
    status: 'pending_approval';
    deductConnectionCredit?: boolean;
  }) => void;
  /** Si el cliente contacta con cupón de conexión (sin fee nuevo), se consume al crear el caso. */
  deductConnectionCredit?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setDescription('');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      Alert.alert('Título requerido', 'Indica un nombre para el caso.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('cases').insert({
        client_id: clientId,
        lawyer_id: lawyer.id,
        title: t,
        description: description.trim() || null,
        status: 'pending_approval',
        client_display_name: clientDisplayName.trim() || 'Cliente',
        last_activity: 'Solicitud enviada: pendiente de aprobación del abogado',
        last_activity_at: new Date().toISOString(),
      });
      if (error) throw error;
      if (deductConnectionCredit) {
        await consumeConnectionCreditForLawyer(clientId, lawyer.id);
      }
      reset();
      onCaseCreated({
        title: t,
        lawyer,
        status: 'pending_approval',
        deductConnectionCredit: !!deductConnectionCredit,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar el caso.');
    } finally {
      setSaving(false);
    }
  };

  const lawyerLabel = lawyer.full_name?.trim() || 'Abogado';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} hitSlop={12} disabled={saving}>
              <Ionicons name="close" size={24} color={colors.chatPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nuevo caso</Text>
            <View style={styles.headerSpacer} />
          </View>
          <Text style={styles.sub}>
            Vas a solicitar un caso con <Text style={styles.bold}>{lawyerLabel}</Text>. El abogado debe
            aprobarlo primero. Cuando lo acepte, podrás contactarle por WhatsApp desde Mis casos.
            {deductConnectionCredit ? (
              <>
                {' '}
                <Text style={styles.bold}>Se usará tu cupón de conexión</Text> (sin pago adicional).
              </>
            ) : null}
          </Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Título del caso</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Revisión de despido — sector retail"
              placeholderTextColor={colors.chatOutline + '99'}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              editable={!saving}
            />
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Resume los hechos y lo que necesitas del abogado."
              placeholderTextColor={colors.chatOutline + '99'}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              editable={!saving}
            />
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
              onPress={() => void submit()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.chatSurface} />
              ) : (
                <>
                  <Ionicons name="send" size={20} color={colors.chatSurface} />
                  <Text style={styles.primaryBtnText}>Enviar solicitud</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.chatContainer },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.chatOutlineVariant + '44',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.chatPrimary },
  headerSpacer: { width: 24 },
  sub: {
    fontSize: 14,
    color: colors.chatOutline,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bold: { fontWeight: '700', color: colors.chatOnSurface },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.chatOutline,
    marginBottom: 8,
    paddingTop: 8,
  },
  input: {
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '66',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.chatOnSurface,
  },
  inputMultiline: { minHeight: 120, paddingTop: 12 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.chatOutlineVariant + '44',
    backgroundColor: colors.chatSurface,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.chatSecondary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.chatSurface,
  },
});
