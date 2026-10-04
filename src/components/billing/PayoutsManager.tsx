/**
 * Paying instructors out, and the per-instructor commission override (catalog v12's ownership-based split).
 *
 * The body lives in its own component (rather than in the page) so the same create-form/table/commission-list can be
 * mounted under the Admin shell (`AdminPayouts`) as well as the Organization one (`OrganizationPayouts`), the way
 * `CatalogPricingManager`/`CouponsManager` are shared. The backend scopes every payout and instructor-picker row by
 * ownership (the same "null owner" convention Course/Order/Enrollment/Coupon use): Admin pays platform instructors
 * only, Organization its own tenant's — nothing here needs to know which caller it is.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/components/routing/Can";
import { Banknote, Check, Download, Loader2, Percent, Plus, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { PAYOUT_METHODS, PAYOUT_STATUSES, type PayoutMethod, type PayoutStatus } from "@/hooks/useBilling";
import {
    INSTRUCTORS_PAGE_SIZE, PAYOUTS_PAGE_SIZE, payoutCan, useAdminPayoutsQuery, useApprovePayout,
    useCancelPayout, useCommissionRateQuery, useCreatePayout, useDefaultCommissionRate,
    useDownloadPayoutStatement, useEligibleEarningsQuery, useInstructorOptionsQuery, useMarkPayoutPaid,
    useSetCommissionOverride, type Payout,
} from "@/hooks/usePayouts";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { usePlatformCurrency } from "@/lib/money";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const ALL = "all";
const day = (date: Date) => date.toISOString().slice(0, 10);

const STATUS_CLASSES: Record<PayoutStatus, string> = {
    Draft: "border-border bg-muted text-muted-foreground",
    Approved: "border-primary/30 bg-primary/10 text-primary",
    Paid: "border-success/30 bg-success/10 text-success",
    Cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

/**
 * One row of the commission table. The effective rate is read per instructor because the API exposes it nowhere else
 * (see `useCommissionRateQuery`); clearing the field reverts the instructor to the platform default.
 */
const CommissionRow = ({
    instructorId, name, email, canManage, defaultRate,
}: {
    instructorId: string;
    name: string;
    email: string;
    canManage: boolean;
    defaultRate: number | null;
}) => {
    const { t } = useTranslation(["billing", "common"]);
    const { formatPercent } = useFormatters();
    const { toast } = useToast();
    const { rate, usesDefault, isLoading, isError } = useCommissionRateQuery(instructorId);
    const setCommission = useSetCommissionOverride();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState("");

    const startEditing = () => {
        setValue(usesDefault || rate === null ? "" : String(Math.round(rate * 1000) / 10));
        setEditing(true);
    };

    const save = (clear: boolean) => {
        let commissionRate: number | null = null;
        if (!clear) {
            const percent = Number(value.trim());
            if (value.trim() === "" || !Number.isFinite(percent) || percent < 0 || percent > 100) {
                toast({ variant: "destructive", title: t("billing:payout.commission.invalid") });
                return;
            }
            commissionRate = Math.round(percent * 10) / 1000;
        }
        setCommission.mutate(
            { instructorId, commissionRate },
            {
                onSuccess: () => { setEditing(false); toast({ title: t("billing:payout.commission.done") }); },
                onError: (err: unknown) => toast({
                    variant: "destructive",
                    title: t("billing:payout.commission.failed"),
                    description: getApiError(err, t("billing:payout.commission.failed")),
                }),
            }
        );
    };

    return (
        <tr className="border-b border-border/30">
            <td className="px-5 py-3">
                <p className="font-semibold">{name}</p>
                <p dir="ltr" className="text-xs text-muted-foreground text-start">{email}</p>
            </td>
            <td className="px-5 py-3">
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : isError || rate === null ? (
                    <span className="text-muted-foreground">{t("billing:common.notSet")}</span>
                ) : (
                    <span className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{formatPercent(rate * 100, { maximumFractionDigits: 1 })}</span>
                        <Badge variant="outline" className="text-[10px]">
                            {usesDefault ? t("billing:payout.eligible.usesDefaultRate") : t("billing:payout.commission.ownRate")}
                        </Badge>
                    </span>
                )}
            </td>
            <td className="px-5 py-3 text-end">
                {!canManage ? null : editing ? (
                    <div className="flex items-center justify-end gap-2">
                        <Input
                            type="number" min={0} max={100} inputMode="decimal" className="w-24"
                            aria-label={t("billing:payout.commission.rate")}
                            value={value} onChange={(e) => setValue(e.target.value)}
                            placeholder={defaultRate === null ? "" : String(Math.round(defaultRate * 1000) / 10)}
                        />
                        <Button size="sm" onClick={() => save(false)} disabled={setCommission.isPending}>
                            {setCommission.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            <span className="ms-1">{t("billing:payout.commission.submit")}</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => save(true)} disabled={setCommission.isPending}>
                            {t("billing:payout.commission.reset")}
                        </Button>
                        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => setEditing(false)}
                            aria-label={t("billing:common.cancel")}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                ) : (
                    <Button size="sm" variant="outline" onClick={startEditing}>
                        <Percent className="w-3.5 h-3.5 me-1" /> {t("billing:payout.commission.edit")}
                    </Button>
                )}
            </td>
        </tr>
    );
};

export const PayoutsManager = () => {
    const { t } = useTranslation(["billing", "common"]);
    const { formatCurrency, formatDate, formatNumber, formatPercent } = useFormatters();
    const { toast } = useToast();
    const { can } = usePermissions();
    const { currency: platformCurrency } = usePlatformCurrency();
    const canManage = can(PERMISSIONS.payoutsManage);

    // --- create ---
    const monthStart = useMemo(() => { const d = new Date(); return day(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))); }, []);
    const today = useMemo(() => day(new Date()), []);
    const [instructorId, setInstructorId] = useState("");
    const [periodStart, setPeriodStart] = useState(monthStart);
    const [periodEnd, setPeriodEnd] = useState(today);
    const [method, setMethod] = useState<PayoutMethod>("BankTransfer");
    const [notes, setNotes] = useState("");

    // --- list ---
    const [filterInstructor, setFilterInstructor] = useState(ALL);
    const [filterStatus, setFilterStatus] = useState(ALL);
    const [page, setPage] = useState(1);

    // --- commission ---
    const [commissionSearch, setCommissionSearch] = useState("");
    const [commissionPage, setCommissionPage] = useState(1);

    // --- dialogs ---
    const [approving, setApproving] = useState<Payout | null>(null);
    const [cancelling, setCancelling] = useState<Payout | null>(null);
    const [payingOut, setPayingOut] = useState<Payout | null>(null);
    const [reference, setReference] = useState("");
    const [paidAt, setPaidAt] = useState(today);

    const { data: roster, isError: rosterError } = useInstructorOptionsQuery("", 1, 100);
    const instructors = roster?.items ?? [];

    const eligible = useEligibleEarningsQuery(instructorId || null, { from: periodStart, to: periodEnd });

    const { data, isLoading, isError, error, isFetching } = useAdminPayoutsQuery({
        instructorId: filterInstructor === ALL ? undefined : filterInstructor,
        status: filterStatus === ALL ? undefined : filterStatus,
        page,
        pageSize: PAYOUTS_PAGE_SIZE,
    });
    const payouts = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAYOUTS_PAGE_SIZE));

    const { data: commissionPageData, isLoading: commissionLoading, isError: commissionError } =
        useInstructorOptionsQuery(commissionSearch, commissionPage, INSTRUCTORS_PAGE_SIZE);
    const commissionRows = commissionPageData?.items ?? [];
    const commissionTotal = commissionPageData?.total ?? 0;
    const commissionPages = Math.max(1, Math.ceil(commissionTotal / INSTRUCTORS_PAGE_SIZE));
    const { rate: defaultRate } = useDefaultCommissionRate();

    const createPayout = useCreatePayout();
    const approvePayout = useApprovePayout();
    const markPaid = useMarkPayoutPaid();
    const cancelPayout = useCancelPayout();
    const downloadStatement = useDownloadPayoutStatement();

    const fail = (titleKey: string) => (err: unknown) =>
        toast({ variant: "destructive", title: t(titleKey), description: getApiError(err, t(titleKey)) });

    const handleCreate = () => {
        if (!instructorId) return;
        createPayout.mutate(
            {
                InstructorId: instructorId,
                PeriodStart: `${periodStart}T00:00:00Z`,
                PeriodEnd: `${periodEnd}T00:00:00Z`,
                Method: method,
                Notes: notes.trim() || null,
                Currency: eligible.data?.Currency ?? null,
            },
            {
                onSuccess: () => { setNotes(""); toast({ title: t("billing:payout.create.done") }); },
                onError: fail("billing:payout.create.failed"),
            }
        );
    };

    const handleApprove = () => {
        if (!approving) return;
        approvePayout.mutate(approving.Id, {
            onSuccess: () => { setApproving(null); toast({ title: t("billing:payout.approve.done") }); },
            onError: fail("billing:payout.approve.failed"),
        });
    };

    const handleCancel = () => {
        if (!cancelling) return;
        cancelPayout.mutate(cancelling.Id, {
            onSuccess: () => { setCancelling(null); toast({ title: t("billing:payout.cancel.done") }); },
            onError: fail("billing:payout.cancel.failed"),
        });
    };

    const handleMarkPaid = () => {
        if (!payingOut) return;
        if (!reference.trim()) {
            toast({ variant: "destructive", title: t("billing:payout.markPaid.referenceRequired") });
            return;
        }
        markPaid.mutate(
            { id: payingOut.Id, body: { Reference: reference.trim(), PaidAt: paidAt ? `${paidAt}T00:00:00Z` : null } },
            {
                onSuccess: () => { setPayingOut(null); setReference(""); toast({ title: t("billing:payout.markPaid.done") }); },
                onError: fail("billing:payout.markPaid.failed"),
            }
        );
    };

    const handleStatement = (payout: Payout) =>
        downloadStatement.mutate(payout.Id, {
            onSuccess: () => toast({ title: t("billing:payout.statement.done") }),
            onError: fail("billing:payout.statement.failed"),
        });

    const previewAmount = eligible.data?.Amount ?? 0;
    const nothingPayable = !!eligible.data && previewAmount <= 0;

    return (
        <>
            <div>
                <h1 className="text-3xl font-black">{t("billing:payout.title")}</h1>
                <p className="text-muted-foreground text-sm mt-1">{t("billing:payout.subtitle")}</p>
            </div>

            {/* Create a payout: pick an instructor and a window, see exactly what would be swept, then create it. */}
            <Can permission={PERMISSIONS.payoutsManage}>
                <Card className="border-border/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{t("billing:payout.create.title")}</CardTitle>
                        <p className="text-xs text-muted-foreground">{t("billing:payout.create.description")}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-2">
                                <Label>{t("billing:payout.instructor")}</Label>
                                <Select value={instructorId} onValueChange={setInstructorId}>
                                    <SelectTrigger aria-label={t("billing:payout.instructor")}>
                                        <SelectValue placeholder={t("billing:payout.selectInstructor")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {instructors.map((i) => <SelectItem key={i.Id} value={i.Id}>{i.FullName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {rosterError && <p className="text-xs text-destructive">{t("billing:payout.instructorsLoadFailed")}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="payout-from">{t("billing:payout.periodStart")}</Label>
                                <Input id="payout-from" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="payout-to">{t("billing:payout.periodEnd")}</Label>
                                <Input id="payout-to" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("billing:payout.method")}</Label>
                                <Select value={method} onValueChange={(v) => setMethod(v as PayoutMethod)}>
                                    <SelectTrigger aria-label={t("billing:payout.method")}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PAYOUT_METHODS.map((m) => (
                                            <SelectItem key={m} value={m}>{t(`billing:payout.methodValue.${m}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="payout-notes">{t("billing:payout.notes")}</Label>
                            <Textarea id="payout-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>

                        {/* Preview — the very numbers the create would sweep. */}
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                            {!instructorId ? (
                                <p className="text-sm text-muted-foreground">{t("billing:payout.pickInstructorHint")}</p>
                            ) : eligible.isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            ) : eligible.isError ? (
                                <p className="text-sm text-destructive">{getApiError(eligible.error, t("billing:common.loadFailed"))}</p>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t("billing:payout.eligible.payableNow")}</p>
                                            <p className="text-2xl font-black tabular-nums" data-testid="eligible-amount">
                                                {formatCurrency(previewAmount, eligible.data?.Currency ?? platformCurrency)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {t("billing:payout.earningCount", { count: eligible.data?.EarningCount ?? 0 })}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t("billing:payout.eligible.stillOnHold")}</p>
                                            <p className="text-lg font-bold tabular-nums">
                                                {formatCurrency(eligible.data?.PendingAmount ?? 0, eligible.data?.Currency ?? platformCurrency)}
                                            </p>
                                            {eligible.data?.NextAvailableAt && (
                                                <p className="text-xs text-muted-foreground">
                                                    {t("billing:payout.eligible.nextAvailableAt", { date: formatDate(eligible.data.NextAvailableAt) })}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t("billing:payout.eligible.commissionRate")}</p>
                                            <p className="text-lg font-bold tabular-nums">
                                                {formatPercent((eligible.data?.CommissionRate ?? 0) * 100, { maximumFractionDigits: 1 })}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {eligible.data?.UsesDefaultCommissionRate
                                                    ? t("billing:payout.eligible.usesDefaultRate")
                                                    : t("billing:payout.eligible.usesOwnRate")}
                                            </p>
                                        </div>
                                    </div>

                                    {!!eligible.data?.Ripened && (
                                        <p className="text-xs text-muted-foreground">
                                            {t("billing:payout.eligible.ripened", { count: eligible.data.Ripened })}
                                        </p>
                                    )}
                                    {Object.keys(eligible.data?.OtherCurrencies ?? {}).length > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            {t("billing:payout.eligible.otherCurrencies")}:{" "}
                                            {Object.entries(eligible.data!.OtherCurrencies)
                                                .map(([code, amount]) => formatCurrency(amount, code))
                                                .join(" · ")}
                                        </p>
                                    )}
                                    {nothingPayable && (
                                        <p className="text-sm text-muted-foreground">{t("billing:payout.create.nothingPayable")}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleCreate} disabled={!instructorId || nothingPayable || createPayout.isPending || eligible.isLoading}>
                                {createPayout.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Plus className="w-4 h-4 me-2" />}
                                {t("billing:payout.create.submit")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </Can>

            {/* Payouts */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Select value={filterInstructor} onValueChange={(v) => { setFilterInstructor(v); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-60" aria-label={t("billing:payout.instructor")}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("billing:payout.allInstructors")}</SelectItem>
                        {instructors.map((i) => <SelectItem key={i.Id} value={i.Id}>{i.FullName}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-52" aria-label={t("billing:common.status")}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("billing:common.allStatuses")}</SelectItem>
                        {PAYOUT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{t(`billing:payoutStatus.${s}`)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:payout.instructor")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:payout.amount")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("billing:payout.period")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("billing:payout.earningsCovered")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:common.status")}</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && (
                                    <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></td></tr>
                                )}
                                {isError && (
                                    <tr><td colSpan={6} className="text-center py-12 text-destructive">{getApiError(error, t("billing:payout.loadFailed"))}</td></tr>
                                )}
                                {payouts.map((payout) => {
                                    const allowed = payoutCan(payout.Status);
                                    return (
                                        <tr key={payout.Id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", isFetching && "opacity-70")}>
                                            <td className="px-5 py-3.5 font-semibold">{payout.InstructorName ?? t("billing:common.unknownUser")}</td>
                                            <td className="px-5 py-3.5 font-semibold tabular-nums">{formatCurrency(payout.Amount, payout.Currency)}</td>
                                            <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground whitespace-nowrap">
                                                {formatDate(payout.PeriodStart)} – {formatDate(payout.PeriodEnd)}
                                            </td>
                                            <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground tabular-nums">
                                                {formatNumber(payout.EarningCount)}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <Badge variant="outline" className={cn("text-xs font-semibold", STATUS_CLASSES[payout.Status])}>
                                                    {t(`billing:payoutStatus.${payout.Status}`)}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-3.5 text-end whitespace-nowrap space-x-1 rtl:space-x-reverse">
                                                <Can permission={PERMISSIONS.payoutsManage}>
                                                    {allowed.approve && (
                                                        <Button size="sm" variant="outline" onClick={() => setApproving(payout)}>
                                                            {t("billing:payout.approve.action")}
                                                        </Button>
                                                    )}
                                                    {allowed.markPaid && (
                                                        <Button size="sm" onClick={() => { setPayingOut(payout); setReference(payout.Reference ?? ""); setPaidAt(today); }}>
                                                            {t("billing:payout.markPaid.action")}
                                                        </Button>
                                                    )}
                                                    {allowed.cancel && (
                                                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelling(payout)}>
                                                            {t("billing:payout.cancel.action")}
                                                        </Button>
                                                    )}
                                                </Can>
                                                <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleStatement(payout)}
                                                    disabled={downloadStatement.isPending} aria-label={t("billing:payout.statement.action")}>
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!isLoading && !isError && payouts.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12">
                                            <Banknote className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                                            <p className="text-muted-foreground">{t("billing:payout.empty")}</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {total > PAYOUTS_PAGE_SIZE && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        {t("billing:payout.pageInfo", { page: formatNumber(page), pages: formatNumber(totalPages), count: total })}
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common:actions.previous")}</Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("common:actions.next")}</Button>
                    </div>
                </div>
            )}

            {/* Commission */}
            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("billing:payout.commission.title")}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t("billing:payout.commission.subtitle")}</p>
                    {defaultRate !== null && (
                        <p className="text-xs text-muted-foreground">
                            {t("billing:payout.commission.defaultRate", { rate: formatPercent(defaultRate * 100, { maximumFractionDigits: 1 }) })}
                        </p>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative max-w-sm">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input className="ps-9" placeholder={t("billing:payout.commission.searchPlaceholder")}
                            value={commissionSearch} aria-label={t("billing:payout.commission.searchPlaceholder")}
                            onChange={(e) => { setCommissionSearch(e.target.value); setCommissionPage(1); }} />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:payout.instructor")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:payout.commission.rate")}</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {commissionLoading && (
                                    <tr><td colSpan={3} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary inline" /></td></tr>
                                )}
                                {commissionError && (
                                    <tr><td colSpan={3} className="text-center py-10 text-destructive">{t("billing:payout.instructorsLoadFailed")}</td></tr>
                                )}
                                {commissionRows.map((row) => (
                                    <CommissionRow key={row.Id} instructorId={row.Id} name={row.FullName} email={row.Email}
                                        canManage={canManage} defaultRate={defaultRate} />
                                ))}
                                {!commissionLoading && !commissionError && commissionRows.length === 0 && (
                                    <tr><td colSpan={3} className="text-center py-10 text-muted-foreground">{t("billing:payout.commission.empty")}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {commissionTotal > INSTRUCTORS_PAGE_SIZE && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                {t("billing:payout.commission.pageInfo", { page: formatNumber(commissionPage), pages: formatNumber(commissionPages), count: commissionTotal })}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={commissionPage <= 1} onClick={() => setCommissionPage((p) => p - 1)}>{t("common:actions.previous")}</Button>
                                <Button variant="outline" size="sm" disabled={commissionPage >= commissionPages} onClick={() => setCommissionPage((p) => p + 1)}>{t("common:actions.next")}</Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Approve */}
            <AlertDialog open={!!approving} onOpenChange={(open) => !open && setApproving(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("billing:payout.approve.confirm")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {approving ? `${approving.InstructorName ?? t("billing:common.unknownUser")} · ${formatCurrency(approving.Amount, approving.Currency)}` : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("billing:common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove} disabled={approvePayout.isPending}>
                            {approvePayout.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("billing:payout.approve.action")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Cancel */}
            <AlertDialog open={!!cancelling} onOpenChange={(open) => !open && setCancelling(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("billing:payout.cancel.confirm")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("billing:payout.cancel.confirmHint")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("billing:common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancel} disabled={cancelPayout.isPending}>
                            {cancelPayout.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("billing:payout.cancel.action")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Mark paid */}
            <Dialog open={!!payingOut} onOpenChange={(open) => !open && setPayingOut(null)}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>{t("billing:payout.markPaid.title")}</DialogTitle>
                        <DialogDescription>{t("billing:payout.markPaid.description")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="payout-reference">{t("billing:payout.markPaid.reference")}</Label>
                            <Input id="payout-reference" dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="payout-paid-at">{t("billing:payout.markPaid.paidAt")}</Label>
                            <Input id="payout-paid-at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPayingOut(null)}>{t("billing:common.cancel")}</Button>
                        <Button onClick={handleMarkPaid} disabled={markPaid.isPending}>
                            {markPaid.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("billing:payout.markPaid.submit")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
