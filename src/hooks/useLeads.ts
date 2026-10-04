/**
 * The B2B lead inbox (`leads.manage`, Admin) — the administrative half of the marketing site's
 * "bring TareeqElm to your organization" form.
 *
 *   GET /api/admin/leads?status=&organizationType=&search=&from=&to=&page=&pageSize=   (total in X-Total-Count)
 *   GET /api/admin/leads/{id}
 *   PUT /api/admin/leads/{id}/status   { Status, StatusNote? }  -> 204, audited as `lead.status.update`
 *
 * Two things shape this file:
 *
 *  1. **A lead references nothing else.** There are no ids to resolve — what the visitor typed *is* the record — so
 *     unlike the order/enrollment hooks there is no name-resolution story here, and the list row already carries every
 *     field the detail panel shows. The detail query exists anyway because it is the one read that is guaranteed
 *     fresh after a status change, and because a lead reached by id (a link, a refresh) must not depend on which page
 *     of the list happens to be cached.
 *  2. **The only write is the status.** The submission itself is never rewritten from here; `PUT .../status` answers
 *     204 with no body, so the mutation re-reads rather than patching a cache by hand. An omitted `StatusNote` keeps
 *     the existing note server-side and an explicitly empty one clears it — that distinction is preserved below
 *     (`undefined` vs `''`), so "save without touching the note" and "erase the note" stay two different actions.
 *
 * `From`/`To` follow the same rule as every other admin date filter: both inclusive, a bare date as `To` covering
 * that whole day, UTC.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** `LeadStatus` — the four states an administrator moves a lead through. */
export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** `LeadOrganizationType` — note the API spells the small-business case `Sme`, not `SME`. */
export const LEAD_ORGANIZATION_TYPES = ['Enterprise', 'University', 'School', 'Sme', 'Other'] as const;
export type LeadOrganizationType = (typeof LEAD_ORGANIZATION_TYPES)[number];

/** `LeadDto` — one lead as an administrator sees it (mirror of Nafea.Application/DTOs/LeadDtos.cs). */
export interface LeadDto {
  Id: string;
  CompanyName: string;
  ContactName: string;
  Email: string;
  Phone: string | null;
  OrganizationType: LeadOrganizationType;
  /** Free text such as "50-200" — never parsed as a number. */
  EstimatedLearners: string | null;
  Message: string | null;
  /** The language of the page the form was submitted on ("en" | "ar"). */
  Locale: string;
  /** Which page or CTA produced the lead ("join-us", "organization", ...) — free text, so it is shown as sent. */
  SourcePage: string;
  Status: LeadStatus;
  StatusNote: string | null;
  /** When the visitor submitted the form. */
  CreatedAt: string;
  /** The last status change, or the submission itself. */
  UpdatedAt: string;
}

export interface LeadFilters {
  status?: string;
  organizationType?: string;
  /** Company name, contact name or email (case-insensitive, partial). */
  search?: string;
  /** ISO-8601 or a bare date; both ends inclusive. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface LeadsPage {
  items: LeadDto[];
  total: number;
}

export const LEADS_PAGE_SIZE = 25;
/** `LeadAdminService.MaxPageSize` — the server clamps anything larger. */
export const LEADS_MAX_PAGE_SIZE = 100;

/**
 * react-query keys for the lead inbox. Leads are neither billing nor audit data, so they get their own root: nothing
 * else in the app should ever be invalidated by a status change, and nothing else should ever evict this cache.
 */
export const leadKeys = {
  all: ['leads'] as const,
  lists: () => ['leads', 'list'] as const,
  list: (filters: LeadFilters = {}) =>
    [
      'leads',
      'list',
      filters.status ?? '',
      filters.organizationType ?? '',
      filters.search ?? '',
      filters.from ?? '',
      filters.to ?? '',
      filters.page ?? 1,
      filters.pageSize ?? LEADS_PAGE_SIZE,
    ] as const,
  detail: (id?: string | null) => ['leads', 'detail', id ?? ''] as const,
};

/** Empty strings become `undefined`, so a blank filter is simply absent from the request. */
const leadParams = (filters: LeadFilters) => ({
  status: filters.status || undefined,
  organizationType: filters.organizationType || undefined,
  search: filters.search?.trim() || undefined,
  from: filters.from || undefined,
  to: filters.to || undefined,
  page: filters.page ?? 1,
  pageSize: Math.min(filters.pageSize ?? LEADS_PAGE_SIZE, LEADS_MAX_PAGE_SIZE),
});

/** `GET /api/admin/leads` — every enquiry, newest first, paged. */
export const useAdminLeadsQuery = (filters: LeadFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: leadKeys.list(filters),
    queryFn: async (): Promise<LeadsPage> => {
      const res = await api.get<LeadDto[]>('/admin/leads', { params: leadParams(filters) });
      const total = Number(res.headers['x-total-count'] ?? res.data.length);
      return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
    },
    enabled: !!user,
    // Paging or re-filtering an inbox should not blink back to a spinner.
    placeholderData: keepPreviousData,
  });
};

/** `GET /api/admin/leads/{id}` — the full lead, including the message the visitor wrote. */
export const useLeadQuery = (leadId?: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: leadKeys.detail(leadId),
    queryFn: async () => (await api.get<LeadDto>(`/admin/leads/${leadId}`)).data,
    enabled: !!user && !!leadId,
    retry: false,
  });
};

export interface UpdateLeadStatusInput {
  id: string;
  status: LeadStatus;
  /**
   * Leave `undefined` to keep the note the lead already carries; pass `''` to clear it. Anything else replaces it.
   */
  statusNote?: string;
}

/**
 * `PUT /api/admin/leads/{id}/status` — moves a lead along the pipeline (204, audited as `lead.status.update`).
 *
 * Both the list and that lead's detail are invalidated: the row's badge, its `UpdatedAt` and the note in the open
 * panel all change at once, and the server owns every one of those values.
 */
export const useUpdateLeadStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, statusNote }: UpdateLeadStatusInput) => {
      await api.put(`/admin/leads/${id}/status`, {
        Status: status,
        // `undefined` is dropped by JSON serialization, which is exactly how "keep the existing note" is expressed.
        StatusNote: statusNote,
      });
      return { id, status };
    },
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: leadKeys.detail(id) });
    },
  });
};
