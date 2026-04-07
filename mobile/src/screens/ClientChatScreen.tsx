import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import ClientCasesTab from './client/ClientCasesTab';
import ClientPaymentsTab from './client/ClientPaymentsTab';
import ClientProfileTab from './client/ClientProfileTab';
import LawyerDirectoryTab from './client/LawyerDirectoryTab';
import LawyerPaymentScreen from './client/LawyerPaymentScreen';
import type { DirectoryLawyer } from './client/LawyerDirectoryTab';
import CreateCaseScreen, { type CreateCaseLawyer } from './CreateCaseScreen';
import {
  hasApprovedFeeForLawyer,
  hasActiveCaseWithLawyer,
  getFirstActiveCaseTitleForLawyer,
} from '../lib/legalDashboard';
import { hasOpenConnectionCreditForLawyer } from '../lib/connectionCredits';
import { useClientNotifications } from '../hooks/useClientNotifications';
import ClientNotificationsModal from '../components/ClientNotificationsModal';
import ClientNotificationBell from '../components/ClientNotificationBell';
import { registerAndSaveClientPushToken } from '../lib/pushNotifications';
import { useChat } from '../hooks/useChat';
import ConversationListModal from '../components/ConversationListModal';

type TabType = 'chat' | 'directorio' | 'casos' | 'pagos' | 'perfil';

interface ChatMessage {
  id: string;
  type: 'ai' | 'user';
  content: string;
  time: string;
  caseType?: string;
  showActions?: boolean;
}

interface Lawyer {
  id: string;
  full_name: string | null;
  specialty: string | null;
  phone: string | null;
  is_verified: boolean;
}

// Mapeo categoría IA → especialidades en BD (Inquilinato = Inmobiliario)
const CATEGORY_TO_SPECIALTIES: Record<string, string[]> = {
  Laboral: ['Laboral'],
  Civil: ['Civil'],
  Penal: ['Penal'],
  Mercantil: ['Mercantil'],
  Público: ['Público'],
  Administrativo: ['Administrativo', 'Público'],
  Familia: ['Familia'],
  Inmobiliario: ['Inmobiliario', 'Inquilinato'],
  Inquilinato: ['Inmobiliario', 'Inquilinato'],
};

const WELCOME_MESSAGE: ChatMessage = {
  id: '0',
  type: 'ai',
  content:
    'Hola, soy LÉGALO AI, tu asistente legal. Describe tu situación para que pueda orientarte según el marco legal venezolano (Laboral, Civil, Penal, etc.).',
  time: formatTime(new Date()),
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

/** Solo dígitos, con prefijo 58, para wa.me */
function digitsForWhatsApp(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = `58${d.slice(1)}`;
  if (!d.startsWith('58')) d = `58${d}`;
  return d;
}

export default function ClientChatScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const clientId = session?.user?.id;

  const chat = useChat(clientId);
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [lawyersByMessage, setLawyersByMessage] = useState<Record<string, Lawyer[]>>({});
  const [loadingLawyersFor, setLoadingLawyersFor] = useState<string | null>(null);
  const [createCaseLawyer, setCreateCaseLawyer] = useState<CreateCaseLawyer | null>(null);
  const [createCaseDeductCredit, setCreateCaseDeductCredit] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [contactChecking, setContactChecking] = useState(false);
  const [paymentLawyer, setPaymentLawyer] = useState<DirectoryLawyer | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [clientNotifVisible, setClientNotifVisible] = useState(false);
  const [convListVisible, setConvListVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const clientNotifications = useClientNotifications(clientId);

  useEffect(() => {
    if (clientId) registerAndSaveClientPushToken(clientId);
  }, [clientId]);

  const goToTab = (t: TabType) => {
    setActiveTab(t);
    setMenuVisible(false);
  };

  const openWhatsAppWithCaseTitle = (lawyer: CreateCaseLawyer, caseTitle: string) => {
    const raw = lawyer.phone?.trim();
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

  const contactLawyer = async (lawyer: Lawyer) => {
    const raw = lawyer.phone?.trim();
    if (!raw) {
      Alert.alert('Sin teléfono', 'Este abogado no tiene número registrado.');
      return;
    }
    if (!clientId) {
      Alert.alert('Sesión', 'Inicia sesión para contactar a un abogado.');
      return;
    }

    setContactChecking(true);
    try {
      const [approved, credit, activeCase] = await Promise.all([
        hasApprovedFeeForLawyer(clientId, lawyer.id),
        hasOpenConnectionCreditForLawyer(clientId, lawyer.id),
        hasActiveCaseWithLawyer(clientId, lawyer.id),
      ]);
      if (activeCase) {
        const title =
          (await getFirstActiveCaseTitleForLawyer(clientId, lawyer.id)) ?? 'Mi caso';
        openWhatsAppWithCaseTitle(lawyer, title);
        return;
      }
      if (!approved && !credit) {
        Alert.alert(
          'Pago o cupón requerido',
          'Para solicitar un caso necesitas el fee verificado o un cupón de conexión. El WhatsApp directo con el abogado se habilita cuando tengas al menos un caso aceptado en curso con él.'
        );
        return;
      }
      setCreateCaseDeductCredit(!approved && credit);
      setCreateCaseLawyer(lawyer);
    } finally {
      setContactChecking(false);
    }
  };

  const fetchLawyers = async (messageId: string, category: string) => {
    const specialties = CATEGORY_TO_SPECIALTIES[category] ?? [category];
    setLoadingLawyersFor(messageId);
    try {
      const { data, error: qError } = await supabase
        .from('profiles')
        .select('id, full_name, specialty, phone, is_verified')
        .eq('role', 'lawyer')
        .in('specialty', specialties);

      if (qError) throw qError;
      setLawyersByMessage((prev) => ({ ...prev, [messageId]: (data ?? []) as Lawyer[] }));
    } catch (err) {
      setLawyersByMessage((prev) => ({ ...prev, [messageId]: [] }));
    } finally {
      setLoadingLawyersFor(null);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [chat.messages]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || chat.sending) return;
    setInputText('');
    void chat.sendMessage(text);
  };

  if (paymentLawyer && clientId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LawyerPaymentScreen
          lawyer={paymentLawyer}
          clientId={clientId}
          onBack={() => setPaymentLawyer(null)}
          onReceiptSubmitted={({ transactionId }) => {
            if (!paymentLawyer) return;
            const l = paymentLawyer;
            setPaymentLawyer(null);
            setCreateCaseDeductCredit(false);
            setPendingTransactionId(transactionId);
            setCreateCaseLawyer({
              id: l.id,
              full_name: l.full_name,
              phone: l.phone ?? null,
            });
          }}
        />
      </SafeAreaView>
    );
  }

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.type === 'user';
    return (
      <View
        key={msg.id}
        style={[styles.messageRow, isUser && styles.messageRowUser]}
      >
        <View
          style={[
            styles.avatar,
            isUser ? styles.avatarUser : styles.avatarAi,
          ]}
        >
          <Ionicons
            name={isUser ? 'person' : 'hardware-chip'}
            size={20}
            color={isUser ? colors.chatSurface : colors.chatSecondary}
          />
        </View>
        <View style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}>
          <View style={[styles.bubble, isUser && styles.bubbleUser]}>
            {msg.caseType && (
              <View style={styles.caseBadge}>
                <Text style={styles.caseBadgeText}>CASO DETECTADO: {msg.caseType}</Text>
              </View>
            )}
            <Text
              style={[
                styles.bubbleText,
                isUser && styles.bubbleTextUser,
              ]}
            >
              {msg.content}
            </Text>
            {msg.showActions && msg.caseType && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => fetchLawyers(msg.id, msg.caseType!)}
                  disabled={loadingLawyersFor === msg.id}
                >
                  {loadingLawyersFor === msg.id ? (
                    <ActivityIndicator size="small" color={colors.chatSecondary} />
                  ) : (
                    <Ionicons name="people" size={16} color={colors.chatSecondary} />
                  )}
                  <Text style={styles.actionText}>
                    {loadingLawyersFor === msg.id ? 'Buscando...' : 'VER ABOGADOS'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="document-text" size={16} color={colors.chatSecondary} />
                  <Text style={styles.actionText}>VER ARTÍCULOS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="calculator" size={16} color={colors.chatSecondary} />
                  <Text style={styles.actionText}>ESTIMAR MONTO</Text>
                </TouchableOpacity>
              </View>
            )}
            {msg.showActions && msg.caseType && lawyersByMessage[msg.id] !== undefined && (
              <View style={styles.lawyerList}>
                <Text style={styles.lawyerListTitle}>Abogados en {msg.caseType}</Text>
                {lawyersByMessage[msg.id].length === 0 ? (
                  <Text style={styles.lawyerEmpty}>
                    No hay abogados en esta área por el momento. Prueba otra categoría.
                  </Text>
                ) : (
                  lawyersByMessage[msg.id].map((lawyer) => (
                    <View key={lawyer.id} style={styles.lawyerCard}>
                      <View style={styles.lawyerAvatar}>
                        <Ionicons name="person" size={24} color={colors.chatSecondary} />
                      </View>
                      <View style={styles.lawyerInfo}>
                        <View style={styles.lawyerNameRow}>
                          <Text style={styles.lawyerName}>{lawyer.full_name || 'Abogado'}</Text>
                          {lawyer.is_verified && (
                            <Ionicons name="checkmark-circle" size={14} color={colors.chatSecondary} />
                          )}
                        </View>
                        <Text style={styles.lawyerSpecialty}>{lawyer.specialty || msg.caseType}</Text>
                        {lawyer.phone && (
                          <Text style={styles.lawyerPhone}>{lawyer.phone}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.lawyerContact,
                          contactChecking && styles.lawyerContactDisabled,
                        ]}
                        onPress={() => void contactLawyer(lawyer)}
                        disabled={contactChecking}
                        accessibilityRole="button"
                        accessibilityLabel={`Contactar a ${lawyer.full_name || 'abogado'}`}
                      >
                        {contactChecking ? (
                          <ActivityIndicator size="small" color={colors.chatSurface} />
                        ) : (
                          <Text style={styles.lawyerContactText}>Contactar</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
          <Text style={[styles.messageFooter, isUser && styles.messageFooterUser]}>
            {isUser ? 'USTED' : 'LÉGALO AI'} • {msg.time}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
            hitSlop={12}
            accessibilityLabel="Menú del panel de cliente"
          >
            <Ionicons name="menu" size={26} color={colors.chatPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Logo size="small" />
            <View style={styles.headerTitle}>
              <Text style={styles.headerBrand}>LÉGALO</Text>
              <Text style={styles.headerSubtitle}>DIAGNÓSTICO IA VENEZOLANA</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {activeTab === 'chat' && (
              <TouchableOpacity
                onPress={() => setConvListVisible(true)}
                hitSlop={10}
                accessibilityLabel="Ver conversaciones"
              >
                <Ionicons name="chatbubbles-outline" size={24} color={colors.chatPrimary} />
              </TouchableOpacity>
            )}
            <ClientNotificationBell
              unreadCount={clientNotifications.unreadCount}
              onPress={() => {
                setClientNotifVisible(true);
                void clientNotifications.refresh();
              }}
            />
            <TouchableOpacity
              style={styles.profileAvatar}
              onPress={() => goToTab('perfil')}
              hitSlop={8}
              accessibilityLabel="Ir a perfil"
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImage} />
              ) : (
                <Ionicons name="person" size={20} color={colors.chatOutline} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={menuVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setMenuVisible(false)}
        >
          <View style={styles.menuBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
            <View style={styles.menuSheetWrap}>
              <View style={styles.menuSheet}>
              <Text style={styles.menuTitle}>Panel de cliente</Text>
              <Text style={styles.menuSubtitle}>
                Accede a cualquier sección sin pasar por el chat con la IA.
              </Text>

              <TouchableOpacity
                style={[styles.menuRow, activeTab === 'chat' && styles.menuRowActive]}
                onPress={() => goToTab('chat')}
              >
                <Ionicons name="chatbubbles-outline" size={22} color={colors.chatSecondary} />
                <Text style={styles.menuRowText}>Chat con LÉGALO AI</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.chatOutline} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.menuRow,
                  styles.menuRowMultiline,
                  activeTab === 'directorio' && styles.menuRowActive,
                ]}
                onPress={() => goToTab('directorio')}
              >
                <Ionicons name="people" size={22} color={colors.chatSecondary} style={styles.menuRowIconTop} />
                <View style={styles.menuRowTextBlock}>
                  <Text style={styles.menuRowTextTitle}>Directorio de abogados</Text>
                  <Text style={styles.menuRowHint}>Busca y elige un abogado por tu cuenta</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.chatOutline} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuRow, activeTab === 'casos' && styles.menuRowActive]}
                onPress={() => goToTab('casos')}
              >
                <Ionicons name="folder-open-outline" size={22} color={colors.chatSecondary} />
                <Text style={styles.menuRowText}>Mis casos</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.chatOutline} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuRow, activeTab === 'pagos' && styles.menuRowActive]}
                onPress={() => goToTab('pagos')}
              >
                <Ionicons name="card-outline" size={22} color={colors.chatSecondary} />
                <Text style={styles.menuRowText}>Pagos</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.chatOutline} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuRow, activeTab === 'perfil' && styles.menuRowActive]}
                onPress={() => goToTab('perfil')}
              >
                <Ionicons name="person-circle-outline" size={22} color={colors.chatSecondary} />
                <Text style={styles.menuRowText}>Mi perfil</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.chatOutline} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuClose} onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuCloseText}>Cerrar</Text>
              </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Main Content */}
        {activeTab === 'chat' ? (
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {/* Hero */}
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>ASISTENCIA JURÍDICA DIGITAL</Text>
              <Text style={styles.heroTitle}>Consulta Inteligente</Text>
              <Text style={styles.heroDesc}>
                Analizamos su situación bajo el marco legal de la República Bolivariana de
                Venezuela en tiempo real.
              </Text>
              <TouchableOpacity
                style={styles.heroDirectoryBtn}
                onPress={() => setActiveTab('directorio')}
                activeOpacity={0.88}
              >
                <Ionicons name="people" size={20} color={colors.chatSurface} />
                <Text style={styles.heroDirectoryBtnText}>Buscar abogado en el directorio</Text>
              </TouchableOpacity>
              <Text style={styles.heroDirectoryHint}>
                No necesitas usar el chat: explora y elige un abogado cuando quieras.
              </Text>
            </View>

            {/* Chat Messages */}
            <View style={styles.chatContainer}>
              {[WELCOME_MESSAGE, ...chat.messages].map(renderMessage)}
              {chat.sending && (
                <View style={[styles.messageRow, styles.loadingRow]}>
                  <View style={[styles.avatar, styles.avatarAi]}>
                    <Ionicons name="hardware-chip" size={20} color={colors.chatSecondary} />
                  </View>
                  <View style={[styles.bubble, styles.loadingBubble]}>
                    <ActivityIndicator size="small" color={colors.chatSecondary} />
                    <Text style={styles.loadingText}>LÉGALO AI está analizando...</Text>
                  </View>
                </View>
              )}
            </View>
            {chat.sendError && (
              <Text style={styles.errorText}>{chat.sendError}</Text>
            )}
          </ScrollView>
        ) : activeTab === 'directorio' && clientId ? (
          <View style={styles.tabShell}>
            <LawyerDirectoryTab
              clientId={clientId}
              onOpenPayment={(l) => setPaymentLawyer(l)}
              onContactReady={(l, meta) => {
                setCreateCaseDeductCredit(meta.deductConnectionCredit);
                setCreateCaseLawyer({
                  id: l.id,
                  full_name: l.full_name,
                  phone: l.phone,
                });
              }}
              onOpenWhatsApp={async (l) => {
                if (!clientId) return;
                const title =
                  (await getFirstActiveCaseTitleForLawyer(clientId, l.id)) ?? 'Mi caso';
                openWhatsAppWithCaseTitle(
                  { id: l.id, full_name: l.full_name, phone: l.phone },
                  title
                );
              }}
            />
          </View>
        ) : activeTab === 'casos' && clientId ? (
          <View style={styles.tabShell}>
            <ClientCasesTab clientId={clientId} />
          </View>
        ) : activeTab === 'pagos' && clientId ? (
          <View style={styles.tabShell}>
            <ClientPaymentsTab clientId={clientId} />
          </View>
        ) : activeTab === 'perfil' ? (
          <View style={styles.tabShell}>
            <ClientProfileTab
              profile={profile}
              email={session?.user?.email ?? ''}
              clientId={clientId}
              refreshProfile={refreshProfile}
            />
          </View>
        ) : (
          <View style={styles.missingClient}>
            <Text style={styles.placeholderText}>Inicia sesión para ver esta sección.</Text>
          </View>
        )}

        {/* Input Area */}
        {activeTab === 'chat' && (
          <View style={styles.inputWrapper}>
            <View style={styles.inputBar}>
              <TouchableOpacity style={styles.attachButton}>
                <Ionicons name="attach" size={22} color={colors.chatOutline} />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Escriba su consulta legal aquí..."
                placeholderTextColor={colors.chatOutline + '99'}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendButton, chat.sending && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={chat.sending}
              >
                <Ionicons name="send" size={20} color={colors.chatSurface} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Nav */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'chat' && styles.navItemActive]}
            onPress={() => setActiveTab('chat')}
          >
            <Ionicons
              name="chatbubble"
              size={22}
              color={activeTab === 'chat' ? colors.chatSecondary : colors.chatOutline}
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === 'chat' && styles.navLabelActive,
              ]}
            >
              Chat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'directorio' && styles.navItemActive]}
            onPress={() => setActiveTab('directorio')}
          >
            <Ionicons
              name="people"
              size={22}
              color={activeTab === 'directorio' ? colors.chatSecondary : colors.chatOutline}
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === 'directorio' && styles.navLabelActive,
              ]}
            >
              Abogados
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'casos' && styles.navItemActive]}
            onPress={() => setActiveTab('casos')}
          >
            <Ionicons
              name="folder-open"
              size={22}
              color={activeTab === 'casos' ? colors.chatSecondary : colors.chatOutline}
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === 'casos' && styles.navLabelActive,
              ]}
            >
              Casos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'pagos' && styles.navItemActive]}
            onPress={() => setActiveTab('pagos')}
          >
            <Ionicons
              name="card"
              size={22}
              color={activeTab === 'pagos' ? colors.chatSecondary : colors.chatOutline}
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === 'pagos' && styles.navLabelActive,
              ]}
            >
              Pagos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navItem, activeTab === 'perfil' && styles.navItemActive]}
            onPress={() => setActiveTab('perfil')}
          >
            <Ionicons
              name="person-circle"
              size={22}
              color={activeTab === 'perfil' ? colors.chatSecondary : colors.chatOutline}
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === 'perfil' && styles.navLabelActive,
              ]}
            >
              Perfil
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {clientId ? (
        <ClientNotificationsModal
          visible={clientNotifVisible}
          onClose={() => setClientNotifVisible(false)}
          items={clientNotifications.items}
          loading={clientNotifications.loading}
          onMarkRead={(id) => void clientNotifications.markRead(id)}
          onMarkAllRead={() => void clientNotifications.markAllRead()}
        />
      ) : null}

      <ConversationListModal
        visible={convListVisible}
        onClose={() => setConvListVisible(false)}
        conversations={chat.conversations}
        activeConversationId={chat.activeConversationId}
        onSelect={(id) => void chat.switchConversation(id)}
        onNewConversation={() => {
          void chat.newConversation();
          setConvListVisible(false);
        }}
        onDelete={(id) => void chat.deleteConversation(id)}
        loading={chat.conversationsLoading}
      />

      {createCaseLawyer && clientId ? (
        <CreateCaseScreen
          visible
          deductConnectionCredit={createCaseDeductCredit}
          pendingTransactionId={pendingTransactionId}
          lawyer={createCaseLawyer}
          clientId={clientId}
          clientDisplayName={profile?.full_name?.trim() || 'Cliente'}
          onClose={() => {
            setCreateCaseLawyer(null);
            setCreateCaseDeductCredit(false);
            setPendingTransactionId(null);
          }}
          onCaseCreated={({ title, lawyer, status }) => {
            setCreateCaseLawyer(null);
            setCreateCaseDeductCredit(false);
            setPendingTransactionId(null);
            void clientNotifications.refresh();
            if (status === 'awaiting_payment') {
              Alert.alert(
                'Recibido',
                'Tenemos tu comprobante y los datos del caso. Cuando el administrador apruebe el pago, el abogado verá tu solicitud para aceptarla o rechazarla. Te avisaremos por la app.',
                [{ text: 'Entendido' }]
              );
              return;
            }
            if (status === 'pending_approval') {
              Alert.alert(
                'Solicitud enviada',
                'Tu caso quedó pendiente de aprobación del abogado. Cuando lo acepte, podrás abrir WhatsApp desde Mis casos para contactarle.',
                [{ text: 'Entendido' }]
              );
              return;
            }
            openWhatsAppWithCaseTitle(lawyer, title);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.chatContainer },
  keyboardView: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.chatSurface + 'B3',
    gap: 8,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: '#00000066',
  },
  menuSheetWrap: {
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  menuSheet: {
    backgroundColor: colors.chatSurface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.chatPrimary,
    marginBottom: 6,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.chatOutline,
    lineHeight: 20,
    marginBottom: 18,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  menuRowMultiline: {
    alignItems: 'flex-start',
  },
  menuRowIconTop: { marginTop: 2 },
  menuRowActive: {
    backgroundColor: colors.chatSecondaryContainer,
    borderColor: colors.chatSecondary + '33',
  },
  menuRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.chatOnSurface,
  },
  menuRowTextBlock: { flex: 1 },
  menuRowTextTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.chatOnSurface,
  },
  menuRowHint: {
    fontSize: 12,
    color: colors.chatOutline,
    marginTop: 2,
  },
  menuClose: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  menuCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.chatSecondary,
  },
  headerTitle: {
    gap: 2,
  },
  headerBrand: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.chatOnSurface,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: colors.chatOutline,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.chatContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '33',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },

  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  placeholderContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  placeholderCard: {
    alignItems: 'center',
    backgroundColor: colors.chatSurface,
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '33',
    gap: 12,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.chatPrimary,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: colors.chatOutline,
    textAlign: 'center',
    lineHeight: 22,
  },
  tabShell: { flex: 1, minHeight: 0 },
  missingClient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.chatSecondary,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.chatPrimary,
    marginBottom: 12,
  },
  heroDesc: {
    fontSize: 14,
    color: colors.chatOutline,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 340,
  },
  heroDirectoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.chatSecondary,
    borderRadius: 12,
    alignSelf: 'center',
  },
  heroDirectoryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.chatSurface,
  },
  heroDirectoryHint: {
    fontSize: 12,
    color: colors.chatOutline,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
    maxWidth: 300,
    paddingHorizontal: 8,
  },

  chatContainer: {
    gap: 24,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    maxWidth: '88%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAi: {
    backgroundColor: colors.chatPrimaryContainer,
    borderWidth: 1,
    borderColor: colors.chatSecondary + '20',
  },
  avatarUser: {
    backgroundColor: colors.chatSecondary,
  },
  bubbleWrapper: {
    flex: 1,
  },
  bubbleWrapperUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    backgroundColor: colors.chatSurface,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '4D',
    borderRadius: 12,
    borderTopLeftRadius: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleUser: {
    backgroundColor: colors.chatPrimary,
    borderColor: 'transparent',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 0,
  },
  bubbleText: {
    fontSize: 14,
    color: colors.chatOnSurface,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: colors.chatSurface,
  },
  caseBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.chatSecondaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.chatSecondary + '33',
  },
  caseBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.chatSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.chatOutlineVariant + '33',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.chatSecondary,
    letterSpacing: 0.5,
  },
  messageFooter: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.chatOutline,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  messageFooterUser: {
    textAlign: 'right',
  },

  lawyerList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.chatOutlineVariant + '33',
    gap: 12,
  },
  lawyerListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.chatSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lawyerEmpty: {
    fontSize: 13,
    color: colors.chatOutline,
    fontStyle: 'italic',
  },
  lawyerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chatContainer,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '33',
  },
  lawyerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.chatPrimaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lawyerInfo: {
    flex: 1,
    gap: 2,
  },
  lawyerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lawyerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.chatOnSurface,
  },
  lawyerSpecialty: {
    fontSize: 12,
    color: colors.chatOutline,
  },
  lawyerPhone: {
    fontSize: 11,
    color: colors.chatSecondary,
    marginTop: 2,
  },
  lawyerContact: {
    backgroundColor: colors.chatSecondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lawyerContactDisabled: {
    opacity: 0.85,
  },
  lawyerContactText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.chatSurface,
  },

  inputWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.chatSurface + 'E6',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    shadowColor: colors.chatPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '4D',
  },
  attachButton: {
    padding: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.chatOnSurface,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.chatSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    marginTop: 8,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: colors.chatOutline,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 12,
    textAlign: 'center',
  },

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 24,
    backgroundColor: colors.chatSurface + 'B3',
    borderTopWidth: 1,
    borderTopColor: colors.chatOutlineVariant + '26',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    flex: 1,
    minWidth: 0,
  },
  navItemActive: {
    backgroundColor: colors.chatSecondaryContainer,
    borderRadius: 12,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.chatOutline,
    marginTop: 4,
  },
  navLabelActive: {
    color: colors.chatSecondary,
  },
});
