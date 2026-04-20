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
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';
import { hasApprovedFeeForLawyer, hasActiveCaseWithLawyer } from '../../lib/legalDashboard';
import {
  getOpenConnectionCreditsInfo,
  hasOpenConnectionCreditForLawyer,
} from '../../lib/connectionCredits';
import { hasPendingTransaction } from '../../lib/clientPayments';
import { haversineKm, formatDistanceKm } from '../../lib/geo';
import LocationAutocompleteInput from '../../components/LocationAutocompleteInput';
import { directoryPlanSortKey } from '../../lib/subscription';
import { LAWYER_SPECIALTY_OPTIONS } from '../../config/specialties';
import type { DirectoryLawyer } from '../../types/lawyers';

export type { DirectoryLawyer };

const SPECIALTY_FILTER_OPTIONS = [
  { value: '' as const, label: 'Todas las especialidades' },
  ...LAWYER_SPECIALTY_OPTIONS.map((o) => ({ value: o.id as string, label: o.label })),
];

export default function LawyerDirectoryTab({
  clientId,
  onOpenPayment,
  onContactReady,
  onOpenWhatsApp,
}: {
  clientId: string;
  onOpenPayment: (lawyer: DirectoryLawyer) => void;
  onContactReady: (lawyer: DirectoryLawyer, meta: { deductConnectionCredit: boolean }) => void;
  /** WhatsApp solo con al menos un caso en curso con ese abogado (no pendiente de aprobación ni cerrado). */
  onOpenWhatsApp?: (lawyer: DirectoryLawyer) => void;
}) {
  const [lawyers, setLawyers] = useState<DirectoryLawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [nearMeActive, setNearMeActive] = useState(false);
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [clientLocBusy, setClientLocBusy] = useState(false);
  /** '' = todas las especialidades */
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [specialtyPickerOpen, setSpecialtyPickerOpen] = useState(false);
  const [selected, setSelected] = useState<DirectoryLawyer | null>(null);
  const [contactChecking, setContactChecking] = useState(false);
  const [feeApproved, setFeeApproved] = useState(false);
  const [hasConnectionCredit, setHasConnectionCredit] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const [hasActiveCase, setHasActiveCase] = useState(false);
  const [couponInfo, setCouponInfo] = useState<{ hasAny: boolean; specialties: string[] }>({
    hasAny: false,
    specialties: [],
  });

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, specialty, phone, is_verified, accepting_cases, avatar_url, latitude, longitude, location_label, plan'
      )
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

  const refreshCouponInfo = useCallback(async () => {
    if (!clientId) {
      setCouponInfo({ hasAny: false, specialties: [] });
      return;
    }
    try {
      const info = await getOpenConnectionCreditsInfo(clientId);
      setCouponInfo(info);
    } catch {
      setCouponInfo({ hasAny: false, specialties: [] });
    }
  }, [clientId]);

  useEffect(() => {
    void refreshCouponInfo();
  }, [refreshCouponInfo]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
      await refreshCouponInfo();
    } finally {
      setRefreshing(false);
    }
  };

  const specialtyFilterLabel = useMemo(() => {
    const o = SPECIALTY_FILTER_OPTIONS.find((x) => x.value === specialtyFilter);
    return o?.label ?? 'Todas las especialidades';
  }, [specialtyFilter]);

  const couponSpecialtyLabels = useMemo(
    () =>
      couponInfo.specialties.map(
        (s) => LAWYER_SPECIALTY_OPTIONS.find((o) => o.id === s)?.label ?? s
      ),
    [couponInfo.specialties]
  );

  const baseFiltered = useMemo(() => {
    let list = lawyers;
    if (specialtyFilter) {
      list = list.filter((l) => (l.specialty ?? '').trim() === specialtyFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => (l.full_name ?? '').toLowerCase().includes(q));
    }
    const locQ = locationQuery.trim().toLowerCase();
    if (locQ) {
      list = list.filter((l) => (l.location_label ?? '').toLowerCase().includes(locQ));
    }
    return list;
  }, [lawyers, query, specialtyFilter, locationQuery]);

  /** Suscripción paga primero; luego prueba; plan basic al final. */
  const planSorted = useMemo(() => {
    return [...baseFiltered].sort((a, b) => {
      const d = directoryPlanSortKey(a.plan) - directoryPlanSortKey(b.plan);
      if (d !== 0) return d;
      return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'es');
    });
  }, [baseFiltered]);

  const directoryRows = useMemo(() => {
    if (!nearMeActive || !clientCoords) {
      return planSorted.map((l) => ({ lawyer: l, distanceKm: null as number | null }));
    }
    const { lat: clat, lng: clng } = clientCoords;
    return planSorted
      .map((l) => {
        const lat = l.latitude != null ? Number(l.latitude) : null;
        const lng = l.longitude != null ? Number(l.longitude) : null;
        const distanceKm =
          lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
            ? haversineKm(clat, clng, lat, lng)
            : null;
        return { lawyer: l, distanceKm };
      })
      .sort((a, b) => {
        const tp = directoryPlanSortKey(a.lawyer.plan) - directoryPlanSortKey(b.lawyer.plan);
        if (tp !== 0) return tp;
        if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm != null) return -1;
        if (b.distanceKm != null) return 1;
        return (a.lawyer.full_name ?? '').localeCompare(b.lawyer.full_name ?? '', 'es');
      });
  }, [planSorted, nearMeActive, clientCoords]);

  const enableNearMe = useCallback(async () => {
    setClientLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos', 'Activa la ubicación para ordenar abogados por cercanía.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setClientCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setNearMeActive(true);
    } catch (e) {
      Alert.alert('Ubicación', e instanceof Error ? e.message : 'No se pudo obtener tu posición.');
    } finally {
      setClientLocBusy(false);
    }
  }, []);

  const clearNearMe = useCallback(() => {
    setNearMeActive(false);
    setClientCoords(null);
  }, []);

  useEffect(() => {
    if (!selected || !clientId) {
      setFeeApproved(false);
      setHasConnectionCredit(false);
      setHasPending(false);
      setHasActiveCase(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setContactChecking(true);
      try {
        const [approved, pending, credit, activeCase] = await Promise.all([
          hasApprovedFeeForLawyer(clientId, selected.id),
          hasPendingTransaction(clientId, selected.id),
          hasOpenConnectionCreditForLawyer(clientId, selected.id),
          hasActiveCaseWithLawyer(clientId, selected.id),
        ]);
        if (!cancelled) {
          setFeeApproved(approved);
          setHasPending(pending);
          setHasConnectionCredit(credit);
          setHasActiveCase(activeCase);
        }
      } catch {
        if (!cancelled) {
          setFeeApproved(false);
          setHasConnectionCredit(false);
          setHasPending(false);
          setHasActiveCase(false);
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

        <View style={[styles.searchWrap, styles.locationSearchWrap]}>
          <Ionicons name="location-outline" size={20} color={colors.chatOutline} />
          <LocationAutocompleteInput
            variant="directory"
            value={locationQuery}
            onChangeText={setLocationQuery}
            onPickSuggestion={(s) => setLocationQuery(s.label)}
            placeholder="Ciudad o zona (sugerencias al escribir)"
            accessibilityLabel="Filtrar por ubicación"
            wrapperStyle={styles.locationAutocompleteFlex}
          />
        </View>

        <View style={styles.nearMeRow}>
          <TouchableOpacity
            style={[styles.nearMeBtn, nearMeActive && styles.nearMeBtnOn]}
            onPress={() => void (nearMeActive ? clearNearMe() : enableNearMe())}
            disabled={clientLocBusy}
            activeOpacity={0.85}
          >
            {clientLocBusy ? (
              <ActivityIndicator
                size="small"
                color={nearMeActive ? colors.chatSurface : colors.chatSecondary}
              />
            ) : (
              <>
                <Ionicons
                  name={nearMeActive ? 'close-circle' : 'navigate-circle-outline'}
                  size={20}
                  color={nearMeActive ? colors.chatSurface : colors.chatSecondary}
                />
                <Text style={[styles.nearMeBtnText, nearMeActive && styles.nearMeBtnTextOn]}>
                  {nearMeActive ? 'Quitar cercanía' : 'Abogados cercanos a mí'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {nearMeActive && clientCoords ? (
            <Text style={styles.nearMeHint}>Ordenados por distancia</Text>
          ) : null}
        </View>
      </View>

      {couponInfo.hasAny ? (
        <View style={styles.couponBanner}>
          <Ionicons name="ticket" size={22} color={colors.chatSecondary} />
          <Text style={styles.couponBannerText}>
            {couponSpecialtyLabels.length === 1
              ? `Tienes un cupón de conexión para la especialidad «${couponSpecialtyLabels[0]}»: puedes elegir a cualquier abogado de esa área y crear un caso sin pagar de nuevo el fee.`
              : `Tienes cupones de conexión activos (${couponSpecialtyLabels.join(', ')}): puedes elegir un abogado de esa misma especialidad y crear un caso sin pagar de nuevo el fee.`}
          </Text>
        </View>
      ) : null}

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
            Directorio de abogados verificados. Los perfiles con suscripción activa aparecen primero;
            después, quienes están en periodo de prueba y, al final, plan básico (prueba vencida). Puedes
            filtrar por nombre, ciudad o «cercanos a mí».
          </Text>
          {directoryRows.length === 0 ? (
            <Text style={styles.empty}>No hay resultados que coincidan.</Text>
          ) : (
            directoryRows.map(({ lawyer: l, distanceKm }) => (
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
                  {l.location_label ? (
                    <View style={styles.cardLocRow}>
                      <Ionicons name="location-outline" size={14} color={colors.chatOutline} />
                      <Text style={styles.cardLocation} numberOfLines={2}>
                        {l.location_label}
                      </Text>
                    </View>
                  ) : null}
                  {l.phone ? <Text style={styles.cardPhone}>{l.phone}</Text> : null}
                  {nearMeActive && distanceKm != null ? (
                    <Text style={styles.cardDistance}>~ {formatDistanceKm(distanceKm)}</Text>
                  ) : nearMeActive && distanceKm == null ? (
                    <Text style={styles.cardDistanceMuted}>Sin ubicación en mapa</Text>
                  ) : null}
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
                  {selected.location_label ? (
                    <View style={styles.modalLocRow}>
                      <Ionicons name="location-outline" size={16} color={colors.chatSecondary} />
                      <Text style={styles.modalLocation}>{selected.location_label}</Text>
                    </View>
                  ) : null}
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
                    Toca «Contratar consulta» para subir el comprobante; en seguida podrás describir tu
                    caso. Cuando el administrador valide el pago, el abogado recibirá la solicitud. Con
                    cupón de conexión, vas directo a crear el caso sin pagar de nuevo. WhatsApp solo
                    con un caso ya aceptado por el abogado.
                  </Text>

                  {feeApproved ? (
                    <View style={styles.feeVerifiedBanner}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.chatSecondary} />
                      <Text style={styles.feeVerifiedText}>
                        Ya tienes el fee de contacto aprobado para este abogado en la base de datos.
                        Por eso «Crear caso» va a la solicitud sin volver a la pantalla de pago.
                      </Text>
                    </View>
                  ) : null}

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
                      contactChecking && styles.btnDisabled,
                    ]}
                    onPress={() => {
                      if (!selected || hasPending || contactChecking) return;
                      const l = selected;
                      setSelected(null);
                      // Solo formulario de caso tras pago verificado o cupón (equivalente a haber pagado antes).
                      if (feeApproved || hasConnectionCredit) {
                        const deductConnectionCredit = !feeApproved && hasConnectionCredit;
                        onContactReady(l, { deductConnectionCredit });
                      } else {
                        onOpenPayment(l);
                      }
                    }}
                    disabled={!!hasPending || contactChecking}
                  >
                    {contactChecking ? (
                      <ActivityIndicator color={colors.chatSurface} size="small" />
                    ) : (
                      <>
                        <Ionicons
                          name={
                            feeApproved || hasConnectionCredit ? 'document-text-outline' : 'card-outline'
                          }
                          size={20}
                          color={colors.chatSurface}
                        />
                        <Text style={styles.btnPrimaryText}>
                          {feeApproved || hasConnectionCredit
                            ? 'Crear caso (solicitud)'
                            : 'Contratar consulta'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {onOpenWhatsApp ? (
                    <TouchableOpacity
                      style={[
                        styles.btnWa,
                        hasActiveCase && selected.phone && styles.btnContactActive,
                        (!hasActiveCase || !selected.phone) && styles.btnDisabledOpacity,
                        contactChecking && styles.btnDisabled,
                      ]}
                      disabled={!hasActiveCase || !selected.phone || contactChecking}
                      onPress={() => {
                        if (!selected || !hasActiveCase || !selected.phone) return;
                        const l = selected;
                        setSelected(null);
                        onOpenWhatsApp(l);
                      }}
                    >
                      <Ionicons
                        name="logo-whatsapp"
                        size={20}
                        color={
                          hasActiveCase && selected.phone
                            ? colors.chatSurface
                            : colors.chatOutline
                        }
                      />
                      <Text
                        style={[
                          styles.btnWaText,
                          hasActiveCase && selected.phone && styles.btnSecondaryTextOn,
                        ]}
                      >
                        WhatsApp
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {!feeApproved && !hasConnectionCredit && !contactChecking ? (
                    <Text style={styles.lockedHint}>
                      Contratar consulta abre el pago y el comprobante; luego describes el caso en la
                      misma sesión. No hace falta volver al directorio para eso.
                    </Text>
                  ) : null}
                  {(feeApproved || hasConnectionCredit) && !hasActiveCase && !contactChecking ? (
                    <Text style={styles.lockedHint}>
                      WhatsApp se habilita cuando tengas al menos un caso en curso con este abogado
                      (aceptado por él; no pendiente de aprobación).
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
  couponBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.chatPrimaryContainer,
    borderWidth: 1,
    borderColor: colors.chatSecondary + '33',
  },
  couponBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.chatOnSurface,
    lineHeight: 20,
    fontWeight: '600',
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
  locationSearchWrap: { zIndex: 40, alignItems: 'flex-start' },
  locationAutocompleteFlex: { flex: 1, minWidth: 0 },
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
  nearMeRow: { gap: 6 },
  nearMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.chatSecondary + '66',
    backgroundColor: colors.chatSurface,
  },
  nearMeBtnOn: {
    backgroundColor: colors.chatSecondary,
    borderColor: colors.chatSecondary,
  },
  nearMeBtnText: { fontSize: 14, fontWeight: '800', color: colors.chatSecondary },
  nearMeBtnTextOn: { color: colors.chatSurface },
  nearMeHint: { fontSize: 12, color: colors.chatOutline, marginLeft: 4 },
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
  cardLocRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
    maxWidth: '100%',
  },
  cardLocation: { flex: 1, fontSize: 12, color: colors.chatOutline, lineHeight: 18 },
  cardDistance: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.chatSecondary,
    marginTop: 4,
  },
  cardDistanceMuted: { fontSize: 11, color: colors.chatOutline, marginTop: 4, fontStyle: 'italic' },
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
  modalLocRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
  },
  modalLocation: { flex: 1, fontSize: 14, color: colors.chatOnSurface, lineHeight: 20 },
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
  feeVerifiedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.chatSecondaryContainer,
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.chatSecondary + '44',
  },
  feeVerifiedText: { flex: 1, fontSize: 13, color: colors.chatOnSurface, lineHeight: 20 },
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
  btnWa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: colors.chatContainer,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '99',
  },
  btnWaText: { fontSize: 15, fontWeight: '800', color: colors.chatOutline },
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
