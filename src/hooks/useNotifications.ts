import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** The caller's own notification inbox item (GET /api/notifications). */
export interface NotificationItem {
  Id: string;
  /** announcement | flashcards_due | streak_risk | course_completed | new_trainer | trainer_completed | at_risk |
   *  assignment_created | assignment_due_soon | submission_received | assignment_graded | discussion_reply |
   *  deck_published | enrollment_status (see backend NotificationTypes) */
  Type: string;
  /** i18n key ("notification.<type>.title") in the `notifications` namespace; interpolate with Args. */
  TitleKey: string;
  BodyKey: string;
  /** Named template arguments; they already contain resolved names (trainerName, courseTitle...). */
  Args: Record<string, string>;
  LinkUrl: string | null;
  Read: boolean;
  ReadAt: string | null;
  CreatedAt: string;
}

export const notificationKeys = {
  list: (userId?: string, unread?: boolean) => ['notifications', userId, unread ?? 'all'] as const,
  unreadCount: (userId?: string) => ['notifications-unread-count', userId] as const,
};

export const useNotificationsQuery = (unread?: boolean) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.list(user?.Id, unread),
    queryFn: async () =>
      (await api.get<NotificationItem[]>('/Notifications', { params: { unread, page: 1, pageSize: 50 } })).data,
    enabled: !!user,
  });
};

export const useUnreadCountQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.unreadCount(user?.Id),
    queryFn: async () => (await api.get<{ Count: number }>('/Notifications/unread-count')).data.Count,
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
};

const useInvalidateNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['notifications', user?.Id] });
    queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(user?.Id) });
  };
};

export const useMarkNotificationRead = () => {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/Notifications/${id}/read`);
    },
    onSuccess: invalidate,
  });
};

export const useMarkAllNotificationsRead = () => {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async () => {
      await api.post('/Notifications/read-all');
    },
    onSuccess: invalidate,
  });
};

export const useDeleteNotification = () => {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/Notifications/${id}`);
    },
    onSuccess: invalidate,
  });
};

/** Localizes a notification's title/body via its TitleKey/BodyKey + Args (the `notifications` namespace). */
export const useNotificationText = () => {
  const { t } = useTranslation('notifications');
  return (n: Pick<NotificationItem, 'TitleKey' | 'BodyKey' | 'Args'>) => ({
    title: t(n.TitleKey, n.Args),
    body: t(n.BodyKey, n.Args),
  });
};
