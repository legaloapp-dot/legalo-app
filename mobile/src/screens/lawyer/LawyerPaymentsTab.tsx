import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Profile } from '../../types/profile';
import { colors } from '../../theme/colors';
import LawyerSubscriptionCard from '../../components/LawyerSubscriptionCard';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchLawyerSubscriptionHistory,
  type SubscriptionHistoryRow,
} from '../../lib/lawyerPayments';
import { cancelLawyerSubscription } from '../../lib/subscription';
import { formatUsd } from '../../lib/format';
import { LAWYER_PREMIUM_FEE_USD } from '../../config/mobilePayment';

function formatPaidDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function paymentAmountLabel(row: SubscriptionHistoryRow): string {
  const cur = (row.currency || 'USD').toUpperCase();
  if (cur === 'USD') return formatUsd(row.amount);
  try {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: cur }).format(row.amount);
  } catch {
    return `${row.amount} ${cur}`;
  }
}

function statusLabel(ui: SubscriptionHistoryRow['uiStatus']): string {
  switch (ui) {
    case 'pending':
      return 'Pendiente';
    case 'approved':
      return 'Aprobado';
    case 'rejected':
      return 'Rechazado';
    case 'completed':
      return 'Pagado';
    case 'refunded':
      return 'Reembolsado';
    default:
      return '—';
  }
}

export default function LawyerPaymentsTab({
  profile,
  lawyerId,
  onOpenSubscriptionPayment,
}: {
  profile: Profile | null;
  lawyerId: string;
  onOpenSubscriptionPayment: () => void;
}) {
  const { refreshProfile } = useAuth();
  const [payments, setPayments] = useState<SubscriptionHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const loadPayments = useCallback(async () => {
    if (!lawyerId) {
      setPayments([]);
      return;
    }
    const rows = await fetchLawyerSubscriptionHistory(lawyerId);
    setPayments(rows);
  }, [lawyerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadPayments();
      } catch {
        if (!cancelled) setPayments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPayments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPayments();
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  }, [loadPayments, refreshProfile]);

  const confirmCancel = useCallback(() => {
    const plan = profile?.plan;
    if (plan !== 'trial' && plan !== 'premium') return;

    Alert.alert(
      'Cancelar suscripción',
      'Pasarás al plan básico (sin prioridad en el directorio). Podrás volver a contratar Premium desde aquí cuando quieras.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelBusy(true);
            try {
              await cancelLawyerSubscription();
              await refreshProfile();
              await loadPayments();
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'No se pudo cancelar';
              Alert.alert('Error', msg);
            } finally {
              setCancelBusy(false);
            }
          },
        },
      ]
    );
  }, [profile?.plan, refreshProfile, loadPayments]);

  const canCancelSubscription = profile?.plan === 'trial' || profile?.plan === 'premium';

  const goToPayment = useCallback(() => {
    setChangePlanOpen(false);
    onOpenSubscriptionPayment();
  }, [onOpenSubscriptionPayment]);

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Pagos y suscripción</Text>
        <Text style={styles.sub}>
          Estado de tu suscripción a LÉGALO y movimientos (pendientes, aprobados o rechazados) como en cualquier
          servicio por suscripción.
        </Text>

        <LawyerSubscriptionCard profile={profile} />

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setChangePlanOpen(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary} />
            <Text style={styles.actionBtnText}>Cambiar plan / Premium</Text>
          </TouchableOpacity>
          {canCancelSubscription ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={confirmCancel}
              disabled={cancelBusy}
              activeOpacity={0.85}
            >
              {cancelBusy ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
              )}
              <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Cancelar suscripción</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Historial de pagos</Text>
          <Text style={styles.sectionHint}>Pagos a la plataforma LÉGALO</Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Cargando historial…</Text>
          </View>
        ) : payments.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={36} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyTitle}>Aún no hay movimientos</Text>
            <Text style={styles.emptySub}>
              Al enviar el comprobante de Premium, verás aquí el pago como pendiente hasta que el administrador lo
              apruebe.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {payments.map((row) => (
              <View key={row.key} style={styles.paymentRow}>
                <View style={styles.paymentLeft}>
                  <Text style={styles.paymentAmount}>{paymentAmountLabel(row)}</Text>
                  <Text style={styles.paymentDate}>{formatPaidDate(row.dateIso)}</Text>
                  {row.description ? <Text style={styles.paymentDesc}>{row.description}</Text> : null}
                </View>
                <View
                  style={[
                    styles.statusPill,
                    row.uiStatus === 'refunded' && styles.statusPillRefunded,
                    row.uiStatus === 'pending' && styles.statusPillPending,
                    row.uiStatus === 'rejected' && styles.statusPillRefunded,
                  ]}
                >
                  <Text style={styles.statusText}>{statusLabel(row.uiStatus)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
          <Text style={styles.infoText}>
            El plan Premium mantiene tu perfil con prioridad en el directorio. El administrador aprueba los
            comprobantes en el panel; hasta entonces el pago figura como pendiente.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={changePlanOpen} transparent animationType="fade" onRequestClose={() => setChangePlanOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Plan Premium</Text>
            <Text style={styles.modalPrice}>USD {LAWYER_PREMIUM_FEE_USD.toFixed(2)}</Text>
            <Text style={styles.modalBody}>
              Suscripción con prioridad en el directorio. Serás redirigido a la pantalla de pago (mismo flujo que el
              cliente: datos de pago móvil y subida de comprobante). El pago queda pendiente hasta que el equipo lo
              apruebe en el panel.
            </Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={goToPayment} activeOpacity={0.85}>
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={styles.modalPrimaryText}>Ir a pagar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondary} onPress={() => setChangePlanOpen(false)}>
              <Text style={styles.modalSecondaryText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  sub: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionsRow: { gap: 10, marginBottom: 20 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '99',
    backgroundColor: colors.surface,
  },
  actionBtnDanger: {
    borderColor: colors.error + '55',
    backgroundColor: colors.error + '0D',
  },
  actionBtnText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  actionBtnTextDanger: { color: colors.error },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  sectionHint: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  loadingBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 13, color: colors.onSurfaceVariant },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '66',
    backgroundColor: colors.surfaceContainer + '88',
    marginBottom: 8,
  },
  emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: '700', color: colors.onSurface },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
  list: { gap: 10, marginBottom: 8 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '66',
    backgroundColor: colors.surface,
  },
  paymentLeft: { flex: 1, minWidth: 0 },
  paymentAmount: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  paymentDate: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
  paymentDesc: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 6, lineHeight: 16 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.tertiaryContainer + 'AA',
  },
  statusPillPending: { backgroundColor: colors.secondaryContainer + 'CC' },
  statusPillRefunded: { backgroundColor: colors.errorContainer + 'AA' },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.tertiaryContainer + '55',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '66',
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.onSurface, marginBottom: 4 },
  modalPrice: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 12,
  },
  modalBody: { fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 21, marginBottom: 18 },
  modalPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalSecondary: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  modalSecondaryText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
