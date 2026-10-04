/**
 * Trainee-initiated refund requests. The trainee asks from their own receipt; the selling Organization (its own
 * organization's requests) or Admin (every organization's) approves or rejects. Approving runs the ordinary refund on the
 * server immediately — the direct admin refund in ./useAdminOrders.ts is a separate path and is unaffected.
 *
 *   POST /api/orders/me/{orderId}/refund-requests              (orders.self)   { Reason, Amount?, LineIds? }
 *   GET  /api/orders/me/{orderId}/refund-requests              (orders.self)   the caller's own requests for that order
 *   POST /api/orders/me/refund-requests/{id}/cancel            (orders.self)   Pending only -> 409 refund_request.not_pending
 *   GET  /api/refund-requests?status=&from=&to=&page=&pageSize= (refund-requests.manage, X-Total-Count)
 *   POST /api/refund-requests/{id}/approve                      (refund-requests.manage)  { Note? }
 *   POST /api/refund-requests/{id}/reject                       (refund-requests.manage)  { Note } (required)
 *
 * Same conventions as ./useInvoices.ts: no money is computed here beyond what a human typed, blank filters are dropped
 * from the query string, and the review list keeps the previous page while the next one loads. Cache keys live under
 * `billingKeys.all`; an approval moves orders, entitlements, earnings and revenue at once, so it invalidates all of billing.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type DateRange, type Money } from './useBilling';

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/RefundRequestDtos.cs)
// ---------------------------------------------------------------------------

export const REFUND_REQUEST_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'] as const;
export type RefundRequestStatus = (typeof REFUND_REQUEST_STATUSES)[number];

/** `RefundRequestDto` — one request, with the trainee's and the reviewer's names resolved. */
export interface RefundRequestDto {
  Id: string;
  OrderId: string;
  OrganizationId: string | null;
  UserId: string;
  /** The trainee's name; null when the account has been deleted. */
  UserName: string | null;
  LineIds: string[];
  /** Titles of the lines the request covers, as they were bought (every line when LineIds is empty). */
  ItemTitles: string[];
  /** Null = everything still refundable when it is approved. */
  RequestedAmount: Money | null;
  Currency: string;
  /** The order's total and what has already been refunded on it, read live. */
  OrderTotal: Money;
  OrderRefundedAmount: Money;
  Reason: string;
  Status: RefundRequestStatus | string;
  DecidedBy: string | null;
  DecidedByName: string | null;
  DecidedAt: string | null;
  /** Shown to the trainee: always present on a rejection, optional on an approval. */
  DecisionNote: string | null;
  /** The refund an approval produced. */
  ResultingRefundId: string | null;
  RequestedAt: string;
}

export interface RefundRequestFilters extends DateRange {
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface RefundRequestsPage {
  items: RefundRequestDto[];
  total: number;
}

export interface RequestRefundInput {
  reason: string;
  /** Omitted = everything still refundable. */
  amount?: number | null;
  lineIds?: string[];
}

export interface RefundRequestDecisionInput {
  id: string;
  /** Optional on approve; required on reject (the trainee sees it). */
  note?: string;
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export const REFUND_REQUESTS_PAGE_SIZE = 20;

export const refundRequestKeys = {
  all: [...billingKeys.all, 'refund-requests'] as const,
  mine: (userId?: string, orderId?: string) => [...refundRequestKeys.all, 'mine', userId ?? '', orderId ?? ''] as const,
  list: (filters: RefundRequestFilters) =>
    [
      ...refundRequestKeys.all,
      'list',
      filters.status ?? '',
      filters.from ?? '',
      filters.to ?? '',
      filters.page ?? 1,
      filters.pageSize ?? REFUND_REQUESTS_PAGE_SIZE,
    ] as const,
};

// ---------------------------------------------------------------------------
// Trainee side (orders.self)
// ---------------------------------------------------------------------------

/** `GET /api/orders/me/{orderId}/refund-requests` — the caller's own requests for one order, newest first. */
export const useMyRefundRequestsQuery = (orderId?: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: refundRequestKeys.mine(user?.Id, orderId ?? undefined),
    queryFn: async () => {
      const res = await api.get<RefundRequestDto[]>(`/orders/me/${orderId}/refund-requests`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!user && !!orderId,
    retry: false,
  });
};

/**
 * `POST /api/orders/me/{orderId}/refund-requests` — asks for a refund; no money moves until a reviewer approves.
 * A 409 `refund_request.already_pending` means one is already open for this order.
 */
export const useRequestRefund = (orderId?: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reason, amount, lineIds }: RequestRefundInput) =>
      (
        await api.post<RefundRequestDto>(`/orders/me/${orderId}/refund-requests`, {
          Reason: reason.trim(),
          Amount: typeof amount === 'number' ? amount : undefined,
          LineIds: lineIds && lineIds.length > 0 ? lineIds : undefined,
        })
      ).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: refundRequestKeys.all }),
  });
};

/** `POST /api/orders/me/refund-requests/{id}/cancel` — withdraws the caller's own request while it is still pending. */
export const useCancelRefundRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) =>
      (await api.post<RefundRequestDto>(`/orders/me/refund-requests/${requestId}/cancel`)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: refundRequestKeys.all }),
  });
};

// ---------------------------------------------------------------------------
// Review side (refund-requests.manage)
// ---------------------------------------------------------------------------

const requestParams = (filters: RefundRequestFilters) => ({
  status: filters.status || undefined,
  from: filters.from || undefined,
  to: filters.to || undefined,
  page: filters.page ?? 1,
  pageSize: filters.pageSize ?? REFUND_REQUESTS_PAGE_SIZE,
});

const fetchRefundRequests = async (filters: RefundRequestFilters): Promise<RefundRequestsPage> => {
  const res = await api.get<RefundRequestDto[]>('/refund-requests', { params: requestParams(filters) });
  const items = Array.isArray(res.data) ? res.data : [];
  const total = Number(res.headers['x-total-count'] ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
};

/** `GET /api/refund-requests` — Organization: its own organization's requests; Admin: every organization's. */
export const useRefundRequestsQuery = (filters: RefundRequestFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: refundRequestKeys.list(filters),
    queryFn: () => fetchRefundRequests(filters),
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
};

/**
 * `POST /api/refund-requests/{id}/approve` — the refund runs now, as the approver. When it cannot (amount above what is
 * left, provider refused, ...) the request stays Pending and the error carries the refund's own code and localized title —
 * show `getApiError(err)` as-is. Invalidates all of billing either way: a refund touches every money screen.
 */
export const useApproveRefundRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: RefundRequestDecisionInput) =>
      (await api.post<RefundRequestDto>(`/refund-requests/${id}/approve`, { Note: note?.trim() || undefined })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: billingKeys.all }),
  });
};

/** `POST /api/refund-requests/{id}/reject` — a note is required; the trainee sees it on their receipt. */
export const useRejectRefundRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: RefundRequestDecisionInput) =>
      (await api.post<RefundRequestDto>(`/refund-requests/${id}/reject`, { Note: note?.trim() || undefined })).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: refundRequestKeys.all }),
  });
};
