/**
 * The Analytics Financial tab (phase 2) — a genuinely different view from the revenue dashboard, built from three pieces:
 *
 *  1. **Period-over-period comparison** — pure client composition: `useRevenueSummaryQuery` is called twice, once for the
 *     selected window and once for the immediately preceding window of equal length, and the two summaries are diffed.
 *     No money is *computed* here beyond that difference; every figure being compared still arrives summed by MongoDB.
 *  2. **Revenue by department** — `GET /api/admin/revenue/by-department` (revenue.view), the one new aggregation.
 *  3. **Goal / projection** — `GET|PUT /api/organization/financial-goals` (pricing.manage). The projection is computed on
 *     the server and is a simple straight-line pace (`actual / daysElapsed * totalDays`), not a forecast.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type Money, type RevenueRange } from './useBilling';
import { DEFAULT_REVENUE_LIMIT, isCompleteRange, useRevenueSummaryQuery, type RevenueSummary } from './useRevenue';

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/RevenueDtos.cs and FinancialGoalDtos.cs)
// ---------------------------------------------------------------------------

/** `RevenueDepartmentDto` — one department's sales in the window. */
export interface RevenueDepartment {
  /** Null for the single "Unassigned" row (lines whose course/track has no department). */
  DepartmentId: string | null;
  /** Resolved name; null for the Unassigned row and for a department deleted since. Never render the id instead. */
  DepartmentName: string | null;
  Unassigned: boolean;
  Gross: Money;
  Discounts: Money;
  /** `Gross - Discounts`. */
  Charged: Money;
  Units: number;
}

/** `FinancialGoalDto` — a period's target beside what has come in so far. */
export interface FinancialGoal {
  Id: string;
  OrganizationId: string | null;
  PeriodStart: string;
  /** Inclusive last day of the period. */
  PeriodEnd: string;
  TargetAmount: Money;
  Currency: string;
  CreatedBy: string;
  CreatedAt: string;
  UpdatedAt: string;
  /** Net revenue (gross - discounts - refunds) in the period so far — the revenue summary's own `NetRevenue`. */
  ActualToDate: Money;
  DaysElapsed: number;
  TotalDays: number;
  /** `ActualToDate / DaysElapsed * TotalDays` — a straight-line pace, 0 before the period starts. */
  ProjectedTotal: Money;
  /** 0..100+ (already a percentage, unlike the summary's 0..1 `RefundRate`). */
  PercentOfTarget: number;
}

export interface FinancialGoalUpsert {
  periodStart: string;
  periodEnd: string;
  targetAmount: number;
  currency?: string;
}

// ---------------------------------------------------------------------------
// The preceding window
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** `yyyy-MM-dd` → a UTC-midnight timestamp. Pure date arithmetic in UTC, so a DST switch can never shift a day. */
const dayToUtc = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const utcToDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * The window of equal length that ends the day before `from`. Both ends are inclusive whole days, exactly like
 * `presetRange`: `[2026-09-01, 2026-09-30]` (30 days) → `[2026-08-02, 2026-08-31]`.
 */
export const previousRange = (from: string, to: string): { from: string; to: string } => {
  const start = dayToUtc(from);
  const lengthDays = Math.round((dayToUtc(to) - start) / DAY_MS) + 1;
  const previousTo = start - DAY_MS;
  return { from: utcToDay(previousTo - (lengthDays - 1) * DAY_MS), to: utcToDay(previousTo) };
};

/**
 * Percentage change from `previous` to `current`. Null when there is nothing to compare against (the previous period was
 * zero and this one is not — "+∞%" is not a number anyone can use); 0 when both are zero.
 */
export const percentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export const COMPARISON_METRICS = ['NetRevenue', 'GrossRevenue', 'PaidOrderCount', 'AverageOrderValue'] as const;
export type ComparisonMetric = (typeof COMPARISON_METRICS)[number];

export interface MetricComparison {
  metric: ComparisonMetric;
  current: number;
  previous: number;
  /** Null when the previous period was zero (see `percentChange`). */
  deltaPercent: number | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * The selected window and the equal-length window before it, both through `useRevenueSummaryQuery` (so both share its
 * cache entries and its `enabled` rule), diffed metric by metric.
 */
export const useRevenueComparisonQuery = (range: RevenueRange = {}) => {
  const usable = isCompleteRange(range);
  const prior: RevenueRange = usable
    ? { ...range, ...previousRange(range.from!, range.to!), granularity: undefined, limit: undefined }
    : {};
  const current = useRevenueSummaryQuery({ ...range, granularity: undefined, limit: undefined });
  const previous = useRevenueSummaryQuery(prior);

  const now: RevenueSummary | undefined = current.data;
  const before: RevenueSummary | undefined = previous.data;
  const metrics: MetricComparison[] | undefined =
    now && before
      ? COMPARISON_METRICS.map((metric) => ({
          metric,
          current: now[metric],
          previous: before[metric],
          deltaPercent: percentChange(now[metric], before[metric]),
        }))
      : undefined;

  return {
    current: now,
    previous: before,
    previousRange: usable ? { from: prior.from!, to: prior.to! } : undefined,
    metrics,
    isLoading: current.isLoading || previous.isLoading,
    isError: current.isError || previous.isError,
    error: current.error ?? previous.error,
  };
};

const byDepartmentKey = (range: RevenueRange) =>
  [...billingKeys.admin.revenue.all(), 'by-department', range.from ?? '', range.to ?? '', range.currency ?? '', range.limit ?? DEFAULT_REVENUE_LIMIT] as const;

/** `GET /api/admin/revenue/by-department` (revenue.view) — highest gross first, the Unassigned bucket included. */
export const useRevenueByDepartmentQuery = (range: RevenueRange = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: byDepartmentKey(range),
    queryFn: async () =>
      (
        await api.get<RevenueDepartment[]>('/admin/revenue/by-department', {
          params: {
            from: range.from || undefined,
            to: range.to || undefined,
            currency: range.currency || undefined,
            limit: range.limit ?? DEFAULT_REVENUE_LIMIT,
          },
        })
      ).data,
    enabled: !!user && isCompleteRange(range),
  });
};

export const financialGoalKeys = {
  all: () => ['billing', 'financial-goals'] as const,
  period: (periodStart?: string, periodEnd?: string) =>
    ['billing', 'financial-goals', periodStart ?? '', periodEnd ?? ''] as const,
};

/**
 * `GET /api/organization/financial-goals?periodStart=&periodEnd=` (pricing.manage). Resolves to `null` — not an error —
 * when no target has been set for exactly this period (the server answers 404), which is the normal starting state.
 */
export const useFinancialGoalQuery = (periodStart?: string, periodEnd?: string, enabled = true) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: financialGoalKeys.period(periodStart, periodEnd),
    queryFn: async (): Promise<FinancialGoal | null> => {
      try {
        return (await api.get<FinancialGoal>('/organization/financial-goals', { params: { periodStart, periodEnd } })).data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) return null;
        throw error;
      }
    },
    enabled: enabled && !!user && !!periodStart && !!periodEnd && periodStart < periodEnd,
  });
};

/** `PUT /api/organization/financial-goals` — sets or replaces the target for one period. */
export const useUpsertFinancialGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: FinancialGoalUpsert) =>
      (await api.put<FinancialGoal>('/organization/financial-goals', body)).data,
    onSuccess: (goal, body) => {
      queryClient.setQueryData(financialGoalKeys.period(body.periodStart, body.periodEnd), goal);
    },
  });
};
