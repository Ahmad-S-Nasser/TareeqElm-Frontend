/**
 * Organization → Platform Course Catalog (catalog v12 phase 3).
 *
 * Browses the platform's own licensable courses (`GET /api/Organization/platform-courses`) and licenses one through
 * the ordinary checkout pipeline — `POST /api/checkout` with a `CourseLicense` line, the same
 * `useCreateCheckout`/manual-instructions/dev-simulate flow a trainee's own purchase already uses (see
 * `src/pages/Checkout.tsx`). Once licensed (the webhook/fulfillment grants it), the organization's own trainees may
 * self-enroll into the course for free — no separate "add to library" step exists.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Banknote, BookOpen, CheckCircle2, FlaskConical, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import {
    canSimulatePayment, newIdempotencyKey, useCreateCheckout, useSimulatePayment, type CheckoutSessionDto,
} from "@/hooks/useCheckout";
import { useInvalidatePlatformCatalog, usePlatformCoursesQuery, type PlatformCourseDto } from "@/hooks/usePlatformCatalog";

const OrganizationPlatformCourses = () => {
    const { t } = useTranslation(["billing", "common"]);
    const { formatCurrency, formatDate } = useFormatters();
    const { toast } = useToast();
    const invalidateCatalog = useInvalidatePlatformCatalog();

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [licensing, setLicensing] = useState<PlatformCourseDto | null>(null);
    const [session, setSession] = useState<CheckoutSessionDto | null>(null);
    const [idempotencyKey, setIdempotencyKey] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const { data, isLoading, isError, error } = usePlatformCoursesQuery({ search: debouncedSearch || undefined });
    const courses = data?.items ?? [];

    const checkout = useCreateCheckout();
    const simulate = useSimulatePayment();

    const openLicense = (course: PlatformCourseDto) => {
        setLicensing(course);
        setSession(null);
        setIdempotencyKey(newIdempotencyKey());
    };

    const handleConfirm = () => {
        if (!licensing) return;
        checkout.mutate(
            { Items: [{ ItemType: "CourseLicense", ItemId: licensing.Id }], idempotencyKey },
            {
                onSuccess: (data) => {
                    setSession(data);
                    if (!data.RequiresManualCapture) {
                        invalidateCatalog();
                        toast({ title: t("billing:platformCatalog.licenseSucceeded") });
                    }
                },
                onError: (err: unknown) =>
                    toast({ variant: "destructive", title: t("billing:platformCatalog.licenseFailed"), description: getApiError(err, t("billing:platformCatalog.licenseFailed")) }),
            }
        );
    };

    const handleSimulate = (succeed: boolean) =>
        session &&
        simulate.mutate({ providerRef: session.ProviderRef, succeed }, {
            onSuccess: () => {
                invalidateCatalog();
                if (succeed) toast({ title: t("billing:platformCatalog.licenseSucceeded") });
                setLicensing(null);
            },
        });

    return (
        <OrganizationPageLayout>
            <div className="animate-slide-up">
                <h1 className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-3xl font-bold text-transparent">
                    <BookOpen className="h-8 w-8 text-primary" />
                    {t("billing:platformCatalog.title")}
                </h1>
                <p className="mt-1 text-muted-foreground">{t("billing:platformCatalog.subtitle")}</p>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="ps-9" placeholder={t("billing:platformCatalog.searchPlaceholder")} value={search}
                    onChange={(e) => setSearch(e.target.value)} aria-label={t("billing:platformCatalog.searchPlaceholder")} />
            </div>

            {isLoading && <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></div>}
            {isError && <p className="py-12 text-center text-destructive">{getApiError(error, t("billing:platformCatalog.loadFailed"))}</p>}
            {!isLoading && !isError && courses.length === 0 && (
                <Card className="border-border/50">
                    <CardContent className="py-12 text-center">
                        <BookOpen className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-muted-foreground">{t("billing:platformCatalog.empty")}</p>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                    <Card key={course.Id} className="border-border/50 flex flex-col">
                        <CardContent className="p-5 flex flex-col gap-3 flex-1">
                            <div className="flex-1">
                                <p className="font-semibold">{course.Title}</p>
                                {course.Category && <p className="text-xs text-muted-foreground mt-0.5">{course.Category}</p>}
                                {course.Description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{course.Description}</p>}
                            </div>

                            {course.Licensed ? (
                                <Badge variant="outline" className="self-start border-success/30 bg-success/10 text-success gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {course.LicensedAt ? t("billing:platformCatalog.licensedOn", { date: formatDate(course.LicensedAt) }) : t("billing:platformCatalog.licensed")}
                                </Badge>
                            ) : course.LicensePrice ? (
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold tabular-nums">{formatCurrency(course.LicensePrice.Amount, course.LicensePrice.Currency)}</span>
                                    <Button size="sm" onClick={() => openLicense(course)}>{t("billing:platformCatalog.license")}</Button>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">{t("billing:platformCatalog.notPriced")}</p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={!!licensing} onOpenChange={(open) => !open && setLicensing(null)}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>{t("billing:platformCatalog.licenseConfirmTitle", { title: licensing?.Title ?? "" })}</DialogTitle>
                        {!session && (
                            <DialogDescription>
                                {t("billing:platformCatalog.licenseConfirmHint", {
                                    price: licensing?.LicensePrice ? formatCurrency(licensing.LicensePrice.Amount, licensing.LicensePrice.Currency) : "",
                                })}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {!session ? (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setLicensing(null)}>{t("billing:common.cancel")}</Button>
                            <Button onClick={handleConfirm} disabled={checkout.isPending}>
                                {checkout.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                {t("billing:platformCatalog.license")}
                            </Button>
                        </DialogFooter>
                    ) : (
                        <div className="space-y-4">
                            {session.Instructions && (
                                <div className="rounded-md border bg-muted/40 p-4 space-y-2" data-testid="license-instructions">
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
                                <div className="rounded-md border border-dashed p-4 space-y-2" data-testid="license-simulate">
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
                                <Button variant="outline" onClick={() => setLicensing(null)}>{t("billing:common.close")}</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </OrganizationPageLayout>
    );
};

export default OrganizationPlatformCourses;
