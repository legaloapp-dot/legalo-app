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
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import ClientCasesTab from './client/ClientCasesTab';
import ClientPaymentsTab from './client/ClientPaymentsTab';
import ClientProfileTab from './client/ClientProfileTab';
import LawyerDirectoryTab from './client/LawyerDirectoryTab';
import LawyerPaymentScreen from './client/LawyerPaymentScreen';
import type { DirectoryLawyer } from '../types/lawyers';
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
import { useChat, type ChatMessage, type UploadAttachment } from '../hooks/useChat';
import ConversationListModal from '../components/ConversationListModal';
import ChatMarkdownText from '../components/ChatMarkdownText';

type TabType = 'chat' | 'directorio' | 'casos' | 'pagos' | 'perfil';

type AttachmentItem = UploadAttachment;

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
  return date.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const [lawyersByMessage, setLawyersByMessage] = useState<
    Record<string, Lawyer[]>
  >({});
  const [loadingLawyersFor, setLoadingLawyersFor] = useState<string | null>(
    null
  );
  const [createCaseLawyer, setCreateCaseLawyer] =
    useState<CreateCaseLawyer | null>(null);
  const [createCaseDeductCredit, setCreateCaseDeductCredit] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState<
    string | null
  >(null);
  const [contactChecking, setContactChecking] = useState(false);
  const [paymentLawyer, setPaymentLawyer] = useState<DirectoryLawyer | null>(
    null
  );
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
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

  const openWhatsAppWithCaseTitle = (
    lawyer: CreateCaseLawyer,
    caseTitle: string
  ) => {
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
          (await getFirstActiveCaseTitleForLawyer(clientId, lawyer.id)) ??
          'Mi caso';
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
      setLawyersByMessage((prev) => ({
        ...prev,
        [messageId]: (data ?? []) as Lawyer[],
      }));
    } catch (err) {
      setLawyersByMessage((prev) => ({ ...prev, [messageId]: [] }));
    } finally {
      setLoadingLawyersFor(null);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [chat.messages]);

  const handlePickImage = async () => {
    setAttachMenuVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos', 'Necesitamos acceso a tu galería para adjuntar imágenes.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAttachments((prev) => [
        ...prev,
        { uri: asset.uri, name: asset.fileName ?? 'imagen.jpg', type: 'image', mimeType: asset.mimeType ?? 'image/jpeg' },
      ]);
    }
  };

  const handlePickDocument = async () => {
    setAttachMenuVisible(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAttachments((prev) => [
        ...prev,
        { uri: asset.uri, name: asset.name, type: 'document', mimeType: asset.mimeType ?? 'application/octet-stream' },
      ]);
    }
  };

  const handleSend = () => {
    const text = inputText.trim();
    if ((!text && attachments.length === 0) || chat.sending) return;
    setInputText('');
    setAttachments([]);
    void chat.sendMessage(text, attachments);
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
          style={[styles.avatar, isUser ? styles.avatarUser : styles.avatarAi]}
        >
          <Ionicons
            name={isUser ? 'person' : 'hardware-chip'}
            size={20}
            color={isUser ? colors.chatSurface : colors.chatSecondary}
          />
        </View>
        <View
          style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}
        >
          <View style={[styles.bubble, isUser && styles.bubbleUser]}>
            {msg.caseType && (
              <View style={styles.caseBadge}>
                <Text style={styles.caseBadgeText}>
                  CASO DETECTADO: {msg.caseType}
                </Text>
              </View>
            )}
            {isUser ? (
              msg.content ? (
                <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
                  {msg.content}
                </Text>
              ) : null
            ) : (
              <ChatMarkdownText
                baseStyle={styles.bubbleText}
                boldStyle={{ fontWeight: '700' }}
              >
                {msg.content}
              </ChatMarkdownText>
            )}
            {msg.attachments && msg.attachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                {msg.attachments.map((att) =>
                  att.mimeType?.startsWith('image/') && att.signedUrl ? (
                    <Image
                      key={att.id}
                      source={{ uri: att.signedUrl }}
                      style={styles.attachmentImage}
                      resizeMode='cover'
                    />
                  ) : (
                    <View key={att.id} style={styles.attachmentDocChip}>
                      <Ionicons name='document' size={14} color={isUser ? colors.chatSurface : colors.chatSecondary} />
                      <Text style={[styles.attachmentDocName, isUser && styles.attachmentDocNameUser]}>
                        {att.fileName}
                      </Text>
                    </View>
                  )
                )}
              </View>
            )}
            {msg.showActions && msg.caseType && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => fetchLawyers(msg.id, msg.caseType!)}
                  disabled={loadingLawyersFor === msg.id}
                >
                  {loadingLawyersFor === msg.id ? (
                    <ActivityIndicator
                      size='small'
                      color={colors.chatSecondary}
                    />
                  ) : (
                    <Ionicons
                      name='people'
                      size={16}
                      color={colors.chatSecondary}
                    />
                  )}
                  <Text style={styles.actionText}>
                    {loadingLawyersFor === msg.id
                      ? 'Buscando...'
                      : 'VER ABOGADOS'}
                  </Text>
                </TouchableOpacity>
                {/* TODO: VER ARTÍCULOS — sin funcionalidad implementada */}
                {/* <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="document-text" size={16} color={colors.chatSecondary} />
                  <Text style={styles.actionText}>VER ARTÍCULOS</Text>
                </TouchableOpacity> */}
                {/* TODO: ESTIMAR MONTO — sin funcionalidad implementada */}
                {/* <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="calculator" size={16} color={colors.chatSecondary} />
                  <Text style={styles.actionText}>ESTIMAR MONTO</Text>
                </TouchableOpacity> */}
              </View>
            )}
            {msg.showActions &&
              msg.caseType &&
              lawyersByMessage[msg.id] !== undefined && (
                <View style={styles.lawyerList}>
                  <Text style={styles.lawyerListTitle}>
                    Abogados en {msg.caseType}
                  </Text>
                  {lawyersByMessage[msg.id].length === 0 ? (
                    <Text style={styles.lawyerEmpty}>
                      No hay abogados en esta área por el momento. Prueba otra
                      categoría.
                    </Text>
                  ) : (
                    lawyersByMessage[msg.id].map((lawyer) => (
                      <View key={lawyer.id} style={styles.lawyerCard}>
                        <View style={styles.lawyerAvatar}>
                          <Ionicons
                            name='person'
                            size={24}
                            color={colors.chatSecondary}
                          />
                        </View>
                        <View style={styles.lawyerInfo}>
                          <View style={styles.lawyerNameRow}>
                            <Text style={styles.lawyerName}>
                              {lawyer.full_name || 'Abogado'}
                            </Text>
                            {lawyer.is_verified && (
                              <Ionicons
                                name='checkmark-circle'
                                size={14}
                                color={colors.chatSecondary}
                              />
                            )}
                          </View>
                          <Text style={styles.lawyerSpecialty}>
                            {lawyer.specialty || msg.caseType}
                          </Text>
                          {lawyer.phone && (
                            <Text style={styles.lawyerPhone}>
                              {lawyer.phone}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.lawyerContact,
                            contactChecking && styles.lawyerContactDisabled,
                          ]}
                          onPress={() => void contactLawyer(lawyer)}
                          disabled={contactChecking}
                          accessibilityRole='button'
                          accessibilityLabel={`Contactar a ${
                            lawyer.full_name || 'abogado'
                          }`}
                        >
                          {contactChecking ? (
                            <ActivityIndicator
                              size='small'
                              color={colors.chatSurface}
                            />
                          ) : (
                            <Text style={styles.lawyerContactText}>
                              Contactar
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}
          </View>
          <Text
            style={[styles.messageFooter, isUser && styles.messageFooterUser]}
          >
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
            accessibilityLabel='Menú del panel de cliente'
          >
            <Ionicons name='menu' size={26} color={colors.chatPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Logo size='small' />
          </View>
          <View style={styles.headerRight}>
            {activeTab === 'chat' && (
              <TouchableOpacity
                onPress={() => setConvListVisible(true)}
                hitSlop={10}
                accessibilityLabel='Ver conversaciones'
              >
                <Ionicons
                  name='chatbubbles-outline'
                  size={24}
                  color={colors.chatPrimary}
                />
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
              accessibilityLabel='Ir a perfil'
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <Ionicons name='person' size={20} color={colors.chatOutline} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={menuVisible}
          animationType='fade'
          transparent
          onRequestClose={() => setMenuVisible(false)}
        >
          <View style={styles.menuBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setMenuVisible(false)}
            />
            <View style={styles.menuSheetWrap}>
              <View style={styles.menuSheet}>
                <Text style={styles.menuTitle}>Panel de cliente</Text>
                <Text style={styles.menuSubtitle}>
                  Accede a cualquier sección sin pasar por el chat con la IA.
                </Text>

                <TouchableOpacity
                  style={[
                    styles.menuRow,
                    activeTab === 'chat' && styles.menuRowActive,
                  ]}
                  onPress={() => goToTab('chat')}
                >
                  <Ionicons
                    name='chatbubbles-outline'
                    size={22}
                    color={colors.chatSecondary}
                  />
                  <Text style={styles.menuRowText}>Chat con LÉGALO AI</Text>
                  <Ionicons
                    name='chevron-forward'
                    size={18}
                    color={colors.chatOutline}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuRow,
                    styles.menuRowMultiline,
                    activeTab === 'directorio' && styles.menuRowActive,
                  ]}
                  onPress={() => goToTab('directorio')}
                >
                  <Ionicons
                    name='people'
                    size={22}
                    color={colors.chatSecondary}
                    style={styles.menuRowIconTop}
                  />
                  <View style={styles.menuRowTextBlock}>
                    <Text style={styles.menuRowTextTitle}>
                      Directorio de abogados
                    </Text>
                    <Text style={styles.menuRowHint}>
                      Busca y elige un abogado por tu cuenta
                    </Text>
                  </View>
                  <Ionicons
                    name='chevron-forward'
                    size={18}
                    color={colors.chatOutline}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuRow,
                    activeTab === 'casos' && styles.menuRowActive,
                  ]}
                  onPress={() => goToTab('casos')}
                >
                  <Ionicons
                    name='folder-open-outline'
                    size={22}
                    color={colors.chatSecondary}
                  />
                  <Text style={styles.menuRowText}>Mis casos</Text>
                  <Ionicons
                    name='chevron-forward'
                    size={18}
                    color={colors.chatOutline}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuRow,
                    activeTab === 'pagos' && styles.menuRowActive,
                  ]}
                  onPress={() => goToTab('pagos')}
                >
                  <Ionicons
                    name='card-outline'
                    size={22}
                    color={colors.chatSecondary}
                  />
                  <Text style={styles.menuRowText}>Pagos</Text>
                  <Ionicons
                    name='chevron-forward'
                    size={18}
                    color={colors.chatOutline}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuRow,
                    activeTab === 'perfil' && styles.menuRowActive,
                  ]}
                  onPress={() => goToTab('perfil')}
                >
                  <Ionicons
                    name='person-circle-outline'
                    size={22}
                    color={colors.chatSecondary}
                  />
                  <Text style={styles.menuRowText}>Mi perfil</Text>
                  <Ionicons
                    name='chevron-forward'
                    size={18}
                    color={colors.chatOutline}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuClose}
                  onPress={() => setMenuVisible(false)}
                >
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
            keyboardShouldPersistTaps='handled'
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            {/* Hero */}
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>ASISTENCIA JURÍDICA DIGITAL</Text>
              <Text style={styles.heroTitle}>Consulta Inteligente</Text>
              <Text style={styles.heroDesc}>
                Analizamos su situación bajo el marco legal de la República
                Bolivariana de Venezuela en tiempo real.
              </Text>
              <TouchableOpacity
                style={styles.heroDirectoryBtn}
                onPress={() => setActiveTab('directorio')}
                activeOpacity={0.88}
              >
                <Ionicons name='people' size={20} color={colors.chatSurface} />
                <Text style={styles.heroDirectoryBtnText}>
                  Buscar abogado en el directorio
                </Text>
              </TouchableOpacity>
              <Text style={styles.heroDirectoryHint}>
                No necesitas usar el chat: explora y elige un abogado cuando
                quieras.
              </Text>
            </View>

            {/* Chat Messages */}
            <View style={styles.chatContainer}>
              {[WELCOME_MESSAGE, ...chat.messages].map(renderMessage)}
              {chat.sending && (
                <View style={[styles.messageRow, styles.loadingRow]}>
                  <View style={[styles.avatar, styles.avatarAi]}>
                    <Ionicons
                      name='hardware-chip'
                      size={20}
                      color={colors.chatSecondary}
                    />
                  </View>
                  <View style={[styles.bubble, styles.loadingBubble]}>
                    <ActivityIndicator
                      size='small'
                      color={colors.chatSecondary}
                    />
                    <Text style={styles.loadingText}>
                      LÉGALO AI está analizando...
                    </Text>
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
                  (await getFirstActiveCaseTitleForLawyer(clientId, l.id)) ??
                  'Mi caso';
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
            <Text style={styles.placeholderText}>
              Inicia sesión para ver esta sección.
            </Text>
          </View>
        )}

        {/* Input Area */}
        {activeTab === 'chat' && (
          <View style={styles.inputWrapper}>
            <View style={styles.inputBar}>
              {attachments.length > 0 && (
                <View style={styles.attachmentPreview}>
                  {attachments.map((att, i) => (
                    <View key={i} style={styles.attachmentChip}>
                      <Ionicons
                        name={att.type === 'image' ? 'image-outline' : 'document-outline'}
                        size={14}
                        color={colors.chatSecondary}
                      />
                      <Text style={styles.attachmentChipText} numberOfLines={1}>
                        {att.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setAttachments((prev) => prev.filter((_, j) => j !== i))
                        }
                        hitSlop={6}
                      >
                        <Ionicons name='close-circle' size={16} color={colors.chatOutline} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TextInput
                style={styles.input}
                placeholder='Escriba su consulta legal aquí...'
                placeholderTextColor={colors.chatOutline + '99'}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />
              <View style={styles.inputActions}>
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={() => setAttachMenuVisible(true)}
                >
                  <Ionicons name='attach' size={22} color={colors.chatOutline} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    chat.sending && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={chat.sending}
                >
                  <Ionicons name='send' size={20} color={colors.chatSurface} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Attach Options Sheet */}
        <Modal
          visible={attachMenuVisible}
          animationType='slide'
          transparent
          onRequestClose={() => setAttachMenuVisible(false)}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, styles.attachBackdrop]}
            onPress={() => setAttachMenuVisible(false)}
          />
          <View style={styles.attachSheet}>
            <TouchableOpacity
              style={styles.attachOption}
              onPress={() => void handlePickImage()}
            >
              <Ionicons name='image-outline' size={22} color={colors.chatSecondary} />
              <Text style={styles.attachOptionText}>Imagen o foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachOption}
              onPress={() => void handlePickDocument()}
            >
              <Ionicons name='document-outline' size={22} color={colors.chatSecondary} />
              <Text style={styles.attachOptionText}>Documento</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.attachCancel}
              onPress={() => setAttachMenuVisible(false)}
            >
              <Text style={styles.attachCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Modal>
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
    backgroundColor: '#FFFFFF',
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
    justifyContent: 'center',
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
    paddingBottom: 36,
    backgroundColor: colors.chatSurface + 'E6',
  },
  inputBar: {
    flexDirection: 'column',
    backgroundColor: colors.chatSurface,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    shadowColor: colors.chatPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '4D',
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachButton: {
    padding: 4,
  },
  input: {
    fontSize: 14,
    color: colors.chatOnSurface,
    paddingVertical: 4,
    minHeight: 36,
    maxHeight: 120,
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

  attachmentPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.chatSecondaryContainer,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 200,
    borderWidth: 1,
    borderColor: colors.chatSecondary + '33',
  },
  attachmentChipText: {
    flex: 1,
    fontSize: 12,
    color: colors.chatSecondary,
    fontWeight: '600',
  },

  attachmentsContainer: {
    marginTop: 6,
    gap: 6,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  attachmentDocChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  attachmentDocName: {
    fontSize: 12,
    color: colors.chatSecondary,
    maxWidth: 180,
  },
  attachmentDocNameUser: {
    color: colors.chatSurface,
  },

  attachBackdrop: {
    backgroundColor: '#00000066',
  },
  attachSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.chatSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 4,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  attachOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.chatOnSurface,
  },
  attachCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.chatOutlineVariant + '33',
  },
  attachCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.chatOutline,
  },
});
