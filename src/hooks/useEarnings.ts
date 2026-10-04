/**
 * The signed-in instructor's own earnings (phase 5, wave F1c) — read-only from end to end.
 *
 * Three endpoints, all behind `earnings.self` (an Instructor default; Admin holds every permission automatically):
 *   GET /api/instructor/earnings/summary?from=&to=
 *   GET /api/instructor/earnings?from=&to=&status=&page=&pageSize=   (total in X-Total-Count)
 *   GET /api/instructor/payouts?page=&pageSize=                      (total in X-Total-Count)
 *
 * **There is no instructor id on any of these routes, and no buyer in any of these responses.** The server scopes
 * every query to the caller, so there is no parameter with which one instructor could ask for another's money; and the
 * ledger deliberately carries no user id, name or email — an instructor sees *what* sold, *when* and *for how much*,
 * never *who* bought it. `BuyerCount` (+1 per sale, -1 per reversal) is the only form in which the buyer appears.
 * Nothing in this file may grow a buyer-identifying field without that privacy decision being revisited first.
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type DateRange, type EarningKind, type EarningStatus, type Money, type PayoutMethod, type PayoutStatus, type PurchasableItemType } from './useBilling';

/** `EarningsSummaryDto` — balances per status for the window, plus the two lifetime figures and the caller's rate. */
export interface EarningsSummary {
  /** Accrued but still inside the hold period. */
  Pending: Money;
  /** Past the hold period and payable. */
  Available: Money;
  /** Already covered by a payout. */
  Paid: Money;
  /** The refunded side of the ledger; a fully refunded sale nets to zero. */
  Reversed: Money;
  /** All-time gross, reversals included (so: net of refunds). */
  LifetimeGross: Money;
  /** All-time net after the platform's commission. */
  LifetimeNet: Money;
  Currency: string;
  /** The caller's own effective platform share, 0..1 (their `User.CommissionRate`, or the platform default). */
  CommissionRate: number;
}

/** `EarningDto` — one row of the instructor's own ledger. No buyer field exists here, by design. */
export interface EarningRow {
  Id: string;
  /** The instructor's own reference for the sale; it resolves to nothing they can open. */
  OrderId: string;
  OrderLineId: string;
  ItemType: PurchasableItemType;
  ItemId: string;
  /** What the item was called when it sold; this never changes. */
  Title: string;
  /** The item's title right now; null when it has been deleted since. */
  ResolvedTitle: string | null;
  CourseId: string | null;
  CourseTitle: string | null;
  /** +1 for a sale, -1 for its reversal — a count, never an identity. */
  BuyerCount: number;
  Currency: string;
  GrossAmount: Money;
  /** The rate snapshotted at the time of sale, not the caller's rate today. */
  CommissionRate: number;
  PlatformFeeAmount: Money;
  /** Negative on a reversal row. */
  NetAmount: Money;
  Kind: EarningKind;
  Status: EarningStatus;
  ReversalOfEarningId: string | null;
  AvailableAt: string;
  OccurredAt: string;
  PayoutId: string | null;
}

/** `InstructorPayoutDto` — a payout as its own recipient sees it: amounts and dates, no administrator ids. */
export interface InstructorPayout {
  Id: string;
  Currency: string;
  Amount: Money;
  /** How many ledger rows this payout covered. */
  EarningCount: number;
  PeriodStart: string;
  PeriodEnd: string;
  Status: PayoutStatus;
  Method: PayoutMethod;
  /** The transfer reference, to match against a bank statement. */
  Reference: string | null;
  Notes: string | null;
  CreatedAt: string;
  ApprovedAt: string | null;
  PaidAt: string | null;
  CancelledAt: string | null;
}

/** Filters for the ledger list. `status` is one of `EarningStatus`; unknown values are ignored by the server. */
export interface EarningsFilters extends DateRange {
  status?: string;
  page?: number;
  pageSize?: number;
}

/** A page of rows plus the server's total, read from `X-Total-Count`. */
export interface EarningsPage<T> {
  items: T[];
  total: number;
}

const dateParams = (range: DateRange) => ({ from: range.from || undefined, to: range.to || undefined });

/** `GET /api/instructor/earnings/summary` (earnings.self). */
export const useEarningsSummaryQuery = (range: DateRange = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.earnings.summary(user?.Id, range),
    queryFn: async () =>
      (await api.get<EarningsSummary>('/instructor/earnings/summary', { params: dateParams(range) })).data,
    enabled: !!user,
  });
};

/** `GET /api/instructor/earnings` (earnings.self) — newest first, reversals included and negative. */
export const useEarningsLedgerQuery = (filters: EarningsFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.earnings.ledger(user?.Id, filters),
    queryFn: async (): Promise<EarningsPage<EarningRow>> => {
      const res = await api.get<EarningRow[]>('/instructor/earnings', {
        params: {
          ...dateParams(filters),
          status: filters.status || undefined,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? 20,
        },
      });
      return { items: res.data, total: Number(res.headers['x-total-count'] ?? res.data.length) };
    },
    enabled: !!user,
  });
};

/** `GET /api/instructor/payouts` (earnings.self) — the caller's own payouts, newest first. */
export const useInstructorPayoutsQuery = (page = 1, pageSize = 20) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.earnings.payouts(user?.Id, page, pageSize),
    queryFn: async (): Promise<EarningsPage<InstructorPayout>> => {
      const res = await api.get<InstructorPayout[]>('/instructor/payouts', { params: { page, pageSize } });
      return { items: res.data, total: Number(res.headers['x-total-count'] ?? res.data.length) };
    },
    enabled: !!user,
  });
};
