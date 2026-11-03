import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: { limit: 6, page: 1 } });
      setNotifications(data.items || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // The bell is a convenience layer — page-level errors surface elsewhere.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return undefined;
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, [refresh, user]);

  const markRead = useCallback(
    async (id) => {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((current) =>
        current.map((item) => {
          if (item._id !== id) return item;
          const readBy = item.readBy || [];
          if (user?._id && readBy.includes(user._id)) return item;
          return { ...item, readBy: user?._id ? [...readBy, user._id] : readBy };
        })
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    },
    [user]
  );

  const markAllRead = useCallback(async () => {
    await api.post('/notifications/read-all');
    setUnreadCount(0);
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markRead,
      markAllRead,
    }),
    [notifications, unreadCount, loading, refresh, markRead, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
};
