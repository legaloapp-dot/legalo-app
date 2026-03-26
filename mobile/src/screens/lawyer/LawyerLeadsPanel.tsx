import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { type LeadRow, updateLeadStatus } from '../../lib/legalDashboard';
import { digitsOnlyE164 } from '../../lib/format';
import { colors } from '../../theme/colors';

const WHATSAPP = '#25D366';

export default function LawyerLeadsPanel({
  leads,
  lawyerId,
  refreshing,
  onRefresh,
  onLeadUpdated,
  embedded,
}: {
  leads: LeadRow[];
  lawyerId: string | undefined;
  refreshing: boolean;
  onRefresh: () => void;
  onLeadUpdated: () => void;
  /** Dentro de la pestaña Casos: sin título propio ni ScrollView (el padre hace scroll). */
  embedded?: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const openWa = (phone: string) => {
    const d = digitsOnlyE164(phone);
    if (!d) return;
    Linking.openURL(`https://wa.me/${d}`).catch(() => {});
  };

  const setStatus = async (leadId: string, status: 'contacted' | 'dismissed') => {
    if (!lawyerId) return;
    setBusyId(leadId);
    try {
      await updateLeadStatus(leadId, lawyerId, status);
      onLeadUpdated();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo actualizar el lead.');
    } finally {
      setBusyId(null);
    }
  };

  const body =
    leads.length === 0 ? (
      <Text style={[styles.empty, embedded && styles.emptyEmbedded]}>
        No hay leads de primer contacto por ahora.
      </Text>
    ) : (
      leads.map((lead, idx) => (
          <View
            key={lead.id}
            style={[styles.card, idx === 1 && styles.cardAccent]}
          >
            <View style={styles.head}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color={colors.primary} />
              </View>
              <View style={styles.headText}>
                <Text style={styles.name}>{lead.client_name}</Text>
                <Text style={styles.tag}>{lead.category || 'Consulta'}</Text>
              </View>
              {lead.status === 'new' ? (
                <View style={styles.newPill}>
                  <Text style={styles.newPillText}>Nuevo</Text>
                </View>
              ) : lead.status === 'contacted' ? (
                <View style={styles.okPill}>
                  <Text style={styles.okPillText}>Contactado</Text>
                </View>
              ) : (
                <View style={styles.dimPill}>
                  <Text style={styles.dimPillText}>Descartado</Text>
                </View>
              )}
            </View>
            {lead.message ? (
              <Text style={styles.quote}>"{lead.message}"</Text>
            ) : null}
            <TouchableOpacity
              style={styles.waBtn}
              onPress={() => openWa(lead.phone_e164)}
              activeOpacity={0.9}
            >
              <Ionicons name="logo-whatsapp" size={20} color={colors.onPrimary} />
              <Text style={styles.waBtnText}>Contactar por WhatsApp</Text>
            </TouchableOpacity>

            <View style={styles.actionsRow}>
              {lead.status === 'new' || lead.status === 'contacted' ? (
                <TouchableOpacity
                  style={[styles.secondaryBtn, busyId === lead.id && styles.btnDisabled]}
                  onPress={() => void setStatus(lead.id, 'contacted')}
                  disabled={busyId === lead.id || lead.status === 'contacted'}
                >
                  {busyId === lead.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>
                      {lead.status === 'contacted' ? 'Contactado' : 'Marcar contactado'}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
              {lead.status !== 'dismissed' ? (
                <TouchableOpacity
                  style={[styles.dangerBtn, busyId === lead.id && styles.btnDisabled]}
                  onPress={() => {
                    Alert.alert(
                      'Descartar',
                      '¿Marcar esta solicitud como descartada? Podrás seguir viéndola en el historial.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Descartar',
                          style: 'destructive',
                          onPress: () => void setStatus(lead.id, 'dismissed'),
                        },
                      ]
                    );
                  }}
                  disabled={busyId === lead.id}
                >
                  <Text style={styles.dangerBtnText}>Descartar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
      ))
    );

  if (embedded) {
    return <View style={styles.embeddedWrap}>{body}</View>;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Solicitudes de clientes</Text>
      <Text style={styles.sub}>
        Marca el estado cuando contactes o descartes una solicitud. WhatsApp abre el chat con el
        número indicado.
      </Text>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  embeddedWrap: { paddingBottom: 8 },
  scroll: { flex: 1, minHeight: 400 },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  sub: { fontSize: 14, color: colors.onSurfaceVariant, marginBottom: 20, lineHeight: 20 },
  empty: { fontSize: 15, color: colors.outline, fontStyle: 'italic', textAlign: 'center', marginTop: 24 },
  emptyEmbedded: { marginTop: 0, textAlign: 'left' },
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
  },
  cardAccent: { borderLeftWidth: 4, borderLeftColor: colors.secondary },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.primary },
  tag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 4,
  },
  newPill: {
    backgroundColor: colors.error + '22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newPillText: { fontSize: 10, fontWeight: '800', color: colors.error },
  okPill: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  okPillText: { fontSize: 10, fontWeight: '800', color: colors.primary },
  dimPill: {
    backgroundColor: colors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dimPillText: { fontSize: 10, fontWeight: '800', color: colors.outline },
  quote: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 14,
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: WHATSAPP,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  waBtnText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryBtn: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  dangerBtn: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: { fontSize: 13, fontWeight: '700', color: colors.error },
  btnDisabled: { opacity: 0.55 },
});
