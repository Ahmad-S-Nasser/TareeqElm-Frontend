import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

export interface DiscussionThread {
  Id: string;
  CourseId: string;
  /** Current title of the course; null when it was deleted. */
  CourseTitle: string | null;
  Title: string;
  Body: string;
  AuthorId: string;
  /** Null when the author's account no longer exists. */
  AuthorName: string | null;
  Pinned: boolean;
  Locked: boolean;
  CreatedAt: string;
  ReplyCount: number;
}

export interface DiscussionReply {
  Id: string;
  ThreadId: string;
  AuthorId: string;
  AuthorName: string | null;
  Body: string;
  CreatedAt: string;
}

/** A thread plus its replies, oldest first. */
export interface DiscussionThreadDetail {
  Thread: DiscussionThread;
  Replies: DiscussionReply[];
}

export interface DiscussionThreadSave {
  CourseId: string;
  Title: string;
  Body: string;
}

/** Partial update: an omitted field leaves that flag as it is. */
export interface DiscussionThreadState {
  Pinned?: boolean;
  Locked?: boolean;
}

export interface DiscussionReplySave {
  Body: string;
}

export const discussionKeys = {
  list: (userId?: string, courseId?: string) => ['discussions', userId, courseId ?? 'all'] as const,
  detail: (id?: string) => ['discussion', id] as const,
};

/** GET /api/discussions?courseId= — scoped server-side (instructor: own courses; trainer: enrolled courses). */
export const useDiscussionsQuery = (courseId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: discussionKeys.list(user?.Id, courseId),
    queryFn: async () => (await api.get<DiscussionThread[]>('/Discussions', { params: courseId ? { courseId } : undefined })).data,
    enabled: !!user,
  });
};

/** GET /api/discussions/{id} — the thread plus its replies. */
export const useDiscussionQuery = (id?: string) =>
  useQuery({
    queryKey: discussionKeys.detail(id),
    queryFn: async () => (await api.get<DiscussionThreadDetail>(`/Discussions/${id}`)).data,
    enabled: !!id,
  });

const useInvalidateDiscussions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['discussions', user?.Id] });
    if (id) queryClient.invalidateQueries({ queryKey: discussionKeys.detail(id) });
  };
};

export const useCreateDiscussion = () => {
  const invalidate = useInvalidateDiscussions();
  return useMutation({
    mutationFn: async (body: DiscussionThreadSave) => (await api.post<DiscussionThread>('/Discussions', body)).data,
    onSuccess: () => invalidate(),
  });
};

export const useUpdateDiscussion = () => {
  const invalidate = useInvalidateDiscussions();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: DiscussionThreadSave }) =>
      (await api.put<DiscussionThread>(`/Discussions/${id}`, body)).data,
    onSuccess: (_data, vars) => invalidate(vars.id),
  });
};

/** PUT /api/discussions/{id}/state — pin/unpin, lock/unlock. */
export const useSetDiscussionState = () => {
  const invalidate = useInvalidateDiscussions();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: DiscussionThreadState }) =>
      (await api.put<DiscussionThread>(`/Discussions/${id}/state`, body)).data,
    onSuccess: (_data, vars) => invalidate(vars.id),
  });
};

export const useDeleteDiscussion = () => {
  const invalidate = useInvalidateDiscussions();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/Discussions/${id}`);
    },
    onSuccess: () => invalidate(),
  });
};

/** POST /api/discussions/{id}/replies (discussions.manage or discussions.participate). */
export const useReplyToDiscussion = () => {
  const invalidate = useInvalidateDiscussions();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: DiscussionReplySave }) =>
      (await api.post<DiscussionReply>(`/Discussions/${id}/replies`, body)).data,
    onSuccess: (_data, vars) => invalidate(vars.id),
  });
};

/** DELETE /api/discussions/{id}/replies/{replyId} — the reply's own author, the course instructor, or Admin/Organization. */
export const useDeleteDiscussionReply = () => {
  const invalidate = useInvalidateDiscussions();
  return useMutation({
    mutationFn: async ({ id, replyId }: { id: string; replyId: string }) => {
      await api.delete(`/Discussions/${id}/replies/${replyId}`);
    },
    onSuccess: (_data, vars) => invalidate(vars.id),
  });
};
