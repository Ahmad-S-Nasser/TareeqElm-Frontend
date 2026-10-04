/**
 * Organization → Billing (catalog v12 phase 4).
 *
 * Shows the org's current trainee seat usage against its cap (`GET /api/Organization/billing`) and the two
 * self-service packages (`PlatformSettingsDto.PackageTiers`, via `useCheckoutSettings`). Purchasing a package is an
 * ordinary `POST /api/checkout` with a `PackageSubscription` line — the same `useCreateCheckout`/manual-instructions/
 * dev-simulate flow `OrganizationPlatformCourses.tsx` already uses for a course license. "Enterprise" (the marketing
 * site's negotiated tier) is never sold here: it stays Admin-override-only (see AdminOrganizations.tsx).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Banknote, CreditCard, FlaskConical, Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import {
    canSimulatePayment, newIdempotencyKey, useCheckoutSettings, useCreateCheckout, useSimulatePayment,
    type CheckoutSessionDto,
} from "@/hooks/useCheckout";
import { type PackageTierDto } from "@/hooks/useBilling";
import { useInvalidateSeatUsage, useSeatUsageQuery } from "@/hooks/useOrganizationBilling";

const OrganizationBilling = () => {
    const { t } = useTranslation(["billing", "common"]);
    const { formatCurrency } = useFormatters();
    const { toast } = useToast();
    const invalidateSeatUsage = useInvalidateSeatUsage();

    const { data: usage, isLoading: usageLoading, isError: usageError, error: usageErr } = useSeatUsageQuery();
    const { data: settings, isLoading: settingsLoading } = useCheckoutSettings();
    const tiers = settings?.PackageTiers ?? [];

    const [buying, setBuying] = useState<PackageTierDto | null>(null);
    const [session, setSession] = useState<CheckoutSessionDto | null>(null);
    const [idempotencyKey, setIdempotencyKey] = useState("");

    const checkout = useCreateCheckout();
    const simulate = useSimulatePayment();

    const openBuy = (tier: PackageTierDto) => {
        setBuying(tier);
        setSession(null);
        setIdempotencyKey(newIdempotencyKey());
    };

    const handleConfirm = () => {
        if (!buying) return;
        checkout.mutate(
            { Items: [{ ItemType: "PackageSubscription", ItemId: buying.Tier }], idempotencyKey },
            {
                onSuccess: (data) => {
                    setSession(data);
                    if (!data.RequiresManualCapture) {
                        invalidateSeatUsage();
                        toast({ title: t("billing:organizationBilling.purchaseSucceeded") });
                    }
                },
                onError: (err: unknown) =>
                    toast({ variant: "destructive", title: t("billing:organizationBilling.purchaseFailed"), description: getApiError(err, t("billing:organizationBilling.purchaseFailed")) }),
            }
        );
    };

    const handleSimulate = (succeed: boolean) =>
        session &&
        simulate.mutate({ providerRef: session.ProviderRef, succeed }, {
            onSuccess: () => {
                invalidateSeatUsage();
                if (succeed) toast({ title: t("billing:organizationBilling.purchaseSucceeded") });
                setBuying(null);
            },
        });

    const used = usage?.UsedSeats ?? 0;
    const cap = usage?.TraineeCap ?? null;
    const usagePercent = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;

    return (
        <OrganizationPageLayout>
            <div className="animate-slide-up">
                <h1 className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-3xl font-bold text-transparent">
                    <CreditCard className="h-8 w-8 text-primary" />
                    {t("billing:organizationBilling.title")}
                </h1>
                <p className="mt-1 text-muted-foreground">{t("billing:organizationBilling.subtitle")}</p>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2 font-medium">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {t("billing:organizationBilling.seatUsage")}
                    </div>
                    {usageLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : usageError ? (
                        <p className="text-destructive text-sm">{getApiError(usageErr, t("billing:organizationBilling.usageLoadFailed"))}</p>
                    ) : cap == null ? (
                        <p className="text-sm text-muted-foreground">{t("billing:organizationBilling.uncapped", { count: used })}</p>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm">
                                {t("billing:organizationBilling.usedOfCap", { used, cap })}
                                {usage?.PackageTier && <span className="text-muted-foreground"> · {usage.PackageTier}</span>}
                            </p>
                            <Progress value={usagePercent} aria-label={t("billing:organizationBilling.seatUsage")} />
                        </div>
                    )}
                </CardContent>
            </Card>

            <div>
                <h2 className="text-lg font-semibold mb-3">{t("billing:organizationBilling.packagesTitle")}</h2>
                {settingsLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {tiers.map((tier) => {
                            const isCurrent = usage?.PackageTier === tier.Tier;
                            return (
                                <Card key={tier.Tier} className="border-border/50 flex flex-col">
                                    <CardContent className="p-5 flex flex-col gap-3 flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold">{tier.Name}</p>
                                            {isCurrent && <Badge variant="outline" className="border-success/30 bg-success/10 text-success">{t("billing:organizationBilling.currentPlan")}</Badge>}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{t("billing:organizationBilling.seatCount", { count: tier.Cap })}</p>
                                        <div className="flex-1" />
                                        {tier.Price ? (
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="font-semibold tabular-nums">{formatCurrency(tier.Price.Amount, tier.Price.Currency)}</span>
                                                <Button size="sm" onClick={() => openBuy(tier)} disabled={isCurrent}>
                                                    {t(isCurrent ? "billing:organizationBilling.currentPlan" : "billing:organizationBilling.buy")}
                                                </Button>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">{t("billing:organizationBilling.notPriced")}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
                <p className="mt-3 text-sm text-muted-foreground">{t("billing:organizationBilling.enterpriseHint")}</p>
            </div>

            <Dialog open={!!buying} onOpenChange={(open) => !open && setBuying(null)}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>{t("billing:organizationBilling.confirmTitle", { name: buying?.Name ?? "" })}</DialogTitle>
                        {!session && (
                            <DialogDescription>
                                {t("billing:organizationBilling.confirmHint", {
                                    price: buying?.Price ? formatCurrency(buying.Price.Amount, buying.Price.Currency) : "",
                                    count: buying?.Cap ?? 0,
                                })}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {!session ? (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setBuying(null)}>{t("billing:common.cancel")}</Button>
                            <Button onClick={handleConfirm} disabled={checkout.isPending}>
                                {checkout.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                {t("billing:organizationBilling.buy")}
                            </Button>
                        </DialogFooter>
                    ) : (
                        <div className="space-y-4">
                            {session.Instructions && (
                                <div className="rounded-md border bg-muted/40 p-4 space-y-2" data-testid="package-instructions">
                                    <p className="flex items-center gap-2 font-medium text-sm">
                                        <Banknote className="h-4 w-4 text-muted-foreground" /> {t("checkout.provider.instructionsTitle")}
                                    </p>
                                    <p className="text-sm whitespace-pre-wrap">{session.Instructions}</p>
                                    <p className="text-sm">
                                        <span className="text-muted-foreground">{t("checkout.provider.reference")}: </span>
                                        <span className="font-mono">{session.ProviderRef}</span>
                                    </p>
                                </div>
                            )}
                            {canSimulatePayment(session.Provider) && (
                                <div className="rounded-md border border-dashed p-4 space-y-2" data-testid="package-simulate">
                                    <p className="flex items-center gap-2 text-sm font-medium">
                                        <FlaskConical className="h-4 w-4 text-muted-foreground" /> {t("checkout.simulate.title")}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => handleSimulate(true)} disabled={simulate.isPending}>
                                            {simulate.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                            {t("checkout.simulate.success")}
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleSimulate(false)} disabled={simulate.isPending}>
                                            {t("checkout.simulate.failure")}
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setBuying(null)}>{t("billing:common.close")}</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </OrganizationPageLayout>
    );
};

export default OrganizationBilling;
