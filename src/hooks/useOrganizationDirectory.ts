/**
 * GET /api/auth/organizations — anonymous, minimal {Id, Name}[] of active orgs, for the signup page's
 * "select my organization" picker (the request-to-join path, for someone without a join code).
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface OrganizationDirectoryEntry {
  Id: string;
  Name: string;
}

export const useOrganizationDirectoryQuery = () =>
  useQuery({
    queryKey: ['organization-directory'],
    queryFn: async () => (await api.get<OrganizationDirectoryEntry[]>('/auth/organizations')).data,
  });
