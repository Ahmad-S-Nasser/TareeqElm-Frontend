/**
 * Administrative order and refund operations (plan §5.4 "Admin/Organization money ops", wave F2b).
 *
 *   GET  /api/admin/orders?status=&userId=&provider=&itemId=&from=&to=&search=&page=&pageSize=
 *   GET  /api/admin/orders/export   (same filters, as a CSV file)
 *   GET  /api/admin/orders/{id}
 *   POST /api/admin/orders/{id}/mark-paid   (orders.manage, manual-capture providers only)
 *   POST /api/admin/orders/{id}/reapply     (orders.manage, repairs a Paid order's grants)
 *   POST /api/admin/orders/{id}/refund      (refunds.manage)
 *   GET  /api/admin/refunds?status=&from=&to=&page=&pageSize=
 *
 * Three rules this file obeys:
 *  1. **No money is computed here.** `RefundableAmount`, `LineTotal` and the rest come off the server's DTO; the
 *     client only displays them and sends back an amount a human typed.
 *  2. **Every cache key comes from `billingKeys`** (@/hooks/useBilling). A refund touches orders, entitlements,
 *     earnings, payouts *and* revenue at once, so mutations invalidate `billingKeys.all` rather than guessing.
 *  3. **An idempotency key is generated once per refund attempt**, with the very same `newIdempotencyKey` helper the
 *     trainer checkout uses (@/hooks/useCheckout), so a double-click, a retry after a timeout or a re-submitted form
 *     returns the first refund (`Replayed: true`) instead of giving the money back twice.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type DateRange, type Money, type OrderStatus, type PurchasableItemType, type RefundKind, type RefundStatus } from './useBilling';
import { newIdempotencyKey } from './useCheckout';

/** Re-exported so an admin screen never has to reach into the checkout hook for it. */
export { newIdempotencyKey };

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/OrderAdminDtos.cs)
// ---------------------------------------------------------------------------

/** `AdminOrderItemDto` — one order line, with every id resolved to the name it has *now* beside the bought title. */
export interface AdminOrderItemDto {
  LineId: string;
  ItemType: PurchasableItemType;
  ItemId: string;
  /** What the item was called when it was bought. This never changes — it is what the buyer actually paid for. */
  Title: string;
  /** The item's title right now; null once it has been deleted. */
  ResolvedTitle: string | null;
  CourseId: string | null;
  CourseTitle: string | null;
  InstructorId: string | null;
  InstructorName: string | null;
  UnitAmount: Money;
  DiscountAmount: Money;
  LineTotal: Money;
  RefundedAmount: Money;
  /** What is still refundable on this line — the only number a partial refund may be checked against. */
  RefundableAmount: Money;
}

/** `AdminOrderDto` — one order as an administrator sees it. */
export interface AdminOrderDto {
  Id: string;
  UserId: string;
  /** The buyer's name; null when the account has been deleted. */
  BuyerName: string | null;
  Status: OrderStatus;
  /** Provider name ("mock", "manual", ...). */
  Provider: string;
  ProviderRef: string;
  /** True when this order's provider is captured by hand — i.e. when "mark paid" applies to it at all. */
  SupportsManualCapture: boolean;
  Currency: string;
  Subtotal: Money;
  DiscountAmount: Money;
  TaxAmount: Money;
  Total: Money;
  RefundedAmount: Money;
  /** Total minus what has already been refunded. */
  RefundableAmount: Money;
  CouponCode: string | null;
  PlacedAt: string;
  PaidAt: string | null;
  CancelledAt: string | null;
  FailedAt: string | null;
  FailureReason: string | null;
  MarkedPaidBy: string | null;
  MarkedPaidByName: string | null;
  PaymentReference: string | null;
  Notes: string | null;
  /** When the no-questions-asked refund window closes; null while unpaid. */
  RefundWindowEndsAt: string | null;
  /** False once the window has closed — a refund is still possible but then always needs a reason. */
  WithinRefundWindow: boolean;
  Items: AdminOrderItemDto[];
}

/** Filters of `GET /api/admin/orders`; the CSV export takes the same shape. */
export interface AdminOrderFilters {
  status?: string;
  userId?: string;
  provider?: string;
  itemId?: string;
  /** ISO-8601 (or a bare date — the server reads it as that day's first moment, UTC). */
  from?: string;
  /** ISO-8601 (or a bare date — the server reads it through the end of that day, UTC). */
  to?: string;
  /** Order id, provider reference, coupon code or bank payment reference. */
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Body of `POST /api/admin/orders/{id}/mark-paid`. */
export interface MarkPaidInput {
  orderId: string;
  /** The bank transfer reference, so the payment can be reconciled against a statement later. */
  paymentReference?: string;
  notes?: string;
}

/** `OrderReapplyDto` — what a reapply actually had to repair. All zeros = nothing was missing. */
export interface OrderReapplyDto {
  Applied: boolean;
  EntitlementsCreated: number;
  EnrollmentsCreated: number;
  EarningsCreated: number;
  Order: AdminOrderDto | null;
}

/** `RefundDto` — one issued refund. */
export interface RefundDto {
  Id: string;
  OrderId: string;
  UserId: string;
  UserName: string | null;
  Kind: RefundKind;
  LineIds: string[];
  /** The titles of the refunded lines, as they were bought. */
  ItemTitles: string[];
  Amount: Money;
  Currency: string;
  Reason: string | null;
  RevokeAccess: boolean;
  Status: RefundStatus;
  Provider: string;
  ProviderRefundRef: string | null;
  IdempotencyKey: string;
  RequestedBy: string;
  RequestedByName: string | null;
  RequestedAt: string;
  CompletedAt: string | null;
  FailureReason: string | null;
  /** True when an idempotency-key replay returned the refund the first call created instead of issuing a new one. */
  Replayed: boolean;
}

/** Arguments of `POST /api/admin/orders/{id}/refund`. */
export interface RefundOrderInput {
  orderId: string;
  /** Omitted = everything still refundable on the selected lines (or on the whole order). */
  amount?: number | null;
  /** Order line ids; omitted or empty = the whole order. */
  lineIds?: string[];
  reason?: string;
  /** The default: the buyer loses what the refunded lines gave them. */
  revokeAccess?: boolean;
  /**
   * Generate this **once per refund attempt** with {@link newIdempotencyKey} and keep it across retries: the backend
   * holds a unique index on (OrderId, IdempotencyKey), so the same key can only ever produce one refund.
   */
  idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ADMIN_ORDERS_PAGE_SIZE = 20;

export interface AdminOrdersPage {
  items: AdminOrderDto[];
  total: number;
}

/** Filters -> query string. Empty strings become `undefined` so a blank filter is simply absent from the request. */
const orderParams = (filters: AdminOrderFilters) => ({
  status: filters.status || undefined,
  userId: filters.userId || undefined,
  provider: filters.provider || undefined,
  itemId: filters.itemId || undefined,
  from: filters.from || undefined,
  to: filters.to || undefined,
  search: filters.search || undefined,
  page: filters.page ?? 1,
  pageSize: filters.pageSize ?? ADMIN_ORDERS_PAGE_SIZE,
});

const fetchAdminOrders = async (filters: AdminOrderFilters): Promise<AdminOrdersPage> => {
  const res = await api.get<AdminOrderDto[]>('/admin/orders', { params: orderParams(filters) });
  const total = Number(res.headers['x-total-count'] ?? res.data.length);
  return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
};

/** `GET /api/admin/orders` — every order on the platform, newest first (`orders.manage`). */
export const useAdminOrdersQuery = (filters: AdminOrderFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.orders.list({ ...filters }),
    queryFn: () => fetchAdminOrders(filters),
    enabled: !!user,
    // Paging or re-filtering a money table should not blink back to a spinner.
    placeholderData: keepPreviousData,
  });
};

/** `GET /api/admin/orders/{id}` — one order with its lines, resolved names and refundable amounts. */
export const useAdminOrderQuery = (orderId?: string | null) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.orders.detail(orderId ?? undefined),
    queryFn: async () => (await api.get<AdminOrderDto>(`/admin/orders/${orderId}`)).data,
    enabled: !!user && !!orderId,
    retry: false,
  });
};

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export const ADMIN_REFUNDS_PAGE_SIZE = 20;

export interface AdminRefundsPage {
  items: RefundDto[];
  total: number;
}

export interface AdminRefundFilters extends DateRange {
  status?: string;
  page?: number;
  pageSize?: number;
}

const fetchRefunds = async (filters: AdminRefundFilters): Promise<AdminRefundsPage> => {
  const res = await api.get<RefundDto[]>('/admin/refunds', {
    params: {
      status: filters.status || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? ADMIN_REFUNDS_PAGE_SIZE,
    },
  });
  const total = Number(res.headers['x-total-count'] ?? res.data.length);
  return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
};

/** `GET /api/admin/refunds` — issued refunds, newest first (`refunds.manage`). */
export const useAdminRefundsQuery = (filters: AdminRefundFilters = {}, enabled = true) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.refunds.list(filters),
    queryFn: () => fetchRefunds(filters),
    enabled: !!user && enabled,
    placeholderData: keepPreviousData,
  });
};

/**
 * The refunds belonging to one order, for its payment/refund timeline.
 *
 * `GET /api/admin/refunds` has no order filter, so this reads the same recent page every other refund view reads
 * (one cache entry, keyed by `billingKeys.admin.refunds.list`) and narrows it client-side. A refund the page size no
 * longer reaches simply does not show in the timeline; the order's own `RefundedAmount` is always authoritative.
 */
export const useOrderRefundsQuery = (orderId?: string | null) => {
  const { user } = useAuth();
  const filters: AdminRefundFilters = { page: 1, pageSize: 100 };
  return useQuery({
    queryKey: billingKeys.admin.refunds.list(filters),
    queryFn: () => fetchRefunds(filters),
    enabled: !!user && !!orderId,
    select: (page: AdminRefundsPage) => page.items.filter((r) => r.OrderId === orderId),
  });
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Invalidating everything under `billingKeys.all` is deliberate: a refund, a manual capture and a reapply each move
 * entitlements, enrollments, earnings and revenue at the same time, and a stale figure on a money screen is worse
 * than one extra round-trip.
 */
const useInvalidateBilling = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: billingKeys.all });
};

/**
 * `POST /api/admin/orders/{id}/mark-paid` — a bank transfer confirmed by hand (`orders.manage`).
 *
 * Only offer it when the order's `SupportsManualCapture` is true: any provider with a gateway of its own answers
 * 400 `order.manual_capture_unsupported`.
 */
export const useMarkPaid = () => {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: async ({ orderId, paymentReference, notes }: MarkPaidInput) =>
      (
        await api.post<AdminOrderDto>(`/admin/orders/${orderId}/mark-paid`, {
          PaymentReference: paymentReference?.trim() || undefined,
          Notes: notes?.trim() || undefined,
        })
      ).data,
    onSuccess: invalidate,
  });
};

/**
 * `POST /api/admin/orders/{id}/reapply` — re-runs fulfillment for a Paid order, to repair access a crash left
 * half-granted. Safe to press twice: an order with nothing missing answers all zeros and writes nothing.
 */
export const useReapplyOrder = () => {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: async (orderId: string) => (await api.post<OrderReapplyDto>(`/admin/orders/${orderId}/reapply`)).data,
    onSuccess: invalidate,
  });
};

/**
 * `POST /api/admin/orders/{id}/refund` — gives money back (`refunds.manage`).
 *
 * Send `lineIds` for a partial refund, `amount` to cap it, neither for "everything still refundable". Always send an
 * `idempotencyKey`: the caller generates one per attempt and re-sends the *same* key on every retry, which is what
 * makes a double-click safe. A replay comes back as the original refund with `Replayed: true` — treat that as success,
 * not as a second refund.
 */
export const useRefundOrder = () => {
  const invalidate = useInvalidateBilling();
  return useMutation({
    mutationFn: async ({ orderId, amount, lineIds, reason, revokeAccess = true, idempotencyKey }: RefundOrderInput) =>
      (
        await api.post<RefundDto>(`/admin/orders/${orderId}/refund`, {
          Amount: typeof amount === 'number' ? amount : undefined,
          LineIds: lineIds && lineIds.length > 0 ? lineIds : undefined,
          Reason: reason?.trim() || undefined,
          RevokeAccess: revokeAccess,
          IdempotencyKey: idempotencyKey || undefined,
        })
      ).data,
    onSuccess: invalidate,
  });
};

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/**
 * `GET /api/admin/orders/export` — the current filters as a CSV file, downloaded through the browser.
 *
 * The server names the file (`Content-Disposition`), so an exported file always says when it was produced; the
 * fallback name is only used when a proxy strips the header.
 */
export const useExportOrders = () =>
  useMutation({
    mutationFn: async (filters: AdminOrderFilters = {}) => {
      const response = await api.get<Blob>('/admin/orders/export', {
        params: orderParams(filters),
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'] as string | undefined;
      const match = disposition && /filename="?([^";]+)"?/.exec(disposition);
      const fileName = match?.[1] ?? 'orders.csv';
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return fileName;
    },
  });
