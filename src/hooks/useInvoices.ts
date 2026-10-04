/**
 * Organization invoices and the organization's billing profile (monetization plan, Phase 1).
 *
 *   GET /api/organization/invoices?status=&from=&to=&search=&page=&pageSize=   (invoices.view, X-Total-Count)
 *   GET /api/organization/invoices/{id}                                         (invoices.view)
 *   GET /api/Organization/billing-profile                                       (organization.view; 204 for Admin)
 *   PUT /api/Organization/billing-profile                                       (settings.manage)
 *
 * Same conventions as ./useAdminOrders.ts: no money is computed here (every figure is the invoice's own snapshot),
 * blank filters are dropped from the query string, and the list keeps the previous page while the next one loads.
 * Cache keys live under `billingKeys.all`, so a billing-wide invalidation after a purchase or refund reaches them too.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type Money } from './useBilling';

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/InvoiceDtos.cs)
// ---------------------------------------------------------------------------

export const INVOICE_STATUSES = ['Issued', 'Voided'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** `InvoiceListDto` — one row of the invoice list. */
export interface InvoiceListDto {
  Id: string;
  InvoiceNumber: string;
  IssuedAt: string;
  /** The buyer's name as printed on the invoice; never rewritten by a later rename. */
  BuyerNameSnapshot: string;
  Currency: string;
  Total: Money;
  Status: InvoiceStatus | string;
  /** The order's CURRENT refunded amount, read live — the invoice's own Total above never changes after issuance. 0 when
   * the order has never been refunded. */
  RefundedAmount: Money;
  /** The order's current status (Paid | PartiallyRefunded | Refunded | ...), read live — distinct from Status above,
   * which is the invoice's own Issued/Voided state. */
  OrderStatus: string | null;
}

/** `InvoiceLineItemDto` — one invoice line, frozen at issue time. */
export interface InvoiceLineItemDto {
  TitleSnapshot: string;
  UnitAmount: Money;
  DiscountAmount: Money;
  LineTotal: Money;
}

/** `InvoiceDetailDto` — the full invoice document. */
export interface InvoiceDetailDto {
  Id: string;
  OrganizationId: string;
  OrderId: string;
  InvoiceNumber: string;
  IssuedAt: string;
  BuyerId: string;
  BuyerNameSnapshot: string;
  BuyerBillingSnapshot: string | null;
  SellerLegalNameSnapshot: string;
  SellerAddressSnapshot: string | null;
  SellerTaxIdSnapshot: string | null;
  Currency: string;
  LineItems: InvoiceLineItemDto[];
  Subtotal: Money;
  DiscountAmount: Money;
  /** Null = the organization charged no tax; the document then prints no tax line at all. */
  TaxRatePercentSnapshot: number | null;
  TaxAmount: Money;
  Total: Money;
  Status: InvoiceStatus | string;
  CreatedAt: string;
  /** The order's current refunded amount, read live (see InvoiceListDto.RefundedAmount). */
  RefundedAmount: Money;
  /** The order's current status, read live (see InvoiceListDto.OrderStatus). */
  OrderStatus: string | null;
  OrganizationName: string | null;
  OrganizationLogoUrl: string | null;
  /** The buyer's current name; null once the account has been deleted. The invoice prints `BuyerNameSnapshot`. */
  BuyerName: string | null;
}

export interface InvoiceFilters {
  status?: string;
  /** Bare date or ISO-8601; the server reads a bare `to` through the end of that day. */
  from?: string;
  to?: string;
  /** Invoice number, buyer name or order id. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface InvoicesPage {
  items: InvoiceListDto[];
  total: number;
}

/** `OrganizationBillingProfileDto` — what the organization prints as the seller on new invoices. */
export interface OrganizationBillingProfileDto {
  LegalName: string | null;
  BillingAddress: string | null;
  TaxId: string | null;
  /** 0-100; null = no tax line on new invoices. */
  TaxRatePercent: number | null;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export const invoiceKeys = {
  all: [...billingKeys.all, 'organization', 'invoices'] as const,
  list: (filters: InvoiceFilters) =>
    [
      ...invoiceKeys.all,
      'list',
      filters.status ?? '',
      filters.from ?? '',
      filters.to ?? '',
      filters.search ?? '',
      filters.page ?? 1,
      filters.pageSize ?? ORGANIZATION_INVOICES_PAGE_SIZE,
    ] as const,
  detail: (id?: string) => [...invoiceKeys.all, 'detail', id ?? ''] as const,
  billingProfile: [...billingKeys.all, 'organization', 'billing-profile'] as const,
};

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export const ORGANIZATION_INVOICES_PAGE_SIZE = 20;

const invoiceParams = (filters: InvoiceFilters) => ({
  status: filters.status || undefined,
  from: filters.from || undefined,
  to: filters.to || undefined,
  search: filters.search || undefined,
  page: filters.page ?? 1,
  pageSize: filters.pageSize ?? ORGANIZATION_INVOICES_PAGE_SIZE,
});

const fetchInvoices = async (filters: InvoiceFilters): Promise<InvoicesPage> => {
  const res = await api.get<InvoiceListDto[]>('/organization/invoices', { params: invoiceParams(filters) });
  const items = Array.isArray(res.data) ? res.data : [];
  const total = Number(res.headers['x-total-count'] ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
};

/** `GET /api/organization/invoices` — the caller organization's invoices, newest first. */
export const useOrganizationInvoicesQuery = (filters: InvoiceFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => fetchInvoices(filters),
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
};

/** `GET /api/organization/invoices/{id}` — one invoice document (404 for another organization's invoice). */
export const useOrganizationInvoiceQuery = (invoiceId?: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: invoiceKeys.detail(invoiceId ?? undefined),
    queryFn: async () => (await api.get<InvoiceDetailDto>(`/organization/invoices/${invoiceId}`)).data,
    enabled: !!user && !!invoiceId,
    retry: false,
  });
};

// ---------------------------------------------------------------------------
// Billing profile
// ---------------------------------------------------------------------------

const EMPTY_PROFILE: OrganizationBillingProfileDto = {
  LegalName: null,
  BillingAddress: null,
  TaxId: null,
  TaxRatePercent: null,
};

/**
 * `GET /api/Organization/billing-profile`. An Admin (no organization) gets 204, which resolves to `null` here so the
 * form can say there is nothing to edit rather than showing an empty profile.
 */
export const useOrganizationBillingProfileQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: invoiceKeys.billingProfile,
    queryFn: async (): Promise<OrganizationBillingProfileDto | null> => {
      const res = await api.get<OrganizationBillingProfileDto | ''>('/Organization/billing-profile');
      if (res.status === 204 || !res.data) return null;
      return { ...EMPTY_PROFILE, ...res.data };
    },
    enabled: !!user,
  });
};

/** `PUT /api/Organization/billing-profile` — blank strings are sent as null, which clears the field. */
export const useUpdateOrganizationBillingProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: OrganizationBillingProfileDto) => {
      const clean = (value: string | null) => (value && value.trim() ? value.trim() : null);
      const res = await api.put<OrganizationBillingProfileDto>('/Organization/billing-profile', {
        LegalName: clean(profile.LegalName),
        BillingAddress: clean(profile.BillingAddress),
        TaxId: clean(profile.TaxId),
        TaxRatePercent: typeof profile.TaxRatePercent === 'number' ? profile.TaxRatePercent : null,
      });
      return res.data;
    },
    onSuccess: (data) => {
      // The PUT answers with the saved profile, so the cache is replaced rather than refetched.
      if (data && typeof data === 'object') queryClient.setQueryData(invoiceKeys.billingProfile, { ...EMPTY_PROFILE, ...data });
      else return queryClient.invalidateQueries({ queryKey: invoiceKeys.billingProfile });
    },
  });
};
