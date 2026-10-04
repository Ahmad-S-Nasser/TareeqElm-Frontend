/**
 * Paying instructors out, and the commission that decides how future sales split (phase 5, wave F2c).
 * Everything here is behind `payouts.manage` — Admin-only. The instructor's own read-only view of the same money is
 * `./useEarnings.ts` (`earnings.self`).
 *
 *   GET  /api/admin/payouts?instructorId=&status=&page=&pageSize=            total in X-Total-Count
 *   GET  /api/admin/payouts/eligible?instructorId=&periodStart=&periodEnd=&currency=
 *   POST /api/admin/payouts                                                  201 + the new Draft
 *   POST /api/admin/payouts/{id}/{approve|mark-paid|cancel}                  200 + the updated payout
 *   GET  /api/admin/payouts/{id}/statement                                   text/csv attachment
 *   PUT  /api/admin/payouts/commission/{instructorId}                        204 (null rate = platform default)
 *
 * **A payout walks Draft → Approved → Paid**, and can be cancelled from either of the first two; Paid is terminal
 * because the money has actually left. The UI gates its actions on `Status` for the same reason the server does, but
 * the server is the authority: a stale screen gets a 409 `payout.invalid_transition`, never a second payment.
 *
 * **Nothing here computes money.** `Amount` on the preview is the very number the create would sweep (the backend
 * computes both from one `PayableAsync`), so a preview can never promise something the sweep then skips.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import {
  billingKeys,
  type DateRange,
  type EarningKind,
  type EarningStatus,
  type Money,
  type PayoutMethod,
  type PayoutStatus,
  type PurchasableItemType,
} from './useBilling';
import { usePlatformSettingsQuery, type PlatformSettings } from './useSettings';

/** `PayoutEarningDto` — one ledger row as a payout screen or statement shows it. */
export interface PayoutEarning {
  Id: string;
  OrderId: string;
  OrderLineId: string;
  ItemType: PurchasableItemType;
  ItemId: string;
  /** What the item was called when it sold — what the instructor actually earned on. */
  Title: string;
  /** The item's title now; null when it was renamed away or deleted since. */
  ResolvedTitle: string | null;
  Currency: string;
  GrossAmount: Money;
  /** The rate snapshotted at the time of sale (0..1), not the instructor's rate today. */
  CommissionRate: number;
  PlatformFeeAmount: Money;
  /** Negative on a reversal. */
  NetAmount: Money;
  Kind: EarningKind;
  Status: EarningStatus;
  OccurredAt: string;
  AvailableAt: string;
  PayoutId: string | null;
}

/** `PayoutDto` — every id comes with its resolved name beside it. */
export interface Payout {
  Id: string;
  InstructorId: string;
  InstructorName: string | null;
  Currency: string;
  Amount: Money;
  Status: PayoutStatus;
  Method: PayoutMethod;
  Reference: string | null;
  Notes: string | null;
  PeriodStart: string;
  PeriodEnd: string;
  EarningCount: number;
  EarningIds: string[];
  CreatedAt: string;
  CreatedBy: string;
  CreatedByName: string | null;
  ApprovedBy: string | null;
  ApprovedByName: string | null;
  ApprovedAt: string | null;
  PaidBy: string | null;
  PaidByName: string | null;
  PaidAt: string | null;
  CancelledBy: string | null;
  CancelledByName: string | null;
  CancelledAt: string | null;
}

/** `PayoutEligibleDto` — what a payout created right now would sweep, computed without writing one. */
export interface PayoutEligible {
  InstructorId: string;
  InstructorName: string | null;
  Currency: string;
  /** Sum of the net amounts below — what a payout created right now would be worth. */
  Amount: Money;
  EarningCount: number;
  PeriodStart: string | null;
  PeriodEnd: string | null;
  /** The platform's share of this instructor's future sales, 0..1. */
  CommissionRate: number;
  /** False when this instructor carries an override of their own. */
  UsesDefaultCommissionRate: boolean;
  /** How many Pending earnings this very call ripened to Available. */
  Ripened: number;
  /** Still held back: earnings whose hold has not elapsed, in this currency. */
  PendingAmount: Money;
  PendingCount: number;
  NextAvailableAt: string | null;
  /** Payable money in other currencies, which a payout deliberately never mixes in. */
  OtherCurrencies: Record<string, Money>;
  Earnings: PayoutEarning[];
}

/** `PayoutCreateDto`. A payout never mixes currencies; `Currency` omitted = the platform's current one. */
export interface PayoutCreate {
  InstructorId: string;
  /** ISO-8601. A bare date as `PeriodEnd` means "through the end of that day", like every other admin date filter. */
  PeriodStart: string;
  PeriodEnd: string;
  Method: PayoutMethod;
  Notes?: string | null;
  Currency?: string | null;
}

/** `PayoutMarkPaidDto` — the reference the money actually moved under. */
export interface PayoutMarkPaid {
  Reference: string;
  /** ISO-8601; omitted = now. */
  PaidAt?: string | null;
}

export interface PayoutFilters {
  instructorId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface PayoutsPage {
  items: Payout[];
  total: number;
}

export const PAYOUTS_PAGE_SIZE = 10;

/** Which actions a payout in this state actually offers — the client mirror of the server's transition rules. */
export const payoutCan = (status: PayoutStatus) => ({
  approve: status === 'Draft',
  markPaid: status === 'Approved',
  cancel: status === 'Draft' || status === 'Approved',
});

/** `GET /api/admin/payouts` — newest first. The server ripens due earnings before answering. */
export const useAdminPayoutsQuery = (filters: PayoutFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.payouts.list(filters),
    queryFn: async (): Promise<PayoutsPage> => {
      const res = await api.get<Payout[]>('/admin/payouts', {
        params: {
          instructorId: filters.instructorId || undefined,
          status: filters.status || undefined,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? PAYOUTS_PAGE_SIZE,
        },
      });
      const total = Number(res.headers['x-total-count'] ?? res.data.length);
      return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
};

/**
 * `GET /api/admin/payouts/eligible` — the preview the create button acts on. Disabled until an instructor is chosen,
 * so opening the page never asks the server about nobody.
 */
export const useEligibleEarningsQuery = (
  instructorId?: string | null,
  range: DateRange & { currency?: string } = {},
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: billingKeys.admin.payouts.eligible(instructorId ?? undefined, range),
    queryFn: async () =>
      (
        await api.get<PayoutEligible>('/admin/payouts/eligible', {
          params: {
            instructorId,
            periodStart: range.from || undefined,
            periodEnd: range.to || undefined,
            currency: range.currency || undefined,
          },
        })
      ).data,
    enabled: (options.enabled ?? true) && !!instructorId,
  });

/**
 * A payout write moves money between ledger states, so it invalidates every billing cache — the payouts list, the
 * eligible preview, the instructor's own earnings and the revenue figures all move together.
 */
const useInvalidatePayouts = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: billingKeys.all });
};

/** `POST /api/admin/payouts` — sweeps the instructor's payable earnings in the window into a new Draft. */
export const useCreatePayout = () => {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: async (body: PayoutCreate) => (await api.post<Payout>('/admin/payouts', body)).data,
    onSuccess: invalidate,
  });
};

/** `POST /api/admin/payouts/{id}/approve` — Draft → Approved; 409 from anything else. */
export const useApprovePayout = () => {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Payout>(`/admin/payouts/${id}/approve`)).data,
    onSuccess: invalidate,
  });
};

/** `POST /api/admin/payouts/{id}/mark-paid` — the money moved: every earning it holds becomes Paid. */
export const useMarkPayoutPaid = () => {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: PayoutMarkPaid }) =>
      (await api.post<Payout>(`/admin/payouts/${id}/mark-paid`, body)).data,
    onSuccess: invalidate,
  });
};

/** `POST /api/admin/payouts/{id}/cancel` — Draft/Approved only; the earnings it held go back to payable. */
export const useCancelPayout = () => {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Payout>(`/admin/payouts/${id}/cancel`)).data,
    onSuccess: invalidate,
  });
};

/**
 * `GET /api/admin/payouts/{id}/statement` — the payout and every earning behind it, as a CSV the browser downloads.
 * The file name comes from the server's `Content-Disposition`, so the statement is named the same everywhere.
 */
export const useDownloadPayoutStatement = () =>
  useMutation({
    mutationFn: async (payoutId: string) => {
      const response = await api.get<Blob>(`/admin/payouts/${payoutId}/statement`, { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] as string | undefined;
      const match = disposition && /filename="?([^";]+)"?/.exec(disposition);
      const fileName = match?.[1] ?? `payout-${payoutId}.csv`;
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

// ---------------------------------------------------------------------------
// Commission
// ---------------------------------------------------------------------------

/**
 * `PUT /api/admin/payouts/commission/{instructorId}` — the platform's share (0..1) of this instructor's *future*
 * sales. `null` reverts them to `PlatformSettings.DefaultCommissionRate`. Existing sales never move: the rate is
 * snapshotted onto the order line and the earning at checkout.
 */
export const useSetCommissionOverride = () => {
  const invalidate = useInvalidatePayouts();
  return useMutation({
    mutationFn: async ({ instructorId, commissionRate }: { instructorId: string; commissionRate: number | null }) => {
      await api.put(`/admin/payouts/commission/${instructorId}`, { CommissionRate: commissionRate });
      return instructorId;
    },
    onSuccess: invalidate,
  });
};

/** One instructor as the payout/commission screens list them (`AdminUserDto`, narrowed to what is shown). */
export interface InstructorOption {
  Id: string;
  FullName: string;
  Email: string;
  IsActive: boolean;
}

export const INSTRUCTORS_PAGE_SIZE = 10;

export interface InstructorOptionsPage {
  items: InstructorOption[];
  total: number;
}

/**
 * `GET /api/admin/payouts/instructors` — who can be paid. Deliberately not `/api/admin/users` (Admin-only
 * `users.manage`, the global roster): this one shares `payouts.manage`'s ownership scoping, so Organization reaches it
 * too and each caller sees only the instructors it may actually pay (Admin: platform instructors; Organization: its
 * own tenant's).
 */
export const useInstructorOptionsQuery = (search = '', page = 1, pageSize = INSTRUCTORS_PAGE_SIZE) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-payouts', 'instructor-options', search, page, pageSize] as const,
    queryFn: async (): Promise<InstructorOptionsPage> => {
      const res = await api.get<InstructorOption[]>('/admin/payouts/instructors', {
        params: { search: search.trim() || undefined, page, pageSize },
      });
      const total = Number(res.headers['x-total-count'] ?? res.data.length);
      return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
};

/** The billing half of `GET /api/Settings`, which `PlatformSettings` (a pre-phase-5 type) does not declare. */
type BillingSettings = PlatformSettings & { DefaultCommissionRate?: number | null; Currency?: string | null };

/**
 * The platform's default share (0..1), from `GET /api/Settings` — null for a caller without `settings.manage`.
 * It reuses `usePlatformSettingsQuery`'s cache rather than fetching settings a second time.
 */
export const useDefaultCommissionRate = () => {
  const { data, isLoading } = usePlatformSettingsQuery();
  return { rate: (data as BillingSettings | undefined)?.DefaultCommissionRate ?? null, isLoading };
};

/**
 * One instructor's **effective** rate — their own override, or the platform default.
 *
 * `GET /api/admin/payouts/eligible` is the only read the API exposes for it (there is no commission list endpoint and
 * `AdminUserDto` does not carry the rate), so the probe asks for a one-day window: the answer's `CommissionRate` and
 * `UsesDefaultCommissionRate` are exactly the same whatever the window, and a narrow one keeps the response small.
 */
export const useCommissionRateQuery = (instructorId?: string | null, enabled = true) => {
  const today = new Date().toISOString().slice(0, 10);
  const query = useEligibleEarningsQuery(instructorId, { from: today, to: today }, { enabled });
  return {
    ...query,
    rate: query.data?.CommissionRate ?? null,
    usesDefault: query.data?.UsesDefaultCommissionRate ?? true,
  };
};
