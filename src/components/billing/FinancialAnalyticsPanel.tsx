/**
 * The Analytics Financial tab (phase 2).
 *
 * This deliberately is NOT the revenue dashboard. `/organization/revenue` (`RevenueDashboard`) already answers "what are
 * the numbers?" — KPIs, the series, top items, the instructor split and the CSV exports. This panel answers the questions
 * an analytics page is for instead:
 *
 *  1. **Are we doing better than before?** — the selected window against the equal-length window just before it.
 *  2. **Where is the money coming from?** — revenue by department (bar + share), the "Unassigned" bucket included.
 *  3. **Will we hit the target?** — a per-period goal with a straight-line pace projection (not a forecast), editable
 *     inline by whoever holds `pricing.manage`.
 *
 * It keeps its own small filter bar (preset + two dates) rather than importing one from `RevenueDashboard`, which is a
 * different consumer and is not to change; the date vocabulary (`presetRange`, `REVENUE_PRESETS`, `isCompleteRange`) is
 * shared through `useRevenue`.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownRight, ArrowUpRight, Building2, Loader2, Minus, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/billing/MoneyInput";
import { Can } from "@/components/routing/Can";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { usePlatformCurrency } from "@/lib/money";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { RevenueRange } from "@/hooks/useBilling";
import {
  DEFAULT_REVENUE_PRESET,
  REVENUE_PRESETS,
  isCompleteRange,
  presetRange,
  type RevenuePreset,
} from "@/hooks/useRevenue";
import {
  useFinancialGoalQuery,
  useRevenueByDepartmentQuery,
  useRevenueComparisonQuery,
  useUpsertFinancialGoal,
  type MetricComparison,
  type RevenueDepartment,
} from "@/hooks/useFinancialAnalytics";

/** The same palette the Academic tab's department charts use, so a department reads the same colour across tabs. */
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8b5cf6", "#ec4899"];

const MONEY_METRICS = new Set(["NetRevenue", "GrossRevenue", "AverageOrderValue"]);

// ---------------------------------------------------------------------------
// Period-over-period delta card
// ---------------------------------------------------------------------------

const DeltaCard = ({ row, format }: { row: MetricComparison; format: (value: number) => string }) => {
  const { t } = useTranslation("organization");
  const { formatPercent } = useFormatters();
  const delta = row.deltaPercent;
  const direction = delta == null || delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const signed =
    delta == null ? null : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatPercent(Math.abs(delta), { maximumFractionDigits: 1 })}`;

  return (
    <Card className="border-border/50 shadow-soft" data-testid={`delta-${row.metric}`}>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t(`analytics.comparison.metrics.${row.metric}`)}
        </p>
        <p dir="ltr" className="mt-2 text-start text-2xl font-black tabular-nums" data-testid={`delta-${row.metric}-value`}>
          {format(row.current)}
        </p>
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-sm font-medium",
            direction === "up" && "text-emerald-600",
            direction === "down" && "text-destructive",
            direction === "flat" && "text-muted-foreground"
          )}
          data-testid={`delta-${row.metric}-change`}
        >
          <Icon className="h-4 w-4 shrink-0 rtl:-scale-x-100" aria-label={t(`analytics.comparison.${direction}`)} />
          {signed == null ? t("analytics.comparison.noPrior") : t("analytics.comparison.vsPrevious", { value: signed })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("analytics.comparison.previousValue", { value: format(row.previous) })}
        </p>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Goal widget
// ---------------------------------------------------------------------------

const GoalWidget = ({ from, to, currency }: { from: string; to: string; currency: string }) => {
  const { t } = useTranslation(["organization", "common"]);
  const { formatCurrency, formatDate, formatNumber, formatPercent } = useFormatters();
  const { toast } = useToast();
  const periodUsable = !!from && !!to && from < to;
  const goalQuery = useFinancialGoalQuery(from, to, periodUsable);
  const upsert = useUpsertFinancialGoal();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const goal = goalQuery.data ?? null;
  const goalCurrency = goal?.Currency || currency;
  const money = (value: number) => formatCurrency(value, goalCurrency);

  const startEditing = () => {
    setAmount(goal?.TargetAmount ?? null);
    setFormError(null);
    setEditing(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (amount == null || amount <= 0) {
      setFormError(t("analytics.goal.invalidAmount"));
      return;
    }
    try {
      await upsert.mutateAsync({ periodStart: from, periodEnd: to, targetAmount: amount });
      setEditing(false);
      toast({ title: t("analytics.goal.saved") });
    } catch (error) {
      setFormError(getApiError(error, t("analytics.goal.saveFailed")));
    }
  };

  return (
    <Card className="border-border/50 shadow-soft" data-testid="goal-widget">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          {t("analytics.goal.title")}
        </CardTitle>
        <CardDescription>
          {periodUsable
            ? t("analytics.goal.description", { from: formatDate(from), to: formatDate(to) })
            : t("analytics.goal.needsRange")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {periodUsable && goalQuery.isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {goalQuery.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getApiError(goalQuery.error, t("analytics.goal.loadFailed"))}
          </p>
        )}

        {periodUsable && !goalQuery.isLoading && !goalQuery.isError && !goal && !editing && (
          <p className="text-sm text-muted-foreground" data-testid="goal-none">
            {t("analytics.goal.none")}
          </p>
        )}

        {goal && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("analytics.goal.actual")}</p>
                <p dir="ltr" className="text-start text-2xl font-black tabular-nums" data-testid="goal-actual">
                  {money(goal.ActualToDate)}
                </p>
              </div>
              <div className="text-end">
                <p className="text-xs font-medium text-muted-foreground">{t("analytics.goal.target")}</p>
                <p dir="ltr" className="text-lg font-semibold tabular-nums" data-testid="goal-target">
                  {money(goal.TargetAmount)}
                </p>
              </div>
            </div>
            <Progress
              value={Math.min(Math.max(goal.PercentOfTarget, 0), 100)}
              aria-label={t("analytics.goal.progress", { percent: formatPercent(goal.PercentOfTarget, { maximumFractionDigits: 1 }) })}
            />
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span data-testid="goal-percent">
                {t("analytics.goal.progress", { percent: formatPercent(goal.PercentOfTarget, { maximumFractionDigits: 1 }) })}
              </span>
              <span className="text-muted-foreground">
                {t("analytics.goal.days", { elapsed: formatNumber(goal.DaysElapsed), total: formatNumber(goal.TotalDays) })}
              </span>
            </div>
            <p className="font-medium" data-testid="goal-projection">
              {goal.DaysElapsed > 0
                ? t("analytics.goal.onPace", { amount: money(goal.ProjectedTotal) })
                : t("analytics.goal.notStarted")}
            </p>
            <p className="text-xs text-muted-foreground">{t("analytics.goal.linearNote")}</p>
          </div>
        )}

        {periodUsable && !goalQuery.isLoading && !goalQuery.isError && (
          editing ? (
            <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="financial-goal-amount">{t("analytics.goal.targetLabel")}</Label>
                <MoneyInput
                  id="financial-goal-amount"
                  value={amount}
                  onChange={setAmount}
                  currency={goalCurrency}
                  aria-invalid={!!formError}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={upsert.isPending}>
                  {upsert.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("common:actions.save")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  {t("common:actions.cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="outline" size="sm" onClick={startEditing}>
              {goal ? t("analytics.goal.update") : t("analytics.goal.set")}
            </Button>
          )
        )}
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

export const FinancialAnalyticsPanel = () => {
  const { t, i18n } = useTranslation(["organization", "billing", "common"]);
  const { formatCurrency, formatDate, formatNumber } = useFormatters();
  const { currency: platformCurrency } = usePlatformCurrency();
  const isRtl = i18n.dir() === "rtl";

  const initial = useMemo(() => presetRange(DEFAULT_REVENUE_PRESET)!, []);
  const [preset, setPreset] = useState<RevenuePreset>(DEFAULT_REVENUE_PRESET);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const range: RevenueRange = useMemo(() => ({ from, to }), [from, to]);
  const rangeIsUsable = isCompleteRange(range);

  const comparison = useRevenueComparisonQuery(range);
  const departmentsQuery = useRevenueByDepartmentQuery(range);

  const currency = comparison.current?.Currency || platformCurrency;
  const money = (value: number) => formatCurrency(value, currency);

  const departmentLabel = (row: RevenueDepartment) =>
    row.Unassigned
      ? t("analytics.byDepartment.unassigned")
      : row.DepartmentName ?? t("analytics.byDepartment.unknown");
  const departments = (departmentsQuery.data ?? []).map((row) => ({ ...row, Label: departmentLabel(row) }));

  const applyPreset = (next: RevenuePreset) => {
    setPreset(next);
    const window = presetRange(next);
    if (window) {
      setFrom(window.from);
      setTo(window.to);
    }
  };

  const loadFailed = t("billing:revenue.loadFailed");
  const tooltipStyle = { borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", direction: isRtl ? "rtl" : "ltr" } as const;

  return (
    <div className="space-y-6" data-testid="financial-analytics-panel">
      {/* ---------------- filters: preset + two dates ---------------- */}
      <section
        aria-label={t("analytics.filters")}
        className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-soft sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="financial-preset">{t("billing:revenue.preset")}</Label>
          <Select value={preset} onValueChange={(next) => applyPreset(next as RevenuePreset)}>
            <SelectTrigger id="financial-preset" className="sm:w-44" aria-label={t("billing:revenue.preset")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVENUE_PRESETS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`billing:common.range.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="financial-from">{t("billing:common.from")}</Label>
          <Input
            id="financial-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset("custom");
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="financial-to">{t("billing:common.to")}</Label>
          <Input
            id="financial-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset("custom");
            }}
          />
        </div>
      </section>

      {!rangeIsUsable && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("billing:revenue.invalidRange")}
        </p>
      )}

      {/* ---------------- 1. period over period ---------------- */}
      <section aria-label={t("analytics.comparison.title")} className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("analytics.comparison.title")}</h2>
          {rangeIsUsable && comparison.previousRange && (
            <p className="text-sm text-muted-foreground">
              {t("analytics.comparison.description", {
                from: formatDate(from),
                to: formatDate(to),
                days: formatNumber(
                  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
                ),
                prevFrom: formatDate(comparison.previousRange.from),
                prevTo: formatDate(comparison.previousRange.to),
              })}
            </p>
          )}
        </div>
        {comparison.isError ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getApiError(comparison.error, loadFailed)}
          </p>
        ) : rangeIsUsable && comparison.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          comparison.metrics && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {comparison.metrics.map((row) => (
                <DeltaCard
                  key={row.metric}
                  row={row}
                  format={MONEY_METRICS.has(row.metric) ? money : (value) => formatNumber(value)}
                />
              ))}
            </div>
          )
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* ---------------- 2. by department ---------------- */}
        <Card className="border-border/50 shadow-soft xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              {t("analytics.byDepartment.title")}
            </CardTitle>
            <CardDescription>{t("analytics.byDepartment.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {departmentsQuery.isLoading && rangeIsUsable ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : departmentsQuery.isError ? (
              <p role="alert" className="py-16 text-center text-sm text-destructive">
                {getApiError(departmentsQuery.error, loadFailed)}
              </p>
            ) : departments.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground" data-testid="departments-empty">
                {t("analytics.byDepartment.empty")}
              </p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departments}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="Label" axisLine={false} tickLine={false} tick={{ fill: "#6b7280" }} reversed={isRtl} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280" }} orientation={isRtl ? "right" : "left"} />
                      <Tooltip cursor={{ fill: "#f3f4f6" }} contentStyle={tooltipStyle} formatter={(value: number) => money(value)} />
                      <Bar dataKey="Charged" name={t("analytics.byDepartment.series")} radius={[4, 4, 0, 0]} maxBarSize={50}>
                        {departments.map((row, index) => (
                          <Cell key={`bar-${row.DepartmentId ?? "unassigned"}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-sm font-medium">{t("analytics.byDepartment.share")}</p>
                  <p className="text-xs text-muted-foreground">{t("analytics.byDepartment.shareDesc")}</p>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={departments} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="Charged" nameKey="Label">
                          {departments.map((row, index) => (
                            <Cell key={`pie-${row.DepartmentId ?? "unassigned"}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => money(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {departments.map((row, index) => (
                      <li
                        key={row.DepartmentId ?? "unassigned"}
                        className="flex items-center justify-between gap-3 text-sm"
                        data-testid="department-row"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="truncate">{row.Label}</span>
                          <span className="text-xs text-muted-foreground">
                            {t("analytics.byDepartment.units", { units: formatNumber(row.Units) })}
                          </span>
                        </span>
                        <span dir="ltr" className="font-semibold tabular-nums">
                          {money(row.Charged)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------- 3. goal ---------------- */}
        <Can permission={PERMISSIONS.pricingManage}>
          <GoalWidget from={from} to={to} currency={currency} />
        </Can>
      </div>
    </div>
  );
};

export default FinancialAnalyticsPanel;
