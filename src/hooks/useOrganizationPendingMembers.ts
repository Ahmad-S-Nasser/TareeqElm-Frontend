/**
 * Trainees who requested to join without a join code (`pending-members.manage`).
 *
 *   GET  /api/Organization/pending-members                   -> PendingMemberDto[]
 *   POST /api/Organization/pending-members/{id}/approve       -> 204
 *   POST /api/Organization/pending-members/{id}/reject        -> 204 (deletes the pending account; it never had real access)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface PendingMemberDto {
  Id: string;
  FullName: string;
  Email: string;
  RequestedAt: string;
}

const QUERY_KEY = ['organization-pending-members'];

export const usePendingMembersQuery = () =>
  useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await api.get<PendingMemberDto[]>('/Organization/pending-members')).data,
  });

export const useApprovePendingMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.post(`/Organization/pending-members/${id}/approve`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useRejectPendingMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.post(`/Organization/pending-members/${id}/reject`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};
