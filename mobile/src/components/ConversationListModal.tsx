import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { ConversationRow } from '../lib/chatConversations';

interface ConversationListModalProps {
  visible: boolean;
  onClose: () => void;
  conversations: ConversationRow[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onDelete: (id: string) => void;
  loading: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ConversationListModal({
  visible,
  onClose,
  conversations,
  activeConversationId,
  onSelect,
  onNewConversation,
  onDelete,
  loading,
}: ConversationListModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Mis Conversaciones</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.chatOutline} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newBtn} onPress={onNewConversation}>
              <Ionicons name="add-circle-outline" size={20} color={colors.chatSurface} />
              <Text style={styles.newBtnText}>Nueva Conversacion</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator size="small" color={colors.chatSecondary} style={styles.loader} />
            ) : conversations.length === 0 ? (
              <Text style={styles.empty}>No hay conversaciones anteriores.</Text>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isActive = item.id === activeConversationId;
                  return (
                    <TouchableOpacity
                      style={[styles.item, isActive && styles.itemActive]}
                      onPress={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={styles.itemIcon}>
                        <Ionicons
                          name="chatbubble-outline"
                          size={18}
                          color={isActive ? colors.chatSecondary : colors.chatOutline}
                        />
                      </View>
                      <View style={styles.itemContent}>
                        <Text
                          style={[styles.itemTitle, isActive && styles.itemTitleActive]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={styles.itemDate}>{formatDate(item.updated_at)}</Text>
                      </View>
                      <TouchableOpacity
                        hitSlop={10}
                        onPress={() => onDelete(item.id)}
                        accessibilityLabel="Eliminar conversacion"
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.chatOutline} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
  },
  sheetWrap: {
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  sheet: {
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
    maxHeight: 480,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.chatPrimary,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.chatSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  newBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.chatSurface,
  },
  loader: {
    marginTop: 16,
  },
  empty: {
    fontSize: 14,
    color: colors.chatOutline,
    textAlign: 'center',
    marginTop: 16,
  },
  list: {
    maxHeight: 320,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    backgroundColor: colors.chatSecondaryContainer,
    borderColor: colors.chatSecondary + '33',
  },
  itemIcon: {
    width: 28,
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.chatOnSurface,
  },
  itemTitleActive: {
    color: colors.chatSecondary,
  },
  itemDate: {
    fontSize: 11,
    color: colors.chatOutline,
    marginTop: 2,
  },
});
