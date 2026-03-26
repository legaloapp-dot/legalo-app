import { useCallback, useEffect, useState } from 'react';
import {
  countUnreadClientNotifications,
  fetchClientNotifications,
  markAllClientNotificationsRead,
  markClientNotificationRead,
  type ClientNotificationRow,
} from '../lib/clientNotifications';

export function useClientNotifications(clientId: string | undefined) {
  const [items, setItems] = useState<ClientNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!clientId) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        fetchClientNotifications(clientId),
        countUnreadClientNotifications(clientId),
      ]);
      setItems(list);
      setUnreadCount(count);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      if (!clientId) return;
      await markClientNotificationRead(id, clientId);
      await refresh();
    },
    [clientId, refresh]
  );

  const markAllRead = useCallback(async () => {
    if (!clientId) return;
    await markAllClientNotificationsRead(clientId);
    await refresh();
  }, [clientId, refresh]);

  return { items, unreadCount, loading, refresh, markRead, markAllRead };
}
