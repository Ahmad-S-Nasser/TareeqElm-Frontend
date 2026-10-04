/**
 * Cross-tenant Organization CRUD (`organizations.manage`, Admin only) — the first UI over OrganizationsAdminController.
 *
 *   GET  /api/organizations                 -> OrganizationAdminDto[] (sorted by name)
 *   GET  /api/organizations/{id}
 *   POST /api/organizations                 { Name, Slug?, LogoUrl?, ContactEmail?, Kind? }   -> 200 OrganizationAdminDto
 *   PUT  /api/organizations/{id}            same body                                         -> 200 OrganizationAdminDto
 *   PUT  /api/organizations/{id}/active     { IsActive }                                      -> 204
 *
 * `Kind` decides which features a tenant gets: only `School` turns on academic years and grades. The legacy
 * organization (IsLegacy) can never be suspended — the API answers 403.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** `OrganizationKind` (mirror of Nafea.Domain/Enums/OrganizationKind.cs). */
export const ORGANIZATION_KINDS = ['Company', 'Organization', 'School'] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

/** `OrganizationAdminDto` (mirror of Nafea.Application/DTOs/OrganizationDtos.cs). */
export interface OrganizationAdminDto {
  Id: string;
  Name: string;
  Slug: string | null;
  LogoUrl: string | null;
  ContactEmail: string | null;
  IsActive: boolean;
  IsLegacy: boolean;
  Kind: OrganizationKind;
  CreatedAt: string;
  /** Admin's direct seat-cap override (catalog v12 phase 4); null = uncapped. Independent of any purchased package. */
  TraineeCap: number | null;
  /** Display label only ("Package 1", "Negotiated", ...); enforcement reads only TraineeCap. */
  PackageTier: string | null;
}

/** `OrganizationSaveDto`. Blank optional fields are sent as `undefined` (absent = unchanged on update). */
export interface OrganizationSaveInput {
  Name: string;
  Slug?: string;
  LogoUrl?: string;
  ContactEmail?: string;
  Kind: OrganizationKind;
  /** Omitted = unchanged; there is no way to clear it back to uncapped through this endpoint. */
  TraineeCap?: number;
  PackageTier?: string;
}

export const organizationAdminKeys = {
  all: ['organizations-admin'] as const,
  list: () => ['organizations-admin', 'list'] as const,
};

/** `GET /api/organizations` — every tenant on the platform. */
export const useOrganizationsAdminQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: organizationAdminKeys.list(),
    queryFn: async () => (await api.get<OrganizationAdminDto[]>('/organizations')).data,
    enabled: !!user,
  });
};

const body = (input: OrganizationSaveInput) => ({
  Name: input.Name.trim(),
  Slug: input.Slug?.trim() || undefined,
  LogoUrl: input.LogoUrl?.trim() || undefined,
  ContactEmail: input.ContactEmail?.trim() || undefined,
  Kind: input.Kind,
  TraineeCap: input.TraineeCap,
  PackageTier: input.PackageTier?.trim() || undefined,
});

/** Create (no id) or update (with id) an organization; the list is re-read either way. */
export const useSaveOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: OrganizationSaveInput }) => {
      const res = id
        ? await api.put<OrganizationAdminDto>(`/organizations/${id}`, body(input))
        : await api.post<OrganizationAdminDto>('/organizations', body(input));
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationAdminKeys.all });
      // A kind change turns academic structure on/off for that tenant.
      void queryClient.invalidateQueries({ queryKey: ['organization-profile'] });
    },
  });
};

/** `PUT /api/organizations/{id}/active` — suspend or reactivate a tenant. */
export const useSetOrganizationActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.put(`/organizations/${id}/active`, { IsActive: isActive });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: organizationAdminKeys.all }),
  });
};
