import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { relativeTimeEs } from '../../lib/format';
import type { ClientNotificationRow, ClientNotificationType } from '../../lib/clientNotifications';
import { styles } from './styles';

function iconForType(t: ClientNotificationType): keyof typeof Ionicons.glyphMap {
  switch (t) {
    case 'payment_approved':
      return 'checkmark-circle';
    case 'payment_rejected':
      return 'close-circle';
    case 'connection_coupon':
      return 'ticket';
    case 'case_accepted':
      return 'briefcase';
    case 'case_rejected':
      return 'alert-circle';
    default:
      return 'notifications';
  }
}

export default function ClientNotificationsModal({
  visible,
  onClose,
  items,
  loading,
  onMarkRead,
  onMarkAllRead,
}: {
  visible: boolean;
  onClose: () => void;
  items: ClientNotificationRow[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="close" size={26} color={colors.chatPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          {unread > 0 ? (
            <TouchableOpacity onPress={() => void onMarkAllRead()} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Marcar leídas</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn} />
          )}
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.chatSecondary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.chatOutline} />
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptySub}>
              Te avisaremos cuando se apruebe tu pago, cuando el abogado responda a tu caso o cuando
              tengas un cupón de conexión.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const read = !!item.read_at;
              return (
                <TouchableOpacity
                  style={[styles.row, !read && styles.rowUnread]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (!read) void onMarkRead(item.id);
                  }}
                >
                  <View style={[styles.iconWrap, !read && styles.iconWrapUnread]}>
                    <Ionicons name={iconForType(item.type)} size={22} color={colors.chatSecondary} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, !read && styles.rowTitleBold]}>{item.title}</Text>
                    {item.body ? <Text style={styles.rowBodyText}>{item.body}</Text> : null}
                    <Text style={styles.rowTime}>{relativeTimeEs(item.created_at)}</Text>
                  </View>
                  {!read ? <View style={styles.dot} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
