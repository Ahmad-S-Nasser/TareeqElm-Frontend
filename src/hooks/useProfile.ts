import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

export interface Profile {
  Id: string;
  FullName: string;
  Email: string;
  Role: string;
  AvatarUrl?: string | null;
}

export const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
};

export const initials = (fullName: string) =>
  fullName.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

/** Profile of the signed-in user (GET /Auth/me), plus mutations for saving it and changing the password. */
export const useProfile = () => {
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();

  const query = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get<Profile>('/Auth/me')).data,
  });

  const saveProfile = useMutation({
    mutationFn: async (body: { FullName?: string; AvatarUrl?: string }) =>
      (await api.put<Profile>('/Auth/me', body)).data,
    onSuccess: (profile) => {
      queryClient.setQueryData(['profile'], profile);
      // Update the signed-in user so the header shows the new name straight away.
      updateUser({ FullName: profile.FullName, AvatarUrl: profile.AvatarUrl });
    },
  });

  const changePassword = useMutation({
    mutationFn: async (body: { CurrentPassword: string; NewPassword: string }) => {
      await api.put('/Auth/me/password', body);
    },
  });

  return { ...query, saveProfile, changePassword };
};
