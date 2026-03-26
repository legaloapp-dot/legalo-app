import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Linking,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../components/Logo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { useLawyerDashboardData } from '../hooks/useLawyerDashboardData';
import {
  sortLawyerCasesForDisplay,
  buildLawyerDashboardActivity,
  activityIcon,
  activityDot,
  type LegalCaseRow,
  type LawyerActivityRow,
} from '../lib/legalDashboard';
import { relativeTimeEs, digitsOnlyE164 } from '../lib/format';
import LawyerCaseList from './lawyer/LawyerCaseList';
import LawyerCasosPanel from './lawyer/LawyerCasosPanel';
import LawyerCaseDetailModal from './lawyer/LawyerCaseDetailModal';
import LawyerProfileEditTab from './lawyer/LawyerProfileEditTab';
import LawyerPaymentsTab from './lawyer/LawyerPaymentsTab';
import LawyerNotificationsModal from '../components/LawyerNotificationsModal';
import LawyerNotificationBell from '../components/LawyerNotificationBell';
import { useLawyerNotifications } from '../hooks/useLawyerNotifications';
import { registerAndSaveLawyerPushToken } from '../lib/pushNotifications';
import BannerVencimiento from '../components/BannerVencimiento';

const WHATSAPP = '#25D366';

type LawyerTab = 'cases' | 'leads' | 'payments' | 'profile';

export default function LawyerDashboardScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const lawyerId = session?.user?.id;
  const dashboard = useLawyerDashboardData(lawyerId);
  const notifications = useLawyerNotifications(lawyerId);
  const [tab, setTab] = useState<LawyerTab>('cases');
  const [receivingCases, setReceivingCases] = useState(profile?.accepting_cases ?? true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCase, setSelectedCase] = useState<LegalCaseRow | null>(null);
  const [caseModalVisible, setCaseModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);

  useEffect(() => {
    setReceivingCases(profile?.accepting_cases ?? true);
  }, [profile?.accepting_cases]);

  useEffect(() => {
    if (!lawyerId) return;
    void registerAndSaveLawyerPushToken(lawyerId);
  }, [lawyerId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dashboard.refresh();
    await notifications.refresh();
    await refreshProfile();
    setRefreshing(false);
  }, [dashboard, notifications, refreshProfile]);

  const onPaymentsRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }, [refreshProfile]);

  const persistAccepting = async (v: boolean) => {
    if (!lawyerId) return;
    setReceivingCases(v);
    const { error } = await supabase.from('profiles').update({ accepting_cases: v }).eq('id', lawyerId);
    if (error) {
      Alert.alert('Error', error.message);
      setReceivingCases(!v);
      return;
    }
    await refreshProfile();
  };

  const displayName = useMemo(() => {
    const n = profile?.full_name?.trim();
    if (n) return n;
    return 'Abogado';
  }, [profile?.full_name]);

  const specialtyLine = useMemo(() => {
    const s = profile?.specialty;
    const o = profile?.specialty_other?.trim();
    if (s === 'Otro' && o) return `Disponible para ${o}`;
    if (s) return `Disponible para ${s}`;
    return 'Disponible para nuevos casos';
  }, [profile?.specialty, profile?.specialty_other]);

  const dateLine = useMemo(() => {
    const d = new Date();
    const dateStr = d.toLocaleDateString('es-VE', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${dateStr} • Caracas, VE`;
  }, []);

  const ratingDisplay = useMemo(() => {
    const r = profile?.professional_rating;
    if (r == null || Number.isNaN(Number(r))) return { main: '—', showSlash: false };
    return { main: Number(r).toFixed(1), showSlash: true };
  }, [profile?.professional_rating]);

  const activityFeed = useMemo(
    () => buildLawyerDashboardActivity(dashboard.cases, dashboard.activity),
    [dashboard.cases, dashboard.activity]
  );

  const openWa = (phone: string) => {
    const d = digitsOnlyE164(phone);
    if (!d) return;
    Linking.openURL(`https://wa.me/${d}`).catch(() => {});
  };

  const activityMeta = (a: LawyerActivityRow) => ({
    icon: activityIcon(a.event_type) as keyof typeof Ionicons.glyphMap,
    dot: activityDot(a.event_type),
  });

  const openNotifications = useCallback(() => {
    setNotificationsModalVisible(true);
    void notifications.refresh();
  }, [notifications]);

  const trialBannerEl = (
    <BannerVencimiento plan={profile?.plan} subscriptionExpiresAt={profile?.subscription_expires_at} />
  );

  const notificationsModalEl = (
    <LawyerNotificationsModal
      visible={notificationsModalVisible}
      onClose={() => {
        setNotificationsModalVisible(false);
        void notifications.refresh();
      }}
      items={notifications.items}
      loading={notifications.loading}
      onMarkRead={(id) => void notifications.markRead(id)}
      onMarkAllRead={() => void notifications.markAllRead()}
    />
  );

  if (tab === 'leads') {
    return (
      <>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.subHeader}>
            <View style={styles.subHeaderSlot}>
              <TouchableOpacity onPress={() => setTab('cases')} hitSlop={12}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.subTitle, styles.subHeaderTitleFlex]}>Casos</Text>
            <View style={styles.subHeaderSlot}>
              <LawyerNotificationBell unreadCount={notifications.unreadCount} onPress={openNotifications} />
            </View>
          </View>
          <View style={styles.trialBannerSlot}>{trialBannerEl}</View>
          <LawyerCasosPanel
            cases={dashboard.cases}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onSelectCase={(c) => {
              setSelectedCase(c);
              setCaseModalVisible(true);
            }}
          />
          <LawyerCaseDetailModal
            visible={caseModalVisible}
            lawyerId={lawyerId}
            caseRow={selectedCase}
            onClose={() => {
              setCaseModalVisible(false);
              setSelectedCase(null);
            }}
            onSaved={() => {
              void dashboard.refresh();
            }}
          />
          <LawyerBottomNav active={tab} onChange={setTab} />
        </SafeAreaView>
        {notificationsModalEl}
      </>
    );
  }

  if (tab === 'payments') {
    return (
      <>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.subHeader}>
            <View style={styles.subHeaderSlot}>
              <TouchableOpacity onPress={() => setTab('cases')} hitSlop={12}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.subTitle, styles.subHeaderTitleFlex]}>Pagos</Text>
            <View style={styles.subHeaderSlot}>
              <LawyerNotificationBell unreadCount={notifications.unreadCount} onPress={openNotifications} />
            </View>
          </View>
          <View style={styles.trialBannerSlot}>{trialBannerEl}</View>
          <LawyerPaymentsTab
            profile={profile}
            refreshing={refreshing}
            onRefresh={() => void onPaymentsRefresh()}
          />
          <LawyerBottomNav active={tab} onChange={setTab} />
        </SafeAreaView>
        {notificationsModalEl}
      </>
    );
  }

  if (tab === 'profile') {
    return (
      <>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <LawyerProfileEditTab
            profile={profile}
            userId={lawyerId}
            email={session?.user?.email ?? ''}
            onSignOut={() => void supabase.auth.signOut()}
            onClose={() => setTab('cases')}
            refreshProfile={refreshProfile}
            topBanner={trialBannerEl}
            headerRight={
              <LawyerNotificationBell unreadCount={notifications.unreadCount} onPress={openNotifications} />
            }
          />
          <LawyerBottomNav active={tab} onChange={setTab} />
        </SafeAreaView>
        {notificationsModalEl}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {dashboard.loading && dashboard.cases.length === 0 ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {dashboard.error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{dashboard.error}</Text>
            <TouchableOpacity onPress={() => void dashboard.refresh()}>
              <Text style={styles.retry}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Logo size="small" />
          </View>
          <View style={styles.topRight}>
            <LawyerNotificationBell unreadCount={notifications.unreadCount} onPress={openNotifications} />
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => setTab('profile')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Ir a mi perfil"
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {trialBannerEl}

        <Text style={styles.welcome}>Bienvenido de nuevo,{'\n'}{displayName}</Text>
        <Text style={styles.dateLine}>{dateLine}</Text>

        <View style={styles.statusCard}>
          <View style={styles.statusTextCol}>
            <Text style={styles.statusTitle}>
              {receivingCases ? 'Estado: Recibiendo casos' : 'Estado: No disponible'}
            </Text>
            <Text style={styles.statusSub}>{specialtyLine}</Text>
          </View>
          <Switch
            value={receivingCases}
            onValueChange={(v) => void persistAccepting(v)}
            trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
            thumbColor={receivingCases ? colors.onPrimary : colors.surfaceContainerHighest}
          />
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, styles.metricDark, styles.metricHalf]}>
            <Ionicons name="hammer" size={36} color={colors.secondaryContainer} />
            <Text style={styles.metricLabelDark}>Casos activos</Text>
            <Text style={styles.metricValueDark}>
              {String(dashboard.activeCaseCount).padStart(2, '0')}
            </Text>
          </View>
          <View style={[styles.metricCard, styles.metricGold, styles.metricHalf]}>
            <Ionicons name="star" size={36} color={colors.onPrimary} />
            <Text style={styles.metricLabelGold}>Valoración profesional</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.metricValueGold}>{ratingDisplay.main}</Text>
              {ratingDisplay.showSlash ? (
                <Text style={styles.ratingSlash}>/ 5.0</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Nuevas solicitudes</Text>
            {dashboard.newLeadsCount > 0 ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{dashboard.newLeadsCount} nuevas</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => setTab('leads')}>
            <Text style={styles.viewAll}>Ver en Casos</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.leadsScroll}
        >
          {dashboard.leads.length === 0 ? (
            <Text style={styles.inlineEmpty}>No hay solicitudes aún.</Text>
          ) : (
            dashboard.leads.slice(0, 8).map((lead, idx) => (
              <View
                key={lead.id}
                style={[styles.leadCard, idx === 1 && styles.leadCardAccent]}
              >
                <View style={styles.leadHead}>
                  <View style={styles.leadAvatar}>
                    <Ionicons name="person" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.leadHeadText}>
                    <Text style={styles.leadName}>{lead.client_name}</Text>
                    <Text style={styles.leadTag}>{lead.category || 'Consulta'}</Text>
                  </View>
                </View>
                {lead.message ? (
                  <Text style={styles.leadQuote}>"{lead.message}"</Text>
                ) : null}
                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() => openWa(lead.phone_e164)}
                  activeOpacity={0.9}
                >
                  <Ionicons name="logo-whatsapp" size={20} color={colors.onPrimary} />
                  <Text style={styles.waBtnText}>Contactar por WhatsApp</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        <Text style={styles.sectionTitleLeft}>Casos en curso</Text>
        <LawyerCaseList
          cases={sortLawyerCasesForDisplay(dashboard.cases)}
          onSelectCase={(c) => {
            setSelectedCase(c);
            setCaseModalVisible(true);
          }}
        />

        <View style={styles.activityCard}>
          <Text style={styles.activityTitle}>Actividad reciente</Text>
          {activityFeed.length === 0 ? (
            <Text style={styles.emptySection}>Sin actividad reciente.</Text>
          ) : (
            <View style={styles.timeline}>
              {activityFeed.map((a) => {
                const meta = activityMeta(a);
                return (
                  <View key={a.id} style={styles.timelineItem}>
                    <View
                      style={[
                        styles.timelineDot,
                        meta.dot === 'secondary' && { backgroundColor: colors.secondary },
                        meta.dot === 'primary' && { backgroundColor: colors.primary },
                        meta.dot === 'muted' && { backgroundColor: colors.surfaceContainerHighest },
                      ]}
                    >
                      <Ionicons
                        name={meta.icon}
                        size={12}
                        color={meta.dot === 'muted' ? colors.primary : colors.onPrimary}
                      />
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTitle}>{a.title}</Text>
                      {a.body ? <Text style={styles.timelineSub}>{a.body}</Text> : null}
                      <Text style={styles.timelineTime}>{relativeTimeEs(a.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <LawyerCaseDetailModal
        visible={caseModalVisible}
        lawyerId={lawyerId}
        caseRow={selectedCase}
        onClose={() => {
          setCaseModalVisible(false);
          setSelectedCase(null);
        }}
        onSaved={() => {
          void dashboard.refresh();
        }}
      />

      {notificationsModalEl}

      <LawyerBottomNav active={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

function LawyerBottomNav({
  active,
  onChange,
}: {
  active: LawyerTab;
  onChange: (t: LawyerTab) => void;
}) {
  const items: { key: LawyerTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'cases', label: 'Inicio', icon: 'home-outline' },
    { key: 'leads', label: 'Casos', icon: 'folder-open-outline' },
    { key: 'payments', label: 'Pagos', icon: 'card-outline' },
    { key: 'profile', label: 'Perfil', icon: 'person-circle-outline' },
  ];
  return (
    <View style={styles.bottomNav}>
      {items.map((it) => {
        const isActive = active === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            style={[styles.navItem, isActive && styles.navItemActive]}
            onPress={() => onChange(it.key)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={it.icon}
              size={22}
              color={isActive ? colors.onPrimary : colors.outline}
            />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const { width: SCREEN_W } = Dimensions.get('window');
const LEAD_W = Math.min(320, SCREEN_W - 48);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 8 },
  loaderWrap: { paddingVertical: 24, alignItems: 'center' },
  errBox: {
    backgroundColor: colors.errorContainer,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errText: { color: colors.error, fontSize: 13 },
  retry: { color: colors.primary, fontWeight: '700', marginTop: 8 },

  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  subHeaderSlot: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderTitleFlex: { flex: 1, textAlign: 'center' },
  subTitle: { fontSize: 18, fontWeight: '800', color: colors.primary },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trialBannerSlot: { paddingHorizontal: 20, marginBottom: 4 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '44',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },

  welcome: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.6,
    lineHeight: 34,
    marginBottom: 8,
  },
  dateLine: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.outline,
    marginBottom: 20,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '22',
    marginBottom: 20,
  },
  statusTextCol: { flex: 1, paddingRight: 12 },
  statusTitle: { fontSize: 16, fontWeight: '700', color: colors.primary },
  statusSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
    marginTop: 4,
  },

  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  metricHalf: { flex: 1, minWidth: 0 },
  metricCard: {
    borderRadius: 12,
    padding: 20,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  metricDark: { backgroundColor: colors.primary },
  metricWhite: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '22',
  },
  metricGold: { backgroundColor: colors.secondary },
  metricLabelDark: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.onPrimary,
    opacity: 0.75,
    marginTop: 12,
  },
  metricValueDark: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  metricWhiteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgeGreen: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  metricLabelLight: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.outline,
    marginTop: 12,
  },
  metricValueBlue: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.primary,
  },
  metricLabelGold: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.onPrimary,
    opacity: 0.85,
    marginTop: 12,
  },
  metricValueGold: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  ratingSlash: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
    opacity: 0.85,
    marginBottom: 8,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  newBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.onPrimary,
    textTransform: 'uppercase',
  },
  viewAll: { fontSize: 13, fontWeight: '700', color: colors.primary },
  sectionTitleLeft: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 16,
    marginTop: 8,
  },
  emptySection: {
    fontSize: 14,
    color: colors.outline,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  inlineEmpty: { fontSize: 14, color: colors.outline, paddingVertical: 16 },

  leadsScroll: {
    gap: 16,
    paddingBottom: 8,
    paddingRight: 20,
  },
  leadCard: {
    width: LEAD_W,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 18,
    marginRight: 4,
  },
  leadCardAccent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  leadHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  leadAvatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadHeadText: { flex: 1 },
  leadName: { fontSize: 16, fontWeight: '700', color: colors.primary },
  leadTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.secondary,
    marginTop: 4,
  },
  leadQuote: {
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
  },
  waBtnText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },

  activityCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 20,
  },
  timeline: { position: 'relative', paddingLeft: 4 },
  timelineItem: {
    position: 'relative',
    flexDirection: 'row',
    marginBottom: 22,
    paddingLeft: 32,
  },
  timelineDot: {
    position: 'absolute',
    left: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surfaceContainerLow,
  },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  timelineSub: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 },
  timelineTime: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.outline,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: 20,
    backgroundColor: colors.surfaceContainerLowest + 'F2',
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '33',
  },
  navItem: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 64,
    flex: 1,
  },
  navItemActive: { backgroundColor: colors.primary },
  navLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.outline,
    marginTop: 4,
  },
  navLabelActive: { color: colors.onPrimary },
});
