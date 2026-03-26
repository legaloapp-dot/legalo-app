import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchClientCases,
  caseStatusLabel,
  caseStatusIcon,
  CASE_STATUSES_ELIGIBLE_FOR_DIRECT_CONTACT,
  type LegalCaseRow,
  type LegalCaseStatus,
} from '../../lib/legalDashboard';
import { relativeTimeEs } from '../../lib/format';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import {
  getCasePostRejectionChoice,
  claimConnectionCreditForRejectedCase,
  requestRefundForRejectedCase,
  isCaseRejectedForCredit,
} from '../../lib/connectionCredits';
import { DEFAULT_FEE_USD } from '../../config/mobilePayment';
import ClientCaseDetailModal from './ClientCaseDetailModal';

function digitsForWhatsApp(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = `58${d.slice(1)}`;
  if (!d.startsWith('58')) d = `58${d}`;
  return d;
}

function canOpenWhatsApp(status: LegalCaseStatus): boolean {
  return CASE_STATUSES_ELIGIBLE_FOR_DIRECT_CONTACT.includes(status);
}

export default function ClientCasesTab({ clientId }: { clientId: string }) {
  const [cases, setCases] = useState<LegalCaseRow[]>([]);
  const [lawyersById, setLawyersById] = useState<
    Record<string, { full_name: string | null; phone: string | null }>
  >({});
  const [rejectionChoice, setRejectionChoice] = useState<Record<string, 'credit' | 'refund' | null>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionCaseId, setActionCaseId] = useState<string | null>(null);
  const [detailCase, setDetailCase] = useState<LegalCaseRow | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchClientCases(clientId);
      setCases(data);
      const ids = [...new Set(data.map((c) => c.lawyer_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', ids);
        const map: Record<string, { full_name: string | null; phone: string | null }> = {};
        (profs ?? []).forEach((p: { id: string; full_name: string | null; phone: string | null }) => {
          map[p.id] = { full_name: p.full_name, phone: p.phone };
        });
        setLawyersById(map);
      } else {
        setLawyersById({});
      }
      const rejected = data.filter((c) => isCaseRejectedForCredit(c.status));
      const choices: Record<string, 'credit' | 'refund' | null> = {};
      await Promise.all(
        rejected.map(async (c) => {
          choices[c.id] = await getCasePostRejectionChoice(c.id);
        })
      );
      setRejectionChoice(choices);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar casos');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openWa = (phone: string | null | undefined, caseTitle: string) => {
    const raw = phone?.trim();
    if (!raw) {
      Alert.alert('Sin teléfono', 'Este abogado no tiene número registrado.');
      return;
    }
    const wa = digitsForWhatsApp(raw);
    const text = `Hola Abogado, te contacto por el caso: ${caseTitle} en LÉGALO APP`;
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('No disponible', 'No se pudo abrir WhatsApp.')
    );
  };

  const onClaimCredit = async (caseId: string) => {
    setActionCaseId(caseId);
    try {
      await claimConnectionCreditForRejectedCase(clientId, caseId);
      setRejectionChoice((prev) => ({ ...prev, [caseId]: 'credit' }));
      Alert.alert(
        'Cupón activo',
        `Tienes un cupón de conexión por USD ${DEFAULT_FEE_USD} para la misma especialidad. Puedes elegir otro abogado en el directorio sin pagar de nuevo.`
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo registrar el cupón.');
    } finally {
      setActionCaseId(null);
    }
  };

  const onRequestRefund = async (caseId: string) => {
    setActionCaseId(caseId);
    try {
      await requestRefundForRejectedCase(clientId, caseId);
      setRejectionChoice((prev) => ({ ...prev, [caseId]: 'refund' }));
      Alert.alert(
        'Solicitud enviada',
        'LÉGALO procesará el reembolso por el monto del fee (pago móvil) cuando revise tu solicitud.'
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setActionCaseId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.chatSecondary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Mis casos</Text>
      <Text style={styles.sub}>
        Asuntos vinculados a tu cuenta. Los nuevos casos quedan pendientes hasta que el abogado los
        acepte.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {cases.length === 0 && !error ? (
        <Text style={styles.empty}>No tienes casos registrados todavía.</Text>
      ) : (
        cases.map((c) => {
          const pill = caseStatusLabel(c.status);
          const iconName = caseStatusIcon(c.status);
          const lawyer = lawyersById[c.lawyer_id];
          const lawyerName = lawyer?.full_name?.trim() || 'Abogado';
          const choice = rejectionChoice[c.id];
          const busy = actionCaseId === c.id;

          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardIcon}>
                <Ionicons name={iconName} size={22} color={colors.chatSecondary} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardLawyer}>{lawyerName}</Text>
                <Text style={styles.cardMeta}>
                  {c.last_activity?.trim()
                    ? c.last_activity
                    : `Última actividad: ${relativeTimeEs(c.last_activity_at)}`}
                </Text>
                <View style={[styles.pill, pill.tone === 'success' && styles.pillOk]}>
                  <Text style={[styles.pillText, pill.tone === 'success' && styles.pillTextOk]}>
                    {pill.text}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.detailBtn}
                  onPress={() => setDetailCase(c)}
                  activeOpacity={0.88}
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.chatSecondary} />
                  <Text style={styles.detailBtnText}>Ver detalle del caso</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.chatOutline} />
                </TouchableOpacity>

                {c.status === 'awaiting_payment' ? (
                  <Text style={styles.hint}>
                    Validando tu pago. Cuando el administrador lo confirme, el abogado verá tu caso y
                    podrá aceptarlo.
                  </Text>
                ) : null}

                {c.status === 'pending_approval' ? (
                  <Text style={styles.hint}>
                    Pago confirmado: pendiente de que el abogado acepte el caso. Cuando lo acepte,
                    podrás usar WhatsApp aquí.
                  </Text>
                ) : null}

                {isCaseRejectedForCredit(c.status) ? (
                  <View style={styles.rejectionBlock}>
                    {choice === null ? (
                      <>
                        <Text style={styles.rejectionTitle}>
                          {c.status === 'reassignment_pending'
                            ? 'Reasignación: el abogado no tomará este caso'
                            : 'El abogado no aceptó este caso'}
                        </Text>
                        <Text style={styles.rejectionSub}>
                          Tu pago del fee puede quedar como cupón para otro abogado de la misma
                          especialidad, o puedes solicitar reembolso.
                        </Text>
                        <View style={styles.rejectionRow}>
                          <TouchableOpacity
                            style={[styles.optBtn, styles.optBtnPrimary, busy && styles.optBtnDisabled]}
                            onPress={() => void onClaimCredit(c.id)}
                            disabled={busy}
                          >
                            {busy ? (
                              <ActivityIndicator color={colors.chatSurface} size="small" />
                            ) : (
                              <Text style={styles.optBtnTextPrimary}>Cupón de conexión</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.optBtn, styles.optBtnOutline, busy && styles.optBtnDisabled]}
                            onPress={() => void onRequestRefund(c.id)}
                            disabled={busy}
                          >
                            {busy ? (
                              <ActivityIndicator color={colors.chatSecondary} size="small" />
                            ) : (
                              <Text style={styles.optBtnTextOutline}>Solicitar reembolso</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : choice === 'credit' ? (
                      <Text style={styles.choiceDone}>
                        Cupón de conexión activo: elige otro abogado de la misma especialidad en el
                        directorio sin pagar de nuevo.
                      </Text>
                    ) : (
                      <Text style={styles.choiceDone}>
                        Solicitud de reembolso registrada. LÉGALO te devolverá el monto del fee por
                        pago móvil cuando corresponda.
                      </Text>
                    )}
                  </View>
                ) : null}

                {canOpenWhatsApp(c.status) && lawyer?.phone ? (
                  <TouchableOpacity
                    style={styles.waBtn}
                    onPress={() => openWa(lawyer.phone, c.title)}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color={colors.chatSurface} />
                    <Text style={styles.waBtnText}>WhatsApp al abogado</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })
      )}

      <ClientCaseDetailModal
        visible={detailCase != null}
        caseRow={detailCase}
        lawyerName={detailCase ? lawyersById[detailCase.lawyer_id]?.full_name?.trim() || 'Abogado' : ''}
        onClose={() => setDetailCase(null)}
        onFinalized={() => void load()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.chatPrimary, marginBottom: 8 },
  sub: { fontSize: 14, color: colors.chatOutline, lineHeight: 20, marginBottom: 20 },
  error: { color: colors.error, marginBottom: 12, fontSize: 13 },
  empty: { fontSize: 15, color: colors.chatOutline, fontStyle: 'italic' },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.chatPrimaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.chatOnSurface },
  cardLawyer: { fontSize: 13, color: colors.chatSecondary, marginTop: 4, fontWeight: '600' },
  cardMeta: { fontSize: 12, color: colors.chatOutline, marginTop: 6 },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: colors.chatContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillOk: { backgroundColor: '#d1fae5' },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.chatOnSurface,
    textTransform: 'uppercase',
  },
  pillTextOk: { color: '#047857' },
  hint: {
    fontSize: 12,
    color: colors.chatOutline,
    marginTop: 10,
    lineHeight: 18,
  },
  rejectionBlock: { marginTop: 12 },
  rejectionTitle: { fontSize: 14, fontWeight: '800', color: colors.chatOnSurface },
  rejectionSub: {
    fontSize: 12,
    color: colors.chatOutline,
    marginTop: 6,
    lineHeight: 18,
  },
  rejectionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  optBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  optBtnPrimary: { backgroundColor: colors.chatSecondary },
  optBtnOutline: {
    borderWidth: 1,
    borderColor: colors.chatSecondary,
    backgroundColor: 'transparent',
  },
  optBtnDisabled: { opacity: 0.6 },
  optBtnTextPrimary: { color: colors.chatSurface, fontSize: 12, fontWeight: '800' },
  optBtnTextOutline: { color: colors.chatSecondary, fontSize: 12, fontWeight: '800' },
  choiceDone: {
    fontSize: 12,
    color: colors.chatSecondary,
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '600',
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: 10,
  },
  waBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.chatSecondary + '55',
    backgroundColor: colors.chatPrimaryContainer + '88',
  },
  detailBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.chatSecondary,
  },
});
