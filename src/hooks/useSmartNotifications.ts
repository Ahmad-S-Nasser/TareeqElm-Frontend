import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useUnreadCountQuery } from './useNotifications';

/**
 * Thin wrapper kept for call sites that only need the unread badge count and the browser push-permission
 * toggle. The notification content itself is real now (GET /api/notifications via useNotifications.ts);
 * this hook used to compute six client-side rules from raw stats — that logic moved to the backend's
 * NotificationScanner background job.
 */
export const useSmartNotifications = () => {
  const { user } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setPushEnabled(granted);
    return granted;
  }, []);

  const unreadCountQuery = useUnreadCountQuery();

  return {
    unreadCount: user ? unreadCountQuery.data ?? 0 : 0,
    loading: unreadCountQuery.isLoading,
    pushEnabled,
    requestPushPermission,
  };
};
