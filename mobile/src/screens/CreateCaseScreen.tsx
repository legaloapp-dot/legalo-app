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
  pendingTransactionId,
}: {
  visible: boolean;
  lawyer: CreateCaseLawyer;
  clientId: string;
  clientDisplayName: string;
  onClose: () => void;
  onCaseCreated: (payload: {
    title: string;
    lawyer: CreateCaseLawyer;
    status: 'pending_approval' | 'awaiting_payment';
    deductConnectionCredit?: boolean;
  }) => void;
  /** Si el cliente contacta con cupón de conexión (sin fee nuevo), se consume al crear el caso. */
  deductConnectionCredit?: boolean;
  /** Tras subir comprobante: el caso queda en validación de pago hasta que el admin apruebe. */
  pendingTransactionId?: string | null;
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
      const isFlash = !!pendingTransactionId?.trim();
      const insertRow: Record<string, unknown> = {
        client_id: clientId,
        lawyer_id: lawyer.id,
        title: t,
        description: description.trim() || null,
        client_display_name: clientDisplayName.trim() || 'Cliente',
        last_activity_at: new Date().toISOString(),
      };
      if (isFlash) {
        insertRow.status = 'awaiting_payment';
        insertRow.transaction_id = pendingTransactionId!.trim();
        insertRow.last_activity =
          'Comprobante recibido: validando pago; el abogado verá el caso cuando se apruebe';
      } else {
        insertRow.status = 'pending_approval';
        insertRow.last_activity = 'Solicitud enviada: pendiente de aprobación del abogado';
      }

      const { error } = await supabase.from('cases').insert(insertRow);
      if (error) {
        const err = error as {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };
        console.error('[CreateCaseScreen] insert cases', {
          message: err.message,
          code: err.code,
          details: err.details,
          hint: err.hint,
        });
        const code = err.code ?? '';
        const msg = err.message || 'Error desconocido';
        const isMissingTransactionId =
          code === 'PGRST204' || /transaction_id/i.test(msg);
        const isCheck =
          code === '23514' ||
          /check constraint|violates check constraint/i.test(msg) ||
          /cases_status_check/i.test(msg);
        const extra = [err.details, err.hint].filter(Boolean).join('\n');
        throw new Error(
          (isMissingTransactionId
            ? `${msg} — En Supabase (SQL Editor) ejecuta supabase/ADD_CASES_TRANSACTION_ID.sql o el bloque de transaction_id en EJECUTAR_EN_SUPABASE.sql, luego vuelve a intentar.`
            : isCheck
              ? `${msg} — En Supabase ejecuta el SQL que amplía estados de cases (pending_approval): EJECUTAR_EN_SUPABASE.sql o migración 20260330140000.`
              : msg) + (extra ? `\n\n${extra}` : '')
        );
      }
      if (deductConnectionCredit && !isFlash) {
        const ok = await consumeConnectionCreditForLawyer(clientId, lawyer.id);
        if (!ok) {
          console.error('[CreateCaseScreen] consumeConnectionCreditForLawyer returned false', {
            clientId,
            lawyerId: lawyer.id,
          });
          throw new Error(
            'El caso se registró pero no se pudo aplicar el cupón. Contacta soporte o revisa Mis casos.'
          );
        }
      }
      reset();
      onCaseCreated({
        title: t,
        lawyer,
        status: isFlash ? 'awaiting_payment' : 'pending_approval',
        deductConnectionCredit: !!deductConnectionCredit,
      });
    } catch (e) {
      console.error('[CreateCaseScreen] submit catch', e);
      const text =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: string }).message)
            : 'No se pudo guardar el caso.';
      Alert.alert('Error', text);
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
            {pendingTransactionId ? (
              <>
                <Text style={styles.bold}>¡Pago recibido!</Text> Mientras validamos el comprobante,
                cuéntanos de qué trata tu caso para que <Text style={styles.bold}>{lawyerLabel}</Text>{' '}
                esté preparado. El abogado solo verá la solicitud cuando el administrador apruebe el
                pago.
              </>
            ) : (
              <>
                Vas a solicitar un caso con <Text style={styles.bold}>{lawyerLabel}</Text>. El
                abogado debe aprobarlo primero. Cuando lo acepte, podrás contactarle por WhatsApp
                desde Mis casos.
                {deductConnectionCredit ? (
                  <>
                    {' '}
                    <Text style={styles.bold}>Se usará tu cupón de conexión</Text> (sin pago
                    adicional).
                  </>
                ) : null}
              </>
            )}
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
                  <Text style={styles.primaryBtnText}>
                    {pendingTransactionId ? 'Enviar datos del caso' : 'Enviar solicitud'}
                  </Text>
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
