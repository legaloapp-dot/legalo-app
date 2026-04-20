import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { styles } from './styles';

export default function ClientNotificationBell({
  unreadCount,
  onPress,
}: {
  unreadCount: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.iconPad} hitSlop={12} onPress={onPress} accessibilityRole="button">
      <View>
        <Ionicons name="notifications-outline" size={24} color={colors.chatOutline} />
        {unreadCount > 0 ? (
          <View style={styles.notifBadge}>
            <Text style={styles.notifBadgeText}>
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
