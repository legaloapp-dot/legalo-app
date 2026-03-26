import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { hasApprovedFeeForLawyer } from '../../lib/legalDashboard';
import { hasOpenConnectionCreditForLawyer } from '../../lib/connectionCredits';
import { hasPendingTransaction } from '../../lib/clientPayments';
import { LAWYER_SPECIALTY_OPTIONS } from '../lawyer-onboarding/LawyerOnboardingStep1Screen';

const SPECIALTY_FILTER_OPTIONS = [
  { value: '' as const, label: 'Todas las especialidades' },
  ...LAWYER_SPECIALTY_OPTIONS.map((o) => ({ value: o.id as string, label: o.label })),
];

export interface DirectoryLawyer {
  id: string;
  full_name: string | null;
  specialty: string | null;
  phone: string | null;
  is_verified: boolean;
  avatar_url?: string | null;
}

export default function LawyerDirectoryTab({
  clientId,
  onOpenPayment,
  onContactReady,
}: {
  clientId: string;
  onOpenPayment: (lawyer: DirectoryLawyer) => void;
  onContactReady: (lawyer: DirectoryLawyer, meta: { deductConnectionCredit: boolean }) => void;
}) {
  const [lawyers, setLawyers] = useState<DirectoryLawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  /** '' = todas las especialidades */
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [specialtyPickerOpen, setSpecialtyPickerOpen] = useState(false);
  const [selected, setSelected] = useState<DirectoryLawyer | null>(null);
  const [contactChecking, setContactChecking] = useState(false);
  const [feeApproved, setFeeApproved] = useState(false);
  const [hasConnectionCredit, setHasConnectionCredit] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, specialty, phone, is_verified, accepting_cases, avatar_url')
      .eq('role', 'lawyer')
      .eq('is_verified', true)
      .order('full_name', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as (DirectoryLawyer & { accepting_cases: boolean | null })[];
    const filtered = rows.filter(
      (r) => r.accepting_cases === null || r.accepting_cases === true
    );
    setLawyers(
      filtered.map(({ accepting_cases: _a, ...rest }) => rest) as DirectoryLawyer[]
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        await load();
      } catch {
        if (!cancelled) setLawyers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const specialtyFilterLabel = useMemo(() => {
    const o = SPECIALTY_FILTER_OPTIONS.find((x) => x.value === specialtyFilter);
    return o?.label ?? 'Todas las especialidades';
  }, [specialtyFilter]);

  const filtered = useMemo(() => {
    let list = lawyers;
    if (specialtyFilter) {
      list = list.filter((l) => (l.specialty ?? '').trim() === specialtyFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((l) => (l.full_name ?? '').toLowerCase().includes(q));
  }, [lawyers, query, specialtyFilter]);

  useEffect(() => {
    if (!selected || !clientId) {
      setFeeApproved(false);
      setHasConnectionCredit(false);
      setHasPending(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setContactChecking(true);
      try {
        const [approved, pending, credit] = await Promise.all([
          hasApprovedFeeForLawyer(clientId, selected.id),
          hasPendingTransaction(clientId, selected.id),
          hasOpenConnectionCreditForLawyer(clientId, selected.id),
        ]);
        if (!cancelled) {
          setFeeApproved(approved);
          setHasPending(pending);
          setHasConnectionCredit(credit);
        }
      } catch {
        if (!cancelled) {
          setFeeApproved(false);
          setHasConnectionCredit(false);
          setHasPending(false);
        }
      } finally {
        if (!cancelled) setContactChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, clientId]);

  return (
    <View style={styles.shell}>
      <View style={styles.filterBlock}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={colors.chatOutline} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre"
            placeholderTextColor={colors.chatOutline + '99'}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.specialtyTrigger}
          onPress={() => setSpecialtyPickerOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Filtrar por especialidad"
        >
          <Ionicons name="briefcase-outline" size={18} color={colors.chatSecondary} />
          <Text style={styles.specialtyTriggerText} numberOfLines={1}>
            {specialtyFilterLabel}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.chatOutline} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={specialtyPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSpecialtyPickerOpen(false)}
      >
        <View style={styles.pickerBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setSpecialtyPickerOpen(false)}
          />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Especialidad</Text>
            <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
              {SPECIALTY_FILTER_OPTIONS.map((opt) => {
                const on = specialtyFilter === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value || 'all'}
                    style={[styles.pickerRow, on && styles.pickerRowOn]}
                    onPress={() => {
                      setSpecialtyFilter(opt.value);
                      setSpecialtyPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.pickerRowText, on && styles.pickerRowTextOn]}>
                      {opt.label}
                    </Text>
                    {on ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.chatSecondary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerClose}
              onPress={() => setSpecialtyPickerOpen(false)}
            >
              <Text style={styles.pickerCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.chatSecondary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.intro}>
            Directorio de abogados registrados en LÉGALO. Pronto la IA te sugerirá el más adecuado
            según tu caso.
          </Text>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No hay resultados que coincidan.</Text>
          ) : (
            filtered.map((l) => (
              <TouchableOpacity
                key={l.id}
                style={styles.card}
                onPress={() => setSelected(l)}
                activeOpacity={0.88}
              >
                <View style={styles.cardAvatarWrap}>
                  {l.avatar_url ? (
                    <Image source={{ uri: l.avatar_url }} style={styles.cardAvatarImg} />
                  ) : (
                    <Ionicons name="person" size={24} color={colors.chatSecondary} />
                  )}
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardTitle}>{l.full_name?.trim() || 'Abogado'}</Text>
                    <Ionicons name="checkmark-circle" size={16} color={colors.chatSecondary} />
                  </View>
                  <Text style={styles.cardSpec}>{l.specialty || 'Especialidad no indicada'}</Text>
                  {l.phone ? <Text style={styles.cardPhone}>{l.phone}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.chatOutline} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={selected != null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selected ? (
              <>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.modalAvatarRow}>
                    <View style={styles.modalAvatarWrap}>
                      {selected.avatar_url ? (
                        <Image source={{ uri: selected.avatar_url }} style={styles.modalAvatarImg} />
                      ) : (
                        <Ionicons name="person" size={40} color={colors.chatSecondary} />
                      )}
                    </View>
                  </View>
                  <Text style={styles.modalTitle}>{selected.full_name?.trim() || 'Abogado'}</Text>
                  <Text style={styles.modalSpec}>{selected.specialty || '—'}</Text>
                  {selected.phone ? (
                    <Text style={styles.modalPhone}>{selected.phone}</Text>
                  ) : null}
                  {selected.is_verified ? (
                    <View style={styles.verifiedRow}>
                      <Ionicons name="shield-checkmark" size={16} color={colors.chatSecondary} />
                      <Text style={styles.verifiedText}>Perfil verificado en LÉGALO</Text>
                    </View>
                  ) : null}

                  <Text style={styles.modalHint}>
                    Para crear un caso y contactar al abogado necesitas el fee verificado por el
                    administrador, o un cupón de conexión activo (misma especialidad) si un abogado
                    rechazó un caso previo. Usa «Crear caso (pago)» para subir comprobante.
                  </Text>

                  {hasPending ? (
                    <View style={styles.pendingBanner}>
                      <Ionicons name="time-outline" size={18} color={colors.chatSecondary} />
                      <Text style={styles.pendingText}>
                        Tienes un comprobante pendiente de verificación para este abogado.
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.btnPrimary,
                      styles.btnMargin,
                      hasPending && styles.btnDisabled,
                    ]}
                    onPress={() => {
                      if (!selected || hasPending) return;
                      const l = selected;
                      setSelected(null);
                      onOpenPayment(l);
                    }}
                    disabled={!!hasPending}
                  >
                    <Ionicons name="card-outline" size={20} color={colors.chatSurface} />
                    <Text style={styles.btnPrimaryText}>Crear caso (pago y comprobante)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.btnSecondary,
                      (feeApproved || hasConnectionCredit) && styles.btnContactActive,
                      !feeApproved && !hasConnectionCredit && styles.btnDisabledOpacity,
                      (contactChecking || hasPending) && styles.btnDisabled,
                    ]}
                    disabled={(!feeApproved && !hasConnectionCredit) || contactChecking || hasPending}
                    onPress={() => {
                      if (!selected || (!feeApproved && !hasConnectionCredit) || hasPending) return;
                      const l = selected;
                      const deductConnectionCredit = !feeApproved && hasConnectionCredit;
                      setSelected(null);
                      onContactReady(l, { deductConnectionCredit });
                    }}
                  >
                    {contactChecking ? (
                      <ActivityIndicator size="small" color={colors.chatSecondary} />
                    ) : (
                      <>
                        <Ionicons
                          name="logo-whatsapp"
                          size={20}
                          color={
                            feeApproved || hasConnectionCredit
                              ? colors.chatSurface
                              : colors.chatOutline
                          }
                        />
                        <Text
                          style={[
                            styles.btnSecondaryText,
                            (feeApproved || hasConnectionCredit) && styles.btnSecondaryTextOn,
                          ]}
                        >
                          Contactar
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {!feeApproved && !hasConnectionCredit && !contactChecking ? (
                    <Text style={styles.lockedHint}>
                      Contactar se habilita con pago confirmado o con cupón de conexión para esta
                      especialidad.
                    </Text>
                  ) : null}
                  {hasConnectionCredit && !feeApproved ? (
                    <Text style={styles.creditHint}>
                      Tienes un cupón de conexión: al crear el caso no pagarás de nuevo el fee para
                      esta especialidad.
                    </Text>
                  ) : null}
                </ScrollView>

                <TouchableOpacity style={styles.closeLink} onPress={() => setSelected(null)}>
                  <Text style={styles.closeLinkText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: 0 },
  filterBlock: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.chatOnSurface, padding: 0 },
  specialtyTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  specialtyTriggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.chatOnSurface,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pickerCard: {
    backgroundColor: colors.chatSurface,
    borderRadius: 16,
    maxHeight: '72%',
    paddingTop: 16,
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.chatPrimary,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  pickerList: { maxHeight: 360 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  pickerRowOn: { backgroundColor: colors.chatPrimaryContainer },
  pickerRowText: { flex: 1, fontSize: 15, color: colors.chatOnSurface },
  pickerRowTextOn: { fontWeight: '700', color: colors.chatPrimary },
  pickerClose: { alignItems: 'center', paddingVertical: 12 },
  pickerCloseText: { fontSize: 16, fontWeight: '700', color: colors.chatSecondary },
  scroll: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  intro: {
    fontSize: 13,
    color: colors.chatOutline,
    lineHeight: 20,
    marginBottom: 16,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { fontSize: 15, color: colors.chatOutline, fontStyle: 'italic', textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  cardAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.chatPrimaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  modalAvatarRow: { alignItems: 'center', marginBottom: 12 },
  modalAvatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.chatPrimaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.chatOutlineVariant + '44',
  },
  modalAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  cardBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.chatOnSurface },
  cardSpec: { fontSize: 13, color: colors.chatOutline, marginTop: 4 },
  cardPhone: { fontSize: 12, color: colors.chatOutline, marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.chatSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: colors.chatPrimary },
  modalSpec: { fontSize: 15, color: colors.chatSecondary, marginTop: 6, fontWeight: '700' },
  modalPhone: { fontSize: 14, color: colors.chatOutline, marginTop: 8 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  verifiedText: { fontSize: 13, color: colors.chatSecondary, fontWeight: '600' },
  modalHint: { fontSize: 14, color: colors.chatOnSurface, lineHeight: 22, marginTop: 16 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.chatSecondaryContainer,
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  pendingText: { flex: 1, fontSize: 13, color: colors.chatOnSurface, lineHeight: 20 },
  btnMargin: { marginTop: 20 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.chatSecondary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnPrimaryText: { color: colors.chatSurface, fontSize: 15, fontWeight: '800' },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: colors.chatContainer,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '99',
  },
  btnContactActive: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },
  btnSecondaryText: { fontSize: 15, fontWeight: '800', color: colors.chatOutline },
  btnSecondaryTextOn: { color: '#ffffff' },
  btnDisabled: { opacity: 0.55 },
  btnDisabledOpacity: { opacity: 0.45 },
  lockedHint: {
    fontSize: 12,
    color: colors.chatOutline,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  creditHint: {
    fontSize: 12,
    color: colors.chatSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    fontWeight: '600',
  },
  closeLink: { alignItems: 'center', paddingVertical: 16 },
  closeLinkText: { fontSize: 16, fontWeight: '700', color: colors.chatSecondary },
});
