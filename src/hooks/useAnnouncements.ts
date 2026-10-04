import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

export interface Announcement {
  Id: string;
  Title: string;
  Body: string;
  /** all | trainers | instructors | department | course */
  Audience: string;
  AudienceDetail: string | null;
  /** Set when Audience is "course". */
  CourseId: string | null;
  /** Current title of CourseId; null when there is none or the course was deleted. */
  CourseTitle: string | null;
  Pinned: boolean;
  AuthorId: string | null;
  /** Author's name as recorded when posted; null when it was never recorded. */
  AuthorName: string | null;
  CreatedAt: string;
}

export interface AnnouncementSave {
  Title: string;
  Body: string;
  /** all | trainers | instructors | department | course */
  Audience: string;
  AudienceDetail?: string;
  /** Required when Audience is "course" (instructors may only post to their own courses). */
  CourseId?: string;
}

export const announcementKeys = {
  list: (userId?: string) => ['announcements', userId] as const,
};

/** Announcements addressed to the signed-in user (pinned first), already scoped server-side. */
export const useAnnouncementsQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: announcementKeys.list(user?.Id),
    queryFn: async () => (await api.get<Announcement[]>('/Announcements')).data,
    enabled: !!user,
  });
};

const useInvalidateAnnouncements = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: announcementKeys.list(user?.Id) });
};

export const useCreateAnnouncement = () => {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: async (body: AnnouncementSave) => (await api.post<Announcement>('/Announcements', body)).data,
    onSuccess: invalidate,
  });
};

export const useSetAnnouncementPinned = () => {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await api.put(`/Announcements/${id}/pin`, { Pinned: pinned });
    },
    onSuccess: invalidate,
  });
};

export const useDeleteAnnouncement = () => {
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/Announcements/${id}`);
    },
    onSuccess: invalidate,
  });
};
