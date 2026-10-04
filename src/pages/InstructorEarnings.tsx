/**
 * "My earnings" (phase 5, wave F1c) — the instructor's own, strictly read-only revenue view.
 *
 * Two product rules shape this page and neither may be softened without revisiting the plan:
 *
 *  1. **No pricing controls, anywhere.** Pricing authority belongs to Organization/Admin (`pricing.manage`), not to the
 *     instructor. An instructor earns from sales of the courses they teach; they never set the price. The only pricing
 *     surface in the product is `OrganizationCatalogPricing`.
 *  2. **No buyer.** The backend's `EarningDto` deliberately carries no user id, name or email — an instructor sees what
 *     sold, when, for how much and under which order id, never who bought it. This page therefore has no buyer column,
 *     no buyer lookup and no derivation of one from an order id; `BuyerCount` (+1 per sale, -1 per reversal) is the
 *     only shape in which a buyer appears, and it is a count, not an identity.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownRight, ArrowUpRight, Loader2, Wallet } from "lucide-react";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { DEFAULT_CURRENCY } from "@/lib/money";
import { cn } from "@/lib/utils";
import { EARNING_STATUSES, type EarningStatus } from "@/hooks/useBilling";
import {
  useEarningsLedgerQuery,
  useEarningsSummaryQuery,
  useInstructorPayoutsQuery,
  type EarningRow,
} from "@/hooks/useEarnings";

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<EarningStatus, string> = {
  Pending: "bg-warning/10 text-warning border-warning/30",
  Available: "bg-success/10 text-success border-success/30",
  Paid: "bg-primary/10 text-primary border-primary/30",
  Reversed: "bg-destructive/10 text-destructive border-destructive/30",
};

const BalanceCard = ({
  label,
  hint,
  value,
  tone,
}: {
  label: string;
  hint: string;
  value: string;
  tone: string;
}) => (
  <Card className="border-border/50">
    <CardContent className="space-y-1 p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </CardContent>
  </Card>
);

/** The item a ledger row is for, resolved to a title — never an id. */
const LedgerItem = ({ row }: { row: EarningRow }) => {
  const { t } = useTranslation("billing");
  // `ResolvedTitle` is the item's name today; `Title` is the snapshot taken when it sold. Never fall back to an id.
  const title = row.ResolvedTitle ?? row.Title ?? t("common.unknownItem");
  const showCourse = row.ItemType === "Chapter" && !!row.CourseTitle;
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">
        {t(`common.itemType.${row.ItemType}`, { defaultValue: row.ItemType })}
        {showCourse && ` · ${t("earnings.inCourse", { course: row.CourseTitle })}`}
      </p>
    </div>
  );
};

const InstructorEarnings = () => {
  const { t } = useTranslation(["billing", "common"]);
  const { formatCurrency, formatDate, formatNumber, formatPercent } = useFormatters();

  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const range = { from: from || undefined, to: to || undefined };
  const summaryQuery = useEarningsSummaryQuery(range);
  const ledgerQuery = useEarningsLedgerQuery({
    ...range,
    status: status === "all" ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  });
  const payoutsQuery = useInstructorPayoutsQuery(1, PAGE_SIZE);

  const summary = summaryQuery.data;
  const currency = summary?.Currency || DEFAULT_CURRENCY;
  const money = (amount: number | undefined) => formatCurrency(amount ?? 0, currency);

  const rows = ledgerQuery.data?.items ?? [];
  const total = ledgerQuery.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const payouts = payoutsQuery.data?.items ?? [];

  const resetFilters = () => {
    setStatus("all");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <InstructorPageLayout>
      <div className="animate-slide-up">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Wallet className="h-8 w-8 text-accent" />
          {t("billing:earnings.title")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("billing:earnings.subtitle")}</p>
      </div>

      {/* ---------------- summary ---------------- */}
      <section className="space-y-3" aria-label={t("billing:earnings.balances")}>
        {summaryQuery.isLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
        {summaryQuery.isError && (
          <p className="text-sm text-destructive">
            {getApiError(summaryQuery.error, t("billing:earnings.loadFailed"))}
          </p>
        )}
        {summary && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <BalanceCard
                label={t("billing:earnings.pending")}
                hint={t("billing:earnings.pendingHint")}
                value={money(summary.Pending)}
                tone="text-warning"
              />
              <BalanceCard
                label={t("billing:earnings.available")}
                hint={t("billing:earnings.availableHint")}
                value={money(summary.Available)}
                tone="text-success"
              />
              <BalanceCard
                label={t("billing:earnings.paid")}
                hint={t("billing:earnings.paidHint")}
                value={money(summary.Paid)}
                tone="text-primary"
              />
              <BalanceCard
                label={t("billing:earnings.reversed")}
                hint={t("billing:earnings.reversedHint")}
                value={money(summary.Reversed)}
                tone="text-destructive"
              />
            </div>

            <Card className="border-border/50">
              <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t("billing:earnings.lifetimeGross")}</p>
                  <p className="text-lg font-semibold tabular-nums">{money(summary.LifetimeGross)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t("billing:earnings.lifetimeNet")}</p>
                  <p className="text-lg font-semibold tabular-nums">{money(summary.LifetimeNet)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t("billing:earnings.commissionRate")}</p>
                  <p className="text-lg font-semibold tabular-nums" data-testid="commission-rate">
                    {formatPercent(summary.CommissionRate * 100)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("billing:earnings.yourShare")}: {formatPercent((1 - summary.CommissionRate) * 100)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      {/* ---------------- ledger ---------------- */}
      <section className="space-y-3" aria-label={t("billing:earnings.ledger")}>
        <div>
          <h2 className="text-xl font-bold">{t("billing:earnings.ledger")}</h2>
          <p className="text-sm text-muted-foreground">{t("billing:earnings.ledgerHint")}</p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="earnings-status">{t("billing:common.status")}</Label>
            <Select
              value={status}
              onValueChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
            >
              <SelectTrigger id="earnings-status" className="sm:w-44" aria-label={t("billing:common.status")}>
                <SelectValue placeholder={t("billing:common.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("billing:common.allStatuses")}</SelectItem>
                {EARNING_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`billing:earnings.status.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="earnings-from">{t("billing:common.from")}</Label>
            <Input
              id="earnings-from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="earnings-to">{t("billing:common.to")}</Label>
            <Input
              id="earnings-to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button variant="ghost" onClick={resetFilters}>
            {t("common:actions.reset")}
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>{t("billing:earnings.occurredAt")}</TableHead>
                <TableHead>{t("billing:earnings.item")}</TableHead>
                <TableHead>{t("billing:earnings.kindLabel")}</TableHead>
                <TableHead>{t("billing:common.status")}</TableHead>
                <TableHead className="text-end">{t("billing:earnings.net")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center">
                    <Loader2 className="inline h-6 w-6 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              )}
              {ledgerQuery.isError && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-destructive">
                    {getApiError(ledgerQuery.error, t("billing:earnings.loadFailed"))}
                  </TableCell>
                </TableRow>
              )}
              {!ledgerQuery.isLoading && !ledgerQuery.isError && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <p>{t("billing:earnings.empty")}</p>
                    <p className="mt-1 text-xs">{t("billing:earnings.emptyHint")}</p>
                  </TableCell>
                </TableRow>
              )}
              {!ledgerQuery.isLoading &&
                !ledgerQuery.isError &&
                rows.map((row) => (
                  <TableRow key={row.Id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(row.OccurredAt)}
                    </TableCell>
                    <TableCell>
                      <LedgerItem row={row} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        {row.Kind === "Reversal" ? (
                          <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                        )}
                        {t(`billing:earnings.kind.${row.Kind}`, { defaultValue: row.Kind })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", STATUS_BADGE[row.Status])}>
                        {t(`billing:earnings.status.${row.Status}`, { defaultValue: row.Status })}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-end font-semibold tabular-nums",
                        row.NetAmount < 0 ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {formatCurrency(row.NetAmount, row.Currency || currency)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">{t("billing:earnings.noBuyerNote")}</p>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("common:resultsCount", { count: total })}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t("common:actions.previous")}
              </Button>
              <span className="text-sm tabular-nums">
                {formatNumber(page)} / {formatNumber(lastPage)}
              </span>
              <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                {t("common:actions.next")}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- payouts ---------------- */}
      <section className="space-y-3" aria-label={t("billing:payout.myTitle")}>
        <h2 className="text-xl font-bold">{t("billing:payout.myTitle")}</h2>

        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>{t("billing:payout.amount")}</TableHead>
                <TableHead>{t("billing:payout.period")}</TableHead>
                <TableHead>{t("billing:common.status")}</TableHead>
                <TableHead>{t("billing:payout.method")}</TableHead>
                <TableHead>{t("billing:payout.reference")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payoutsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <Loader2 className="inline h-5 w-5 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              )}
              {payoutsQuery.isError && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-destructive">
                    {getApiError(payoutsQuery.error, t("billing:payout.loadFailed"))}
                  </TableCell>
                </TableRow>
              )}
              {!payoutsQuery.isLoading && !payoutsQuery.isError && payouts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t("billing:payout.myEmpty")}
                  </TableCell>
                </TableRow>
              )}
              {payouts.map((payout) => (
                <TableRow key={payout.Id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="font-semibold tabular-nums">
                    {formatCurrency(payout.Amount, payout.Currency || currency)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(payout.PeriodStart)} – {formatDate(payout.PeriodEnd)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {t(`billing:payoutStatus.${payout.Status}`, { defaultValue: payout.Status })}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t(`billing:payout.methodValue.${payout.Method}`, { defaultValue: payout.Method })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {payout.Reference || t("billing:common.none")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </InstructorPageLayout>
  );
};

export default InstructorEarnings;
