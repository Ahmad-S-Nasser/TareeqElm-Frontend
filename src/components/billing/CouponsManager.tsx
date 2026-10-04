/**
 * Discount codes (catalog v12's ownership-based split): the Organization/Admin surface for coupons.manage.
 *
 * The body lives in its own component (rather than in the page) so the same table/dialogs can be mounted under the
 * Admin shell (`AdminCoupons`) as well as the Organization one (`OrganizationCoupons`), the way `CatalogPricingManager`
 * is shared between `AdminCatalogPricing`/`OrganizationCatalogPricing`. The backend scopes every coupon by ownership
 * (the same "null owner" convention Course/Order/Enrollment/Payout use): Admin manages platform-owned coupons only,
 * Organization its own tenant's — nothing here needs to know which caller it is, the API already answers scoped.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/billing/MoneyInput";
import { Can } from "@/components/routing/Can";
import { Loader2, Pencil, Plus, Search, Ticket, Trash2, Users2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useCatalogCoursesQuery, useCourseChaptersQuery } from "@/hooks/usePricing";
import {
    COUPONS_PAGE_SIZE, REDEMPTIONS_PAGE_SIZE, useAdminCouponsQuery, useCouponRedemptionsQuery,
    useCreateCoupon, useDeleteCoupon, useTrackOptionsQuery, useUpdateCoupon,
    type Coupon, type CouponScope, type CouponWrite,
} from "@/hooks/useCoupons";
import { COUPON_KINDS, type CouponKind, type PurchasableItemType } from "@/hooks/useBilling";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { usePlatformCurrency } from "@/lib/money";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const ALL = "all";

/** Dates ride the wire as ISO-8601 but are edited as bare `yyyy-mm-dd` days. */
const toDayInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const toIsoDay = (day: string) => (day ? new Date(`${day}T00:00:00Z`).toISOString() : null);

interface CouponForm {
    code: string;
    description: string;
    kind: CouponKind;
    /** Kept as text: an empty percentage field is not the same as 0. */
    percentage: string;
    amountOff: number | null;
    currency: string;
    minSubtotal: number | null;
    maxRedemptions: string;
    maxRedemptionsPerUser: string;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
    appliesTo: CouponScope[];
    /** Parallel to `appliesTo`: the course a Chapter scope was picked from (dialog-only, never sent). */
    scopeCourseIds: string[];
}

const emptyForm = (currency: string): CouponForm => ({
    code: "",
    description: "",
    kind: "Percentage",
    percentage: "",
    amountOff: null,
    currency,
    minSubtotal: null,
    maxRedemptions: "",
    maxRedemptionsPerUser: "1",
    startsAt: "",
    endsAt: "",
    isActive: true,
    appliesTo: [],
    scopeCourseIds: [],
});

const formOf = (coupon: Coupon, fallbackCurrency: string): CouponForm => ({
    code: coupon.Code,
    description: coupon.Description ?? "",
    kind: coupon.Kind,
    percentage: coupon.Percentage === null ? "" : String(coupon.Percentage),
    amountOff: coupon.AmountOff,
    currency: coupon.Currency ?? fallbackCurrency,
    minSubtotal: coupon.MinSubtotal,
    maxRedemptions: coupon.MaxRedemptions === null ? "" : String(coupon.MaxRedemptions),
    maxRedemptionsPerUser: String(coupon.MaxRedemptionsPerUser),
    startsAt: toDayInput(coupon.StartsAt),
    endsAt: toDayInput(coupon.EndsAt),
    isActive: coupon.IsActive,
    appliesTo: coupon.AppliesTo.map((s) => ({ ...s })),
    scopeCourseIds: coupon.AppliesTo.map(() => ""),
});

/**
 * One restriction row: what kind of item, then which one — or "any item of this type". A chapter needs its course
 * picked first, because chapters are only ever listed through the course they belong to.
 */
const ScopeRow = ({
    scope, courseId, onChange, onRemove, disabled,
}: {
    scope: CouponScope;
    courseId: string;
    onChange: (scope: CouponScope, courseId: string) => void;
    onRemove: () => void;
    disabled?: boolean;
}) => {
    const { t } = useTranslation(["billing", "common"]);
    const { data: courses = [] } = useCatalogCoursesQuery({ pageSize: 200 });
    const { data: tracks = [] } = useTrackOptionsQuery();
    const { data: chapters = [] } = useCourseChaptersQuery(scope.ItemType === "Chapter" ? courseId || null : null);

    const anyLabel = t("billing:coupon.anyItemOfType", { type: t(`billing:common.itemType.${scope.ItemType}`) });
    const options =
        scope.ItemType === "Course"
            ? courses.map((c) => ({ id: c.Id, title: c.Title }))
            : scope.ItemType === "Track"
                ? tracks.map((tr) => ({ id: tr.Id, title: tr.Title }))
                : chapters.filter((ch) => !!ch.Id).map((ch) => ({ id: ch.Id as string, title: ch.Title }));

    return (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/50 p-3">
            <div className="space-y-1">
                <Label className="text-xs">{t("billing:coupon.kind")}</Label>
                <Select
                    value={scope.ItemType}
                    disabled={disabled}
                    onValueChange={(v) => onChange({ ItemType: v as PurchasableItemType, ItemId: null }, "")}
                >
                    <SelectTrigger className="w-36" aria-label={t("billing:common.itemType.Course")}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(["Course", "Track", "Chapter"] as PurchasableItemType[]).map((type) => (
                            <SelectItem key={type} value={type}>{t(`billing:common.itemType.${type}`)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {scope.ItemType === "Chapter" && (
                <div className="space-y-1">
                    <Label className="text-xs">{t("billing:coupon.scopeCourse")}</Label>
                    <Select
                        value={courseId || ALL}
                        disabled={disabled}
                        onValueChange={(v) => onChange({ ...scope, ItemId: null }, v === ALL ? "" : v)}
                    >
                        <SelectTrigger className="w-48" aria-label={t("billing:coupon.scopeCourse")}>
                            <SelectValue placeholder={t("billing:coupon.scopeCourse")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t("billing:common.notSet")}</SelectItem>
                            {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-1 flex-1 min-w-48">
                <Label className="text-xs">{t("billing:coupon.scopeItem")}</Label>
                <Select
                    value={scope.ItemId ?? ALL}
                    disabled={disabled}
                    onValueChange={(v) => onChange({ ...scope, ItemId: v === ALL ? null : v }, courseId)}
                >
                    <SelectTrigger aria-label={t("billing:coupon.scopeItem")}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{anyLabel}</SelectItem>
                        {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={disabled}
                aria-label={t("billing:coupon.removeScope")}>
                <X className="w-4 h-4" />
            </Button>
        </div>
    );
};

export const CouponsManager = () => {
    const { t } = useTranslation(["billing", "common", "admin"]);
    const { formatCurrency, formatDate, formatNumber, formatPercent } = useFormatters();
    const { toast } = useToast();
    const { can } = usePermissions();
    const { currency: platformCurrency } = usePlatformCurrency();

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [state, setState] = useState(ALL);
    const [page, setPage] = useState(1);

    const [editing, setEditing] = useState<Coupon | null>(null);
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<CouponForm>(() => emptyForm(platformCurrency));
    const [deleting, setDeleting] = useState<Coupon | null>(null);
    const [redemptionsOf, setRedemptionsOf] = useState<Coupon | null>(null);
    const [redemptionsPage, setRedemptionsPage] = useState(1);

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const filters = useMemo(
        () => ({
            active: state === ALL ? undefined : state === "active",
            search: debouncedSearch || undefined,
            page,
            pageSize: COUPONS_PAGE_SIZE,
        }),
        [state, debouncedSearch, page]
    );

    const { data, isLoading, isError, error, isFetching } = useAdminCouponsQuery(filters);
    const coupons = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / COUPONS_PAGE_SIZE));

    const { data: courses = [] } = useCatalogCoursesQuery({ pageSize: 200 });
    const { data: tracks = [] } = useTrackOptionsQuery();

    const createMutation = useCreateCoupon();
    const updateMutation = useUpdateCoupon();
    const deleteMutation = useDeleteCoupon();

    const { data: redemptions, isLoading: redemptionsLoading, isError: redemptionsError } =
        useCouponRedemptionsQuery(redemptionsOf?.Id, redemptionsPage);
    const redemptionPages = Math.max(1, Math.ceil((redemptions?.total ?? 0) / REDEMPTIONS_PAGE_SIZE));

    const openCreate = () => { setEditing(null); setForm(emptyForm(platformCurrency)); setDialogOpen(true); };
    const openEdit = (coupon: Coupon) => { setEditing(coupon); setForm(formOf(coupon, platformCurrency)); setDialogOpen(true); };

    /** A restriction always names the item it restricts to — an id is never shown to a human. */
    const scopeLabel = (scope: CouponScope) => {
        const type = t(`billing:common.itemType.${scope.ItemType}`);
        if (!scope.ItemId) return t("billing:coupon.anyItemOfType", { type });
        const title =
            scope.ItemType === "Course" ? courses.find((c) => c.Id === scope.ItemId)?.Title
                : scope.ItemType === "Track" ? tracks.find((tr) => tr.Id === scope.ItemId)?.Title
                    : undefined;
        return title ? `${type} · ${title}` : type;
    };

    const stateBadge = (coupon: Coupon) => {
        if (coupon.IsLive) return { label: t("billing:coupon.live"), className: "border-success/30 bg-success/10 text-success" };
        if (!coupon.IsActive) return { label: t("billing:coupon.paused"), className: "border-border bg-muted text-muted-foreground" };
        if (coupon.StartsAt && new Date(coupon.StartsAt) > new Date())
            return { label: t("billing:coupon.scheduled"), className: "border-primary/30 bg-primary/10 text-primary" };
        return { label: t("billing:coupon.ended"), className: "border-border bg-muted text-muted-foreground" };
    };

    const discountOf = (coupon: Coupon) =>
        coupon.Kind === "Percentage"
            ? coupon.Percentage === null ? "-" : formatPercent(coupon.Percentage)
            : coupon.AmountOff === null ? "-" : formatCurrency(coupon.AmountOff, coupon.Currency ?? platformCurrency);

    const datesOf = (coupon: Coupon) => {
        if (!coupon.StartsAt && !coupon.EndsAt) return t("billing:coupon.always");
        const from = coupon.StartsAt ? formatDate(coupon.StartsAt) : "…";
        const to = coupon.EndsAt ? formatDate(coupon.EndsAt) : "…";
        return `${from} – ${to}`;
    };

    const buildBody = (): CouponWrite | null => {
        const code = form.code.trim().toUpperCase();
        if (!code) {
            toast({ variant: "destructive", title: t("billing:coupon.codeRequired") });
            return null;
        }
        const percentage = form.percentage.trim() === "" ? null : Number(form.percentage);
        if (form.kind === "Percentage" && (percentage === null || !Number.isFinite(percentage) || percentage <= 0 || percentage > 100)) {
            toast({ variant: "destructive", title: t("billing:coupon.percentageRequired") });
            return null;
        }
        const currency = form.currency.trim().toUpperCase();
        if (form.kind === "FixedAmount" && (!form.amountOff || form.amountOff <= 0 || currency.length !== 3)) {
            toast({ variant: "destructive", title: t("billing:coupon.amountRequired") });
            return null;
        }
        if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) {
            toast({ variant: "destructive", title: t("billing:coupon.datesInvalid") });
            return null;
        }
        const maxRedemptions = form.maxRedemptions.trim() === "" ? null : Number(form.maxRedemptions);
        const perUser = form.maxRedemptionsPerUser.trim() === "" ? 1 : Number(form.maxRedemptionsPerUser);

        return {
            Code: code,
            Description: form.description.trim() || null,
            Kind: form.kind,
            Percentage: form.kind === "Percentage" ? percentage : null,
            AmountOff: form.kind === "FixedAmount" ? form.amountOff : null,
            Currency: form.kind === "FixedAmount" ? currency : null,
            MinSubtotal: form.minSubtotal,
            MaxRedemptions: Number.isFinite(maxRedemptions as number) ? maxRedemptions : null,
            MaxRedemptionsPerUser: Number.isFinite(perUser) ? perUser : 1,
            StartsAt: toIsoDay(form.startsAt),
            EndsAt: toIsoDay(form.endsAt),
            IsActive: form.isActive,
            AppliesTo: form.appliesTo,
        };
    };

    const handleSave = () => {
        const body = buildBody();
        if (!body) return;
        const onError = (err: unknown) =>
            toast({ variant: "destructive", title: t("billing:common.saveFailed"), description: getApiError(err, t("billing:common.saveFailed")) });
        const onSuccess = () => {
            setDialogOpen(false);
            setEditing(null);
            toast({ title: t("billing:coupon.saved") });
        };
        if (editing) updateMutation.mutate({ id: editing.Id, body }, { onSuccess, onError });
        else createMutation.mutate(body, { onSuccess, onError });
    };

    /**
     * A delete has two honest outcomes: the coupon is gone, or it had already been redeemed and was switched off
     * instead so past orders keep their history. The second one is information, not a failure.
     */
    const handleDelete = () => {
        if (!deleting) return;
        const coupon = deleting;
        deleteMutation.mutate(
            { id: coupon.Id, code: coupon.Code },
            {
                onSuccess: (result) => {
                    setDeleting(null);
                    if (result.Deactivated) toast({ title: t("billing:coupon.deactivated", { code: result.Code }) });
                    else toast({ title: t("billing:coupon.deleted") });
                },
                onError: (err: unknown) =>
                    toast({ variant: "destructive", title: t("billing:coupon.deleteFailed"), description: getApiError(err, t("billing:coupon.deleteFailed")) }),
            }
        );
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const canManage = can(PERMISSIONS.couponsManage);

    return (
        <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black">{t("billing:coupon.title")}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{t("billing:coupon.subtitle")}</p>
                </div>
                <Can permission={PERMISSIONS.couponsManage}>
                    <Button onClick={openCreate}>
                        <Plus className="w-4 h-4 me-2" /> {t("billing:coupon.create")}
                    </Button>
                </Can>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="ps-9" placeholder={t("billing:coupon.searchPlaceholder")} value={search}
                        onChange={(e) => setSearch(e.target.value)} aria-label={t("billing:common.search")} />
                </div>
                <Select value={state} onValueChange={(v) => { setState(v); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-52" aria-label={t("billing:common.status")}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("billing:common.allStatuses")}</SelectItem>
                        <SelectItem value="active">{t("billing:coupon.filterActive")}</SelectItem>
                        <SelectItem value="inactive">{t("billing:coupon.filterInactive")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:coupon.code")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("billing:coupon.kind")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:coupon.discount")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("billing:coupon.redeemedCount")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:common.status")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("billing:coupon.dates")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("billing:coupon.appliesTo")}</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && (
                                    <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></td></tr>
                                )}
                                {isError && (
                                    <tr><td colSpan={8} className="text-center py-12 text-destructive">{getApiError(error, t("billing:coupon.loadFailed"))}</td></tr>
                                )}
                                {coupons.map((coupon) => {
                                    const badge = stateBadge(coupon);
                                    return (
                                        <tr key={coupon.Id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", isFetching && "opacity-70")}>
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold font-mono" dir="ltr">{coupon.Code}</p>
                                                {coupon.Description && <p className="text-xs text-muted-foreground">{coupon.Description}</p>}
                                            </td>
                                            <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">
                                                {t(`billing:coupon.kindValue.${coupon.Kind}`)}
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold tabular-nums">{discountOf(coupon)}</td>
                                            <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground tabular-nums">
                                                {coupon.MaxRedemptions === null
                                                    ? `${formatNumber(coupon.RedeemedCount)} · ${t("billing:coupon.unlimited")}`
                                                    : t("billing:coupon.redeemedOf", { used: formatNumber(coupon.RedeemedCount), total: formatNumber(coupon.MaxRedemptions) })}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <Badge variant="outline" className={cn("text-xs font-semibold", badge.className)}>{badge.label}</Badge>
                                            </td>
                                            <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground whitespace-nowrap">{datesOf(coupon)}</td>
                                            <td className="px-5 py-3.5 hidden lg:table-cell">
                                                {coupon.AppliesTo.length === 0 ? (
                                                    <span className="text-muted-foreground">{t("billing:coupon.appliesToEverything")}</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {coupon.AppliesTo.map((scope, index) => (
                                                            <Badge key={`${scope.ItemType}-${scope.ItemId ?? index}`} variant="secondary" className="text-[10px]">
                                                                {scopeLabel(scope)}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-end whitespace-nowrap">
                                                <Button variant="ghost" size="icon" className="w-8 h-8"
                                                    onClick={() => { setRedemptionsOf(coupon); setRedemptionsPage(1); }}
                                                    aria-label={t("billing:coupon.viewRedemptions")}>
                                                    <Users2 className="w-4 h-4" />
                                                </Button>
                                                <Can permission={PERMISSIONS.couponsManage}>
                                                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(coupon)}
                                                        aria-label={t("billing:coupon.edit")}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => setDeleting(coupon)}
                                                        aria-label={t("billing:coupon.delete")}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </Can>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!isLoading && !isError && coupons.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-12">
                                            <Ticket className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                                            <p className="text-muted-foreground">{t("billing:coupon.empty")}</p>
                                            {canManage && <p className="text-xs text-muted-foreground mt-1">{t("billing:coupon.emptyHint")}</p>}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {total > COUPONS_PAGE_SIZE && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        {t("billing:coupon.pageInfo", { page: formatNumber(page), pages: formatNumber(totalPages), count: total })}
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common:actions.previous")}</Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("common:actions.next")}</Button>
                    </div>
                </div>
            )}

            {/* Create / edit */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
                <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? t("billing:coupon.edit") : t("billing:coupon.create")}</DialogTitle>
                        <DialogDescription>{t("billing:coupon.subtitle")}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="coupon-code">{t("billing:coupon.code")}</Label>
                                <Input id="coupon-code" dir="ltr" className="font-mono uppercase" value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("billing:coupon.kind")}</Label>
                                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as CouponKind })}>
                                    <SelectTrigger aria-label={t("billing:coupon.kind")}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {COUPON_KINDS.map((kind) => (
                                            <SelectItem key={kind} value={kind}>{t(`billing:coupon.kindValue.${kind}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="coupon-description">{t("billing:coupon.description")}</Label>
                            <Textarea id="coupon-description" rows={2} value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            {form.kind === "Percentage" ? (
                                <div className="space-y-2">
                                    <Label htmlFor="coupon-percentage">{t("billing:coupon.percentage")}</Label>
                                    <Input id="coupon-percentage" type="number" min={1} max={100} inputMode="numeric" value={form.percentage}
                                        onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="coupon-amount">{t("billing:coupon.amountOff")}</Label>
                                        <MoneyInput id="coupon-amount" value={form.amountOff} currency={form.currency || platformCurrency}
                                            onChange={(value) => setForm({ ...form, amountOff: value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="coupon-currency">{t("billing:common.currency")}</Label>
                                        <Input id="coupon-currency" dir="ltr" maxLength={3} className="uppercase" value={form.currency}
                                            onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
                                    </div>
                                </>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="coupon-min">{t("billing:coupon.minSubtotal")}</Label>
                                <MoneyInput id="coupon-min" value={form.minSubtotal} currency={form.currency || platformCurrency}
                                    onChange={(value) => setForm({ ...form, minSubtotal: value })} />
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="coupon-max">{t("billing:coupon.maxRedemptions")}</Label>
                                <Input id="coupon-max" type="number" min={1} inputMode="numeric" placeholder={t("billing:coupon.unlimited")}
                                    value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="coupon-per-user">{t("billing:coupon.maxRedemptionsPerUser")}</Label>
                                <Input id="coupon-per-user" type="number" min={0} inputMode="numeric" value={form.maxRedemptionsPerUser}
                                    onChange={(e) => setForm({ ...form, maxRedemptionsPerUser: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="coupon-starts">{t("billing:coupon.startsAt")}</Label>
                                <Input id="coupon-starts" type="date" value={form.startsAt}
                                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="coupon-ends">{t("billing:coupon.endsAt")}</Label>
                                <Input id="coupon-ends" type="date" value={form.endsAt}
                                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                            <Label htmlFor="coupon-active" className="cursor-pointer">{t("billing:coupon.isActive")}</Label>
                            <Switch id="coupon-active" checked={form.isActive}
                                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>{t("billing:coupon.appliesTo")}</Label>
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => setForm({
                                        ...form,
                                        appliesTo: [...form.appliesTo, { ItemType: "Course", ItemId: null }],
                                        scopeCourseIds: [...form.scopeCourseIds, ""],
                                    })}>
                                    <Plus className="w-3.5 h-3.5 me-1" /> {t("billing:coupon.addScope")}
                                </Button>
                            </div>
                            {form.appliesTo.length === 0 ? (
                                <p className="text-xs text-muted-foreground">{t("billing:coupon.appliesToEverything")}</p>
                            ) : (
                                <div className="space-y-2">
                                    {form.appliesTo.map((scope, index) => (
                                        <ScopeRow
                                            key={index}
                                            scope={scope}
                                            courseId={form.scopeCourseIds[index] ?? ""}
                                            onChange={(next, courseId) => setForm({
                                                ...form,
                                                appliesTo: form.appliesTo.map((s, i) => (i === index ? next : s)),
                                                scopeCourseIds: form.scopeCourseIds.map((c, i) => (i === index ? courseId : c)),
                                            })}
                                            onRemove={() => setForm({
                                                ...form,
                                                appliesTo: form.appliesTo.filter((_, i) => i !== index),
                                                scopeCourseIds: form.scopeCourseIds.filter((_, i) => i !== index),
                                            })}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("billing:common.cancel")}</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("billing:common.save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete — hard delete, or a deactivation when the coupon has already been used */}
            <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("billing:coupon.deleteConfirm", { code: deleting?.Code ?? "" })}</AlertDialogTitle>
                        <AlertDialogDescription>{t("billing:coupon.deleteConfirmHint")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("billing:common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("billing:coupon.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Redemptions */}
            <Dialog open={!!redemptionsOf} onOpenChange={(open) => !open && setRedemptionsOf(null)}>
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>{t("billing:coupon.redemptions.title")}</DialogTitle>
                        <DialogDescription>
                            <span className="font-mono" dir="ltr">{redemptionsOf?.Code}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {redemptionsLoading && <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></div>}
                    {redemptionsError && <p className="py-10 text-center text-destructive">{t("billing:common.loadFailed")}</p>}
                    {!redemptionsLoading && !redemptionsError && (redemptions?.items.length ?? 0) === 0 && (
                        <p className="py-10 text-center text-muted-foreground">{t("billing:coupon.redemptions.empty")}</p>
                    )}
                    {!redemptionsLoading && (redemptions?.items.length ?? 0) > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50 bg-muted/30">
                                        <th className="text-start px-3 py-2 font-semibold text-muted-foreground">{t("billing:coupon.redemptions.buyer")}</th>
                                        <th className="text-start px-3 py-2 font-semibold text-muted-foreground">{t("billing:coupon.redemptions.order")}</th>
                                        <th className="text-start px-3 py-2 font-semibold text-muted-foreground">{t("billing:coupon.redemptions.discounted")}</th>
                                        <th className="text-start px-3 py-2 font-semibold text-muted-foreground">{t("billing:coupon.redemptions.redeemedAt")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {redemptions?.items.map((row) => (
                                        <tr key={row.Id} className="border-b border-border/30">
                                            <td className="px-3 py-2">{row.UserName ?? t("billing:common.unknownUser")}</td>
                                            <td className="px-3 py-2">
                                                <Link to={row.OrderLink} className="text-primary hover:underline">
                                                    {row.OrderStatus ? t(`billing:orderStatus.${row.OrderStatus}`) : t("billing:common.viewDetails")}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 tabular-nums">
                                                {formatCurrency(row.AmountDiscounted, row.Currency ?? platformCurrency)}
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(row.RedeemedAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {(redemptions?.total ?? 0) > REDEMPTIONS_PAGE_SIZE && (
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-xs text-muted-foreground">
                                {t("billing:coupon.pageInfo", { page: formatNumber(redemptionsPage), pages: formatNumber(redemptionPages), count: redemptions?.total ?? 0 })}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={redemptionsPage <= 1} onClick={() => setRedemptionsPage((p) => p - 1)}>{t("common:actions.previous")}</Button>
                                <Button variant="outline" size="sm" disabled={redemptionsPage >= redemptionPages} onClick={() => setRedemptionsPage((p) => p + 1)}>{t("common:actions.next")}</Button>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRedemptionsOf(null)}>{t("billing:common.close")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
