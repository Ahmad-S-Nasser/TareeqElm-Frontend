import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** Mirrors Nafea.Domain.Entities.NotificationTypes.All (backend catalog, notification producers). */
export const NOTIFICATION_TYPES = [
  'announcement',
  'flashcards_due',
  'streak_risk',
  'course_completed',
  'new_trainer',
  'trainer_completed',
  'at_risk',
  'assignment_created',
  'assignment_due_soon',
  'submission_received',
  'assignment_graded',
  'discussion_reply',
  'deck_published',
  'enrollment_status',
] as const;
export type NotificationTypeName = (typeof NOTIFICATION_TYPES)[number];

// ---------- Platform settings (GET/PUT /api/settings) ----------
export interface PlatformSettings {
  PlatformName: string;
  LogoUrl: string | null;
  Timezone: string;
  DefaultLanguage: string;
  AccentColor: string;
  AiEnabled: boolean;
  NotifyOnCompletion: boolean;
  NotifyOnAtRisk: boolean;
  UpdatedAt: string | null;
}

export interface PlatformSettingsUpdate {
  PlatformName?: string;
  LogoUrl?: string;
  Timezone?: string;
  DefaultLanguage?: string;
  AccentColor?: string;
  AiEnabled?: boolean;
  NotifyOnCompletion?: boolean;
  NotifyOnAtRisk?: boolean;
}

export const settingsKeys = {
  platform: ['platform-settings'] as const,
};

/** Any signed-in user may read the platform settings; only settings.manage may write them. */
export const usePlatformSettingsQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: settingsKeys.platform,
    queryFn: async () => (await api.get<PlatformSettings>('/Settings')).data,
    enabled: !!user,
  });
};

export const useUpdatePlatformSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: PlatformSettingsUpdate) => (await api.put<PlatformSettings>('/Settings', body)).data,
    onSuccess: (data) => queryClient.setQueryData(settingsKeys.platform, data),
  });
};

// ---------- The caller's own preferences (GET/PUT /api/auth/me/preferences) ----------
export interface UserPreferences {
  /** "en" | "ar" | null (follows the platform default). */
  Language: string | null;
  Timezone: string | null;
  /** Every notification type with its effective on/off state (types never touched are true). */
  Notifications: Record<string, boolean>;
  ShowOnLeaderboard: boolean;
}

export interface UserPreferencesUpdate {
  Language?: string;
  Timezone?: string;
  Notifications?: Record<string, boolean>;
  ShowOnLeaderboard?: boolean;
}

export const preferencesKeys = {
  mine: (userId?: string) => ['preferences', userId] as const,
};

export const usePreferencesQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: preferencesKeys.mine(user?.Id),
    queryFn: async () => (await api.get<UserPreferences>('/Auth/me/preferences')).data,
    enabled: !!user,
  });
};

export const useUpdatePreferences = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UserPreferencesUpdate) => (await api.put<UserPreferences>('/Auth/me/preferences', body)).data,
    onSuccess: (data) => queryClient.setQueryData(preferencesKeys.mine(user?.Id), data),
  });
};
