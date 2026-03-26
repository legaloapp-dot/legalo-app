import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { relativeTimeEs } from '../lib/format';
import type { ClientNotificationRow, ClientNotificationType } from '../lib/clientNotifications';

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.chatContainer },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.chatOutlineVariant + '44',
  },
  headerBtn: { width: 72, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: colors.chatPrimary,
  },
  markAllBtn: { width: 72, alignItems: 'flex-end' },
  markAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.chatSecondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    color: colors.chatPrimary,
  },
  emptySub: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    color: colors.chatOutline,
    lineHeight: 22,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.chatSurface,
    borderWidth: 1,
    borderColor: colors.chatOutlineVariant + '44',
  },
  rowUnread: {
    backgroundColor: colors.chatPrimaryContainer,
    borderColor: colors.chatSecondary + '33',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.chatContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: colors.chatPrimaryContainer,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.chatOnSurface,
  },
  rowTitleBold: { fontWeight: '800' },
  rowBodyText: {
    marginTop: 4,
    fontSize: 13,
    color: colors.chatOutline,
    lineHeight: 18,
  },
  rowTime: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: colors.chatOutline,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.chatSecondary,
    marginTop: 6,
  },
});
