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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { hasApprovedFeeForLawyer } from '../../lib/legalDashboard';
import { hasPendingTransaction } from '../../lib/clientPayments';

export interface DirectoryLawyer {
  id: string;
  full_name: string | null;
  specialty: string | null;
  phone: string | null;
  is_verified: boolean;
}

export default function LawyerDirectoryTab({
  clientId,
  onOpenPayment,
  onContactReady,
}: {
  clientId: string;
  onOpenPayment: (lawyer: DirectoryLawyer) => void;
  onContactReady: (lawyer: DirectoryLawyer) => void;
}) {
  const [lawyers, setLawyers] = useState<DirectoryLawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<DirectoryLawyer | null>(null);
  const [contactChecking, setContactChecking] = useState(false);
  const [feeApproved, setFeeApproved] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, specialty, phone, is_verified, accepting_cases')
      .eq('role', 'lawyer')
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lawyers;
    return lawyers.filter((l) => {
      const name = (l.full_name ?? '').toLowerCase();
      const spec = (l.specialty ?? '').toLowerCase();
      return name.includes(q) || spec.includes(q);
    });
  }, [lawyers, query]);

  useEffect(() => {
    if (!selected || !clientId) {
      setFeeApproved(false);
      setHasPending(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setContactChecking(true);
      try {
        const [approved, pending] = await Promise.all([
          hasApprovedFeeForLawyer(clientId, selected.id),
          hasPendingTransaction(clientId, selected.id),
        ]);
        if (!cancelled) {
          setFeeApproved(approved);
          setHasPending(pending);
        }
      } catch {
        if (!cancelled) {
          setFeeApproved(false);
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
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color={colors.chatOutline} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o especialidad"
          placeholderTextColor={colors.chatOutline + '99'}
          value={query}
          onChangeText={setQuery}
        />
      </View>

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
                <View style={styles.cardIcon}>
                  <Ionicons name="person" size={24} color={colors.chatSecondary} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardTitle}>{l.full_name?.trim() || 'Abogado'}</Text>
                    {l.is_verified ? (
                      <Ionicons name="checkmark-circle" size={16} color={colors.chatSecondary} />
                    ) : null}
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
                    Para contactar por WhatsApp debes pagar el fee y que el administrador confirme el
                    comprobante. Puedes enviar el pago ahora con «Crear caso» (pago).
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
                      feeApproved && styles.btnContactActive,
                      !feeApproved && styles.btnDisabledOpacity,
                      contactChecking && styles.btnDisabled,
                    ]}
                    disabled={!feeApproved || contactChecking}
                    onPress={() => {
                      if (!selected || !feeApproved) return;
                      const l = selected;
                      setSelected(null);
                      onContactReady(l);
                    }}
                  >
                    {contactChecking ? (
                      <ActivityIndicator size="small" color={colors.chatSecondary} />
                    ) : (
                      <>
                        <Ionicons
                          name="logo-whatsapp"
                          size={20}
                          color={feeApproved ? colors.chatSurface : colors.chatOutline}
                        />
                        <Text
                          style={[
                            styles.btnSecondaryText,
                            feeApproved && styles.btnSecondaryTextOn,
                          ]}
                        >
                          Contactar
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {!feeApproved && !contactChecking ? (
                    <Text style={styles.lockedHint}>
                      Contactar se habilita cuando el pago esté confirmado por el administrador.
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.chatOnSurface, padding: 0 },
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
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.chatPrimaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
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
  closeLink: { alignItems: 'center', paddingVertical: 16 },
  closeLinkText: { fontSize: 16, fontWeight: '700', color: colors.chatSecondary },
});
