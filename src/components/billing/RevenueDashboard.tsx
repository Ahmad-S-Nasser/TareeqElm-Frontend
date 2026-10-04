/**
 * The revenue dashboard body (phase 5, wave F2a).
 *
 * `revenue.view` is held by **Admin *and* Organization** by default — the platform is single-tenant, so "platform
 * revenue" is one figure and there is nothing to scope it to. Rather than build the screen twice, the whole body lives
 * here and the two thin pages (`AdminRevenue`, `OrganizationRevenue`) only supply their own shell, exactly the way
 * `RolesManager` is shared between `AdminRoles`/`OrganizationRoles` and `CatalogPricingManager` between the Admin and
 * Organization pricing surfaces. Both renders are byte-for-byte the same dashboard; if they ever diverge, that is a bug.
 *
 * Everything on screen is read-only and server-computed. The one piece of arithmetic the client does is turning the
 * server's 0..1 `RefundRate` into the 0..100 `formatPercent` expects — there is no total here that the UI added up.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Download,
  Loader2,
  Receipt,
  RotateCcw,
  TrendingUp,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RevenueChart } from "@/components/billing/RevenueChart";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { usePlatformCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { REVENUE_GRANULARITIES, type RevenueRange } from "@/hooks/useBilling";
import {
  DEFAULT_REVENUE_LIMIT,
  DEFAULT_REVENUE_PRESET,
  REVENUE_CURRENCIES,
  REVENUE_EXPORT_KINDS,
  REVENUE_PRESETS,
  isCompleteRange,
  presetRange,
  useExportRevenue,
  useRevenueByInstructorQuery,
  useRevenueSeriesQuery,
  useRevenueSummaryQuery,
  useRevenueTopItemsQuery,
  type RevenueExportKind,
  type RevenuePreset,
} from "@/hooks/useRevenue";

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  icon: typeof TrendingUp;
  tone: string;
  loading?: boolean;
  testId: string;
}

const Kpi = ({ label, value, hint, icon: Icon, tone, loading, testId }: KpiProps) => (
  <Card className="border-border/50 shadow-soft transition-all hover:shadow-lg">
    <CardContent className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p dir="ltr" className="text-start text-2xl font-black tabular-nums" data-testid={testId}>
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

// ---------------------------------------------------------------------------
// The dashboard
// ---------------------------------------------------------------------------

export const RevenueDashboard = () => {
  const { t } = useTranslation(["billing", "common"]);
  const { formatCurrency, formatDate, formatNumber, formatPercent } = useFormatters();
  const { toast } = useToast();
  const { currency: platformCurrency } = usePlatformCurrency();

  const initial = useMemo(() => presetRange(DEFAULT_REVENUE_PRESET)!, []);
  const [preset, setPreset] = useState<RevenuePreset>(DEFAULT_REVENUE_PRESET);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  // "" = whatever the platform's own currency is; the server resolves it and echoes it back on the summary.
  const [currency, setCurrency] = useState("");
  const [granularity, setGranularity] = useState<(typeof REVENUE_GRANULARITIES)[number]>("day");

  /** One filter object, handed unchanged to all five endpoints so no two cards can be looking at different windows. */
  const range: RevenueRange = useMemo(
    () => ({ from, to, currency: currency || undefined, granularity, limit: DEFAULT_REVENUE_LIMIT }),
    [from, to, currency, granularity]
  );
  const rangeIsUsable = isCompleteRange(range);

  const summaryQuery = useRevenueSummaryQuery(range);
  const seriesQuery = useRevenueSeriesQuery(range);
  const topItemsQuery = useRevenueTopItemsQuery(range);
  const byInstructorQuery = useRevenueByInstructorQuery(range);
  const exportRevenue = useExportRevenue();

  const summary = summaryQuery.data;
  // The summary is the authority on which currency these figures are in; until it lands, the platform default is the
  // honest guess (it is what the server will pick when the filter says nothing).
  const shownCurrency = summary?.Currency || currency || platformCurrency;
  const money = (amount: number | undefined) => formatCurrency(amount ?? 0, shownCurrency);

  const series = seriesQuery.data ?? [];
  const topItems = topItemsQuery.data ?? [];
  const byInstructor = byInstructorQuery.data ?? [];

  const applyPreset = (next: RevenuePreset) => {
    setPreset(next);
    const window = presetRange(next);
    if (window) {
      setFrom(window.from);
      setTo(window.to);
    }
  };

  const resetFilters = () => {
    applyPreset(DEFAULT_REVENUE_PRESET);
    setCurrency("");
    setGranularity("day");
  };

  const handleExport = async (kind: RevenueExportKind) => {
    try {
      const fileName = await exportRevenue.mutateAsync({ kind, range });
      toast({ title: t("billing:revenue.exported"), description: fileName });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("billing:common.exportFailed"),
        description: getApiError(error, t("billing:common.exportFailed")),
      });
    }
  };

  const currencyOptions = useMemo(
    () => [...new Set([platformCurrency, ...REVENUE_CURRENCIES])],
    [platformCurrency]
  );

  const loadFailed = t("billing:revenue.loadFailed");

  return (
    <div className="space-y-6">
      {/* ---------------- filters ---------------- */}
      <section
        aria-label={t("billing:revenue.filters")}
        className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-soft lg:flex-row lg:flex-wrap lg:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="revenue-preset">{t("billing:revenue.preset")}</Label>
          <Select value={preset} onValueChange={(next) => applyPreset(next as RevenuePreset)}>
            <SelectTrigger id="revenue-preset" className="lg:w-44" aria-label={t("billing:revenue.preset")}>
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
          <Label htmlFor="revenue-from">{t("billing:common.from")}</Label>
          <Input
            id="revenue-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset("custom");
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="revenue-to">{t("billing:common.to")}</Label>
          <Input
            id="revenue-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset("custom");
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="revenue-currency">{t("billing:common.currency")}</Label>
          <Select value={currency || "platform"} onValueChange={(next) => setCurrency(next === "platform" ? "" : next)}>
            <SelectTrigger id="revenue-currency" className="lg:w-40" aria-label={t("billing:common.currency")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="platform">{t("billing:revenue.platformCurrency", { currency: platformCurrency })}</SelectItem>
              {currencyOptions.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="revenue-granularity">{t("billing:common.granularity.label")}</Label>
          <Select
            value={granularity}
            onValueChange={(next) => setGranularity(next as (typeof REVENUE_GRANULARITIES)[number])}
          >
            <SelectTrigger
              id="revenue-granularity"
              className="lg:w-36"
              aria-label={t("billing:common.granularity.label")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVENUE_GRANULARITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`billing:common.granularity.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" onClick={resetFilters} className="lg:ms-auto">
          <RotateCcw className="me-2 h-4 w-4" />
          {t("common:actions.reset")}
        </Button>
      </section>

      {!rangeIsUsable && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("billing:revenue.invalidRange")}
        </p>
      )}

      {summaryQuery.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {getApiError(summaryQuery.error, loadFailed)}
        </p>
      )}

      {/* ---------------- KPIs ---------------- */}
      <section aria-label={t("billing:revenue.kpis")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          testId="kpi-gross"
          label={t("billing:revenue.grossRevenue")}
          hint={t("billing:revenue.grossRevenueHint")}
          value={money(summary?.GrossRevenue)}
          icon={TrendingUp}
          tone="bg-primary/10 text-primary"
          loading={summaryQuery.isLoading}
        />
        <Kpi
          testId="kpi-net"
          label={t("billing:revenue.netRevenue")}
          hint={t("billing:revenue.netRevenueHint")}
          value={money(summary?.NetRevenue)}
          icon={Wallet}
          tone="bg-emerald-500/10 text-emerald-500"
          loading={summaryQuery.isLoading}
        />
        <Kpi
          testId="kpi-refunds"
          label={t("billing:revenue.refunds")}
          hint={t("billing:revenue.refundsHint")}
          value={money(summary?.Refunds)}
          icon={Undo2}
          tone="bg-destructive/10 text-destructive"
          loading={summaryQuery.isLoading}
        />
        <Kpi
          testId="kpi-orders"
          label={t("billing:revenue.orderCount")}
          hint={`${t("billing:revenue.paidOrderCount")}: ${formatNumber(summary?.PaidOrderCount ?? 0)}`}
          value={formatNumber(summary?.OrderCount ?? 0)}
          icon={Receipt}
          tone="bg-blue-500/10 text-blue-500"
          loading={summaryQuery.isLoading}
        />
        <Kpi
          testId="kpi-aov"
          label={t("billing:revenue.averageOrderValue")}
          hint={t("billing:revenue.averageOrderValueHint")}
          value={money(summary?.AverageOrderValue)}
          icon={BarChart3}
          tone="bg-violet-500/10 text-violet-500"
          loading={summaryQuery.isLoading}
        />
        <Kpi
          testId="kpi-refund-rate"
          label={t("billing:revenue.refundRate")}
          hint={t("billing:revenue.refundRateHint")}
          // The server sends 0..1; formatPercent takes 0..100. This is the only sum the client is allowed to do.
          value={formatPercent((summary?.RefundRate ?? 0) * 100, { maximumFractionDigits: 1 })}
          icon={Undo2}
          tone="bg-amber-500/10 text-amber-500"
          loading={summaryQuery.isLoading}
        />
      </section>

      {/* ---------------- the split + exports ---------------- */}
      <Card className="border-border/50 shadow-soft">
        <CardContent className="flex flex-col gap-6 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("billing:revenue.discounts")}</p>
              <p className="text-lg font-semibold tabular-nums" data-testid="split-discounts">
                {money(summary?.Discounts)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("billing:revenue.platformFees")}</p>
              <p className="text-lg font-semibold tabular-nums" data-testid="split-platform-fees">
                {money(summary?.PlatformFees)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("billing:revenue.instructorEarnings")}</p>
              <p className="text-lg font-semibold tabular-nums" data-testid="split-instructor-earnings">
                {money(summary?.InstructorEarnings)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("billing:revenue.exportKind.label")}
            </p>
            <div className="flex flex-wrap gap-2">
              {REVENUE_EXPORT_KINDS.map((kind) => (
                <Button
                  key={kind}
                  variant="outline"
                  size="sm"
                  disabled={!rangeIsUsable || exportRevenue.isPending}
                  onClick={() => handleExport(kind)}
                >
                  {exportRevenue.isPending && exportRevenue.variables?.kind === kind ? (
                    <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="me-2 h-3.5 w-3.5" />
                  )}
                  {t(`billing:revenue.exportKind.${kind}`)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- over time ---------------- */}
      <Card className="border-border/50 shadow-soft">
        <CardHeader>
          <CardTitle>{t("billing:revenue.overTime")}</CardTitle>
          <CardDescription>
            {summary
              ? `${formatDate(summary.From)} – ${formatDate(summary.To)} · ${t("billing:revenue.currencyNote", {
                  currency: shownCurrency,
                })}`
              : t("billing:revenue.currencyNote", { currency: shownCurrency })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {seriesQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : seriesQuery.isError ? (
            <p role="alert" className="py-16 text-center text-sm text-destructive">
              {getApiError(seriesQuery.error, loadFailed)}
            </p>
          ) : (
            <RevenueChart data={series} currency={shownCurrency} />
          )}
        </CardContent>
      </Card>

      {/* ---------------- breakdowns ---------------- */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/50 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {t("billing:revenue.topItems")}
            </CardTitle>
            <CardDescription>{t("billing:revenue.topItemsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>{t("billing:revenue.item")}</TableHead>
                  <TableHead>{t("billing:revenue.units")}</TableHead>
                  <TableHead className="text-end">{t("billing:revenue.charged")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topItemsQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center">
                      <Loader2 className="inline h-6 w-6 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                )}
                {topItemsQuery.isError && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-destructive">
                      {getApiError(topItemsQuery.error, loadFailed)}
                    </TableCell>
                  </TableRow>
                )}
                {!topItemsQuery.isLoading && !topItemsQuery.isError && topItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      <p>{t("billing:revenue.empty")}</p>
                      <p className="mt-1 text-xs">{t("billing:revenue.emptyHint")}</p>
                    </TableCell>
                  </TableRow>
                )}
                {topItems.map((item) => (
                  <TableRow key={`${item.ItemType}-${item.ItemId}`} className="transition-colors hover:bg-muted/30">
                    <TableCell>
                      <div className="min-w-0">
                        {/* Resolved title first, the snapshot of what was bought second — never the raw id. */}
                        <p className="truncate font-medium">
                          {item.Title ?? (item.TitleSnapshot || t("billing:common.unknownItem"))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(`billing:common.itemType.${item.ItemType}`, { defaultValue: item.ItemType })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatNumber(item.Units)}</TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {formatCurrency(item.Charged, shownCurrency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {t("billing:revenue.byInstructor")}
            </CardTitle>
            <CardDescription>{t("billing:revenue.byInstructorHint")}</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>{t("billing:revenue.instructor")}</TableHead>
                  <TableHead className="text-end">{t("billing:revenue.platformFee")}</TableHead>
                  <TableHead className="text-end">{t("billing:revenue.instructorNet")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byInstructorQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center">
                      <Loader2 className="inline h-6 w-6 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                )}
                {byInstructorQuery.isError && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-destructive">
                      {getApiError(byInstructorQuery.error, loadFailed)}
                    </TableCell>
                  </TableRow>
                )}
                {!byInstructorQuery.isLoading && !byInstructorQuery.isError && byInstructor.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      <p>{t("billing:revenue.empty")}</p>
                      <p className="mt-1 text-xs">{t("billing:revenue.emptyHint")}</p>
                    </TableCell>
                  </TableRow>
                )}
                {byInstructor.map((row) => (
                  <TableRow key={row.InstructorId} className="transition-colors hover:bg-muted/30">
                    <TableCell>
                      <div className="min-w-0">
                        {/* A deleted account resolves to null — say so, never print the id. */}
                        <p className="truncate font-medium">
                          {row.InstructorName ?? t("billing:common.unknownUser")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("billing:revenue.units")}: {formatNumber(row.Units)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatCurrency(row.PlatformFee, shownCurrency)}
                    </TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {formatCurrency(row.InstructorNet, shownCurrency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RevenueDashboard;
