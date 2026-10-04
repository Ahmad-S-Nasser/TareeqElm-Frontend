/**
 * The revenue dashboards (phase 5, wave F2a) — five read-only endpoints, one filter shape.
 *
 * `GET /api/admin/revenue/{summary,series,top-items,by-instructor,export}`, every one behind `revenue.view`. That
 * permission is held by **Admin *and* Organization** (the platform is single-tenant, so "platform revenue" is a single
 * figure and there is nothing to scope it to) — which is why the same body component is mounted under both shells.
 *
 * Three rules this file exists to keep:
 *
 *  1. **One filter shape.** `RevenueRange` is declared in `./useBilling` and reused verbatim here; the dashboard holds
 *     exactly one of them in state and hands the same object to all five calls, so the window, the currency, the bucket
 *     size and the top-N limit can never drift apart between two cards on the same screen.
 *  2. **Both ends are required.** The server refuses a half-open window (`revenue.invalid_range`) because a figure whose
 *     end moves while you read it is not a figure. The queries stay disabled until both ends are set, so a page that is
 *     still being filtered never fires a request it knows will 400.
 *  3. **No money is computed here.** Gross, net, the commission split, the average order value and the refund rate all
 *     arrive summed by MongoDB. This file reads numbers; it never adds two of them together.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type Money, type PurchasableItemType, type RevenueRange } from './useBilling';

/** Re-exported so a revenue screen imports its whole vocabulary from one place; the type itself lives in `useBilling`. */
export type { RevenueGranularity, RevenueRange } from './useBilling';

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/RevenueDtos.cs)
// ---------------------------------------------------------------------------

/** `RevenueSummaryDto` — the headline figures for one window and one currency. */
export interface RevenueSummary {
  /** Every captured order line at its list price, before coupons. */
  GrossRevenue: Money;
  /** What coupons gave away. */
  Discounts: Money;
  /** Refunds completed inside the window, whenever the original sale happened. */
  Refunds: Money;
  /** `GrossRevenue - Discounts - Refunds`; negative when a window holds more refunds than sales. */
  NetRevenue: Money;
  /** The platform's share of the charged amount, split at checkout. */
  PlatformFees: Money;
  /** The instructors' share of the same. `PlatformFees + InstructorEarnings === GrossRevenue - Discounts`. */
  InstructorEarnings: Money;
  /** Every order *placed* in the window, whatever became of it. */
  OrderCount: number;
  /** Orders whose money was actually captured (paid, partially refunded or refunded). */
  PaidOrderCount: number;
  AverageOrderValue: Money;
  /** 0..1 with four decimals — NOT a percentage. `formatPercent` wants 0..100, so multiply before you print it. */
  RefundRate: number;
  Currency: string;
  /** The window the server actually resolved: inclusive start... */
  From: string;
  /** ...and *exclusive* end, so adjacent windows never double-count a boundary. */
  To: string;
}

/** `RevenuePointDto` — one bucket of the over-time series. Buckets are contiguous: a quiet week is a zero, never a gap. */
export interface RevenuePoint {
  /** Sortable label: `yyyy-MM-dd` for a day or a week (its Monday), `yyyy-MM` for a month. */
  Bucket: string;
  Start: string;
  Gross: Money;
  Net: Money;
  Refunds: Money;
  Orders: number;
}

/** `RevenueItemDto` — one best-selling course, chapter or track. */
export interface RevenueItem {
  ItemType: PurchasableItemType;
  ItemId: string;
  /** The item's title right now; null once it has been deleted. Never render the id instead. */
  Title: string | null;
  /** What it was called when it was bought — this never changes, so it is the fallback when `Title` is null. */
  TitleSnapshot: string;
  Units: number;
  Gross: Money;
  Discounts: Money;
  /** `Gross - Discounts`. */
  Charged: Money;
}

/** `RevenueInstructorDto` — one instructor's sales in the window. */
export interface RevenueInstructor {
  InstructorId: string;
  /** Resolved name; null once the account has been deleted. */
  InstructorName: string | null;
  Units: number;
  Gross: Money;
  Discounts: Money;
  /** The platform's share. `PlatformFee + InstructorNet === Gross - Discounts`. */
  PlatformFee: Money;
  InstructorNet: Money;
}

/** The three CSVs `GET /api/admin/revenue/export?kind=` can produce. Anything else is a 400. */
export const REVENUE_EXPORT_KINDS = ['orders', 'items', 'instructors'] as const;
export type RevenueExportKind = (typeof REVENUE_EXPORT_KINDS)[number];

/**
 * Currencies the filter offers. The platform's own currency is always added on top of this list by the dashboard — the
 * server accepts any valid ISO-4217 code, this is only what a human can pick without typing.
 */
export const REVENUE_CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'JOD', 'EGP', 'KWD'] as const;

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

/** The named windows the filter offers; `custom` means "whatever is in the two date inputs". */
export const REVENUE_PRESETS = ['last7Days', 'last30Days', 'last90Days', 'thisMonth', 'lastMonth', 'thisYear', 'custom'] as const;
export type RevenuePreset = (typeof REVENUE_PRESETS)[number];

/** `2026-09-24` — the shape `<input type="date">` uses and the shape the API parses as a bare (whole-day) date. */
const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const shiftDays = (date: Date, days: number): Date => {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
};

/**
 * Turns a named preset into the two dates the endpoints want. `today` is injectable so a test never depends on the
 * clock. `custom` keeps whatever is already there, which is why it returns null.
 *
 * Both ends are inclusive whole days: the backend reads a bare `to` as "through the end of that day".
 */
export const presetRange = (preset: RevenuePreset, today: Date = new Date()): { from: string; to: string } | null => {
  const end = isoDay(today);
  switch (preset) {
    case 'last7Days':
      return { from: isoDay(shiftDays(today, -6)), to: end };
    case 'last30Days':
      return { from: isoDay(shiftDays(today, -29)), to: end };
    case 'last90Days':
      return { from: isoDay(shiftDays(today, -89)), to: end };
    case 'thisMonth':
      return { from: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), to: end };
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: isoDay(first), to: isoDay(last) };
    }
    case 'thisYear':
      return { from: isoDay(new Date(today.getFullYear(), 0, 1)), to: end };
    case 'custom':
    default:
      return null;
  }
};

/** What the dashboard starts on: the last 30 days, in the platform currency, bucketed by day, top 10 rows. */
export const DEFAULT_REVENUE_PRESET: RevenuePreset = 'last30Days';
export const DEFAULT_REVENUE_LIMIT = 10;

/** True when the window is complete and the right way round — the only state in which these endpoints are worth calling. */
export const isCompleteRange = (range: RevenueRange): boolean =>
  !!range.from && !!range.to && range.from <= range.to;

/** `from`/`to`/`currency`: the part of the query string every one of the five endpoints reads. */
const windowParams = (range: RevenueRange) => ({
  from: range.from || undefined,
  to: range.to || undefined,
  currency: range.currency || undefined,
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** `GET /api/admin/revenue/summary` (revenue.view — Admin and Organization). */
export const useRevenueSummaryQuery = (range: RevenueRange = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.revenue.summary(range),
    queryFn: async () => (await api.get<RevenueSummary>('/admin/revenue/summary', { params: windowParams(range) })).data,
    enabled: !!user && isCompleteRange(range),
  });
};

/** `GET /api/admin/revenue/series` — contiguous buckets over the whole window (`day` when no granularity is given). */
export const useRevenueSeriesQuery = (range: RevenueRange = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.revenue.series(range),
    queryFn: async () =>
      (
        await api.get<RevenuePoint[]>('/admin/revenue/series', {
          params: { ...windowParams(range), granularity: range.granularity || undefined },
        })
      ).data,
    enabled: !!user && isCompleteRange(range),
  });
};

/** `GET /api/admin/revenue/top-items` — best sellers, already sorted and resolved to titles by the server. */
export const useRevenueTopItemsQuery = (range: RevenueRange = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.revenue.topItems(range),
    queryFn: async () =>
      (
        await api.get<RevenueItem[]>('/admin/revenue/top-items', {
          params: { ...windowParams(range), limit: range.limit ?? DEFAULT_REVENUE_LIMIT },
        })
      ).data,
    enabled: !!user && isCompleteRange(range),
  });
};

/** `GET /api/admin/revenue/by-instructor` — the same window split by the instructor who teaches the item. */
export const useRevenueByInstructorQuery = (range: RevenueRange = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.revenue.byInstructor(range),
    queryFn: async () =>
      (
        await api.get<RevenueInstructor[]>('/admin/revenue/by-instructor', {
          params: { ...windowParams(range), limit: range.limit ?? DEFAULT_REVENUE_LIMIT },
        })
      ).data,
    enabled: !!user && isCompleteRange(range),
  });
};

/**
 * `GET /api/admin/revenue/export?kind=orders|items|instructors` — the same figures as a CSV file.
 *
 * The response is a real file download (`text/csv`, `Content-Disposition`), not JSON, so this is a mutation rather than
 * a query: it has a side effect (a download starts) and must never be cached or retried behind the user's back. The
 * server names the file; we only fall back to a sensible name when the header is missing.
 */
export const useExportRevenue = () =>
  useMutation({
    mutationFn: async ({ kind, range }: { kind: RevenueExportKind; range: RevenueRange }) => {
      const response = await api.get<Blob>('/admin/revenue/export', {
        params: { ...windowParams(range), kind },
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'] as string | undefined;
      const match = disposition && /filename="?([^";]+)"?/.exec(disposition);
      const fileName = match?.[1] ?? `revenue-${kind}.csv`;
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
