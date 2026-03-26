import { useCallback, useEffect, useState } from 'react';
import {
  countUnreadLawyerNotifications,
  fetchLawyerNotifications,
  markAllLawyerNotificationsRead,
  markLawyerNotificationRead,
  type LawyerNotificationRow,
} from '../lib/lawyerNotifications';

export function useLawyerNotifications(lawyerId: string | undefined) {
  const [items, setItems] = useState<LawyerNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!lawyerId) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        fetchLawyerNotifications(lawyerId),
        countUnreadLawyerNotifications(lawyerId),
      ]);
      setItems(list);
      setUnreadCount(count);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [lawyerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      if (!lawyerId) return;
      await markLawyerNotificationRead(id, lawyerId);
      await refresh();
    },
    [lawyerId, refresh]
  );

  const markAllRead = useCallback(async () => {
    if (!lawyerId) return;
    await markAllLawyerNotificationsRead(lawyerId);
    await refresh();
  }, [lawyerId, refresh]);

  return { items, unreadCount, loading, refresh, markRead, markAllRead };
}
