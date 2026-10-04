import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CreditCard,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  Loader2,
  Lock,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { CouponField } from "@/components/billing";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PURCHASABLE_ITEM_TYPES, type CheckoutItemDto, type PurchasableItemType } from "@/hooks/useBilling";
import {
  canSimulatePayment,
  newIdempotencyKey,
  useCheckoutSettings,
  useCreateCheckout,
  useQuoteCheckout,
  useSimulatePayment,
  type CheckoutSessionDto,
} from "@/hooks/useCheckout";
import { useMyOrderQuery } from "@/hooks/useOrders";

/**
 * How the basket reaches this page, since there is no server-side cart:
 *
 *   /checkout?itemType=Course&itemId=abc123          one item (the minimum every caller must support)
 *   /checkout?item=Course:abc123&item=Track:def456   any number of items, repeatable
 *
 * Both forms may be mixed; duplicates collapse. Two optional extras:
 *   &coupon=WELCOME25    pre-fills nothing, but applies the code to the first quote
 *   &returnTo=/courses/abc123   where "back" and the post-payment CTA point (must be an in-app absolute path)
 */
const parseItems = (params: URLSearchParams): CheckoutItemDto[] => {
  const seen = new Set<string>();
  const items: CheckoutItemDto[] = [];

  const add = (rawType: string | null, rawId: string | null) => {
    const type = PURCHASABLE_ITEM_TYPES.find((t) => t.toLowerCase() === (rawType ?? "").trim().toLowerCase());
    const id = (rawId ?? "").trim();
    if (!type || !id) return;
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ ItemType: type as PurchasableItemType, ItemId: id });
  };

  add(params.get("itemType"), params.get("itemId"));
  for (const raw of params.getAll("item")) {
    const [type, ...rest] = raw.split(":");
    add(type, rest.join(":"));
  }
  // The backend caps a basket at 20 lines; refuse to send more than it will accept.
  return items.slice(0, 20);
};

/** Only in-app paths are followed, so a crafted ?returnTo can never bounce a buyer off the platform. */
const safeInternalPath = (value: string | null): string | null =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : null;

const providerLabelKey = (provider: string) =>
  provider === "mock" || provider === "manual" ? `checkout.provider.${provider}` : "checkout.provider.other";

const Checkout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t, i18n } = useTranslation(["billing", "common"]);
  // Arabic uses its own comma; titles are course names, so a plain separated list reads naturally in both languages.
  const formatTitleList = (titles: string[]) => titles.join(i18n.dir() === "rtl" ? "، " : ", ");
  const { formatCurrency } = useFormatters();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const items = useMemo(() => parseItems(params), [params]);
  const returnTo = safeInternalPath(params.get("returnTo"));

  const [couponCode, setCouponCode] = useState<string | null>(() => params.get("coupon")?.trim().toUpperCase() || null);
  const [session, setSession] = useState<CheckoutSessionDto | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  // One idempotency key per basket attempt: every retry of this attempt must return the same order, never a second one.
  const idempotencyKey = useRef<string>(newIdempotencyKey());

  const settings = useCheckoutSettings();
  const quote = useQuoteCheckout(items, couponCode);
  const createCheckout = useCreateCheckout();
  const simulate = useSimulatePayment();

  // A provider choice only exists when we can actually name more than one: `PlatformSettings.DefaultPaymentProvider`
  // is settings.manage-only (a trainer reads null), and there is no public "enabled providers" endpoint, so in
  // practice the server picks. A ?provider= override still lets a catalog surface send a buyer straight to one.
  const forcedProvider = params.get("provider")?.trim().toLowerCase() || null;
  const providerChoices = useMemo(
    () => [...new Set([forcedProvider, settings.data?.DefaultPaymentProvider?.toLowerCase()].filter(Boolean))] as string[],
    [forcedProvider, settings.data?.DefaultPaymentProvider]
  );
  const [provider, setProvider] = useState<string | null>(null);
  const chosenProvider = provider ?? forcedProvider ?? null;

  // Once an order exists, watch it until the payment clears. Polling stops the moment it is no longer pending, so a
  // redirect-based provider that lands back on this page still finishes without a reload.
  const pendingOrder = useMyOrderQuery(session?.OrderId, { refetchInterval: session ? 4000 : false });
  const orderStatus = pendingOrder.data?.Status ?? session?.Status;

  // A redirect provider takes over the browser; nothing else on this page matters once we have a URL.
  useEffect(() => {
    if (session?.RedirectUrl) window.location.assign(session.RedirectUrl);
  }, [session?.RedirectUrl]);

  useEffect(() => {
    if (session && orderStatus === "Paid") {
      navigate(`/purchases/${session.OrderId}`, { replace: true, state: { justPaid: true, returnTo } });
    }
  }, [session, orderStatus, navigate, returnTo]);

  const checkoutEnabled = settings.data?.CheckoutEnabled !== false;
  const currency = quote.data?.Currency ?? settings.data?.Currency;
  const alreadyOwned = quote.isError && (quote.error as { response?: { status?: number } })?.response?.status === 409;

  const handleBuy = async () => {
    setStartError(null);
    try {
      const created = await createCheckout.mutateAsync({
        Items: items,
        CouponCode: couponCode,
        Provider: chosenProvider,
        ReturnUrl: typeof window !== "undefined" ? `${window.location.origin}/purchases` : null,
        idempotencyKey: idempotencyKey.current,
      });
      setSession(created);
    } catch (error) {
      setStartError(getApiError(error, t("checkout.startFailed")));
    }
  };

  const handleSimulate = async (succeed: boolean) => {
    if (!session) return;
    try {
      await simulate.mutateAsync({ providerRef: session.ProviderRef, succeed });
      if (succeed) toast({ title: t("checkout.simulate.succeeded") });
      await pendingOrder.refetch();
    } catch (error) {
      toast({ title: t("checkout.simulate.failed"), description: getApiError(error), variant: "destructive" });
    }
  };

  const backLink = returnTo ?? "/catalog";
  const backLabel = returnTo ? t("checkout.backToCourse") : t("checkout.backToCatalog");

  return (
    <div className="min-h-screen bg-background">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />

      <main
        className={cn(
          "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
          "ms-0"
        )}
      >
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <Button variant="ghost" size="sm" className="-ms-2 mb-2 text-muted-foreground" asChild>
              <Link to={backLink}>
                <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" aria-hidden="true" />
                {backLabel}
              </Link>
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 text-primary" aria-hidden="true" />
              {t("checkout.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("checkout.subtitle")}</p>
          </div>

          {items.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center space-y-2">
                <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto" aria-hidden="true" />
                <p className="font-medium">{t("checkout.empty")}</p>
                <p className="text-sm text-muted-foreground">{t("checkout.emptyHint")}</p>
                <Button variant="outline" className="mt-2" asChild>
                  <Link to="/catalog">{t("order.browseCatalog")}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : !checkoutEnabled ? (
            <Card>
              <CardContent className="py-16 text-center space-y-2" data-testid="checkout-disabled">
                <Lock className="w-12 h-12 text-muted-foreground mx-auto" aria-hidden="true" />
                <p className="font-medium">{t("checkout.disabled")}</p>
                <p className="text-sm text-muted-foreground">{t("checkout.disabledHint")}</p>
              </CardContent>
            </Card>
          ) : session ? (
            /* ---------------- the payment has been started ---------------- */
            <Card data-testid="checkout-pending">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">
                    {session.RedirectUrl ? t("checkout.provider.redirecting") : t("checkout.provider.awaitingPayment")}
                  </CardTitle>
                  <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                    {t(`orderStatus.${orderStatus ?? "PendingPayment"}`)}
                  </Badge>
                </div>
                <CardDescription>{t("checkout.provider.awaitingPaymentHint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.total")}</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(session.Total, session.Currency)}</span>
                </div>

                {session.RedirectUrl && (
                  <Button className="w-full" asChild>
                    <a href={session.RedirectUrl} rel="noreferrer">
                      <ExternalLink className="h-4 w-4 me-2" aria-hidden="true" />
                      {t("checkout.provider.openPaymentPage")}
                    </a>
                  </Button>
                )}

                {session.Instructions && (
                  <div className="rounded-md border bg-muted/40 p-4 space-y-2" data-testid="checkout-instructions">
                    <p className="flex items-center gap-2 font-medium text-sm">
                      <Banknote className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {t("checkout.provider.instructionsTitle")}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{session.Instructions}</p>
                    <p className="text-xs text-muted-foreground">{t("checkout.provider.instructionsHint")}</p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">{t("checkout.provider.reference")}: </span>
                      <span className="font-mono" data-testid="checkout-reference">
                        {session.ProviderRef}
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void pendingOrder.refetch()} disabled={pendingOrder.isFetching}>
                    {pendingOrder.isFetching ? (
                      <Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="h-4 w-4 me-2" aria-hidden="true" />
                    )}
                    {t("common:actions.refresh")}
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to={`/purchases/${session.OrderId}`}>{t("checkout.success.viewOrder")}</Link>
                  </Button>
                </div>

                {/* Development only, and only for the mock provider: a production bundle never contains this. */}
                {canSimulatePayment(session.Provider) && (
                  <div className="rounded-md border border-dashed p-4 space-y-2" data-testid="simulate-payment">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      {t("checkout.simulate.title")}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("checkout.simulate.description")}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void handleSimulate(true)} disabled={simulate.isPending}>
                        {simulate.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />}
                        {simulate.isPending ? t("checkout.simulate.running") : t("checkout.simulate.success")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSimulate(false)}
                        disabled={simulate.isPending}
                      >
                        {t("checkout.simulate.failure")}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : quote.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : quote.isError ? (
            <Card>
              <CardContent className="py-16 text-center space-y-3" data-testid="checkout-quote-error">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto" aria-hidden="true" />
                <p className="font-medium text-destructive">
                  {alreadyOwned ? t("checkout.alreadyOwned") : getApiError(quote.error, t("checkout.quoteFailed"))}
                </p>
                {alreadyOwned ? (
                  <Button variant="outline" asChild>
                    <Link to={returnTo ?? "/courses"}>{t("checkout.success.goToCourse")}</Link>
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => void quote.refetch()}>
                    {t("common:actions.retry")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            /* ---------------- the basket, priced ---------------- */
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("checkout.orderSummary")}</CardTitle>
                <CardDescription>{t("order.itemsCount", { count: quote.data?.Lines.length ?? 0 })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-3" data-testid="checkout-lines">
                  {quote.data?.Lines.map((line) => (
                    <li key={`${line.ItemType}:${line.ItemId}`} className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="font-medium truncate">{line.Title || t("common.unknownItem")}</p>
                          <p className="text-xs text-muted-foreground">{t(`common.itemType.${line.ItemType}`)}</p>
                        </div>
                        {/* Friendly, purely advisory: prerequisites are never enforced on a purchase. */}
                        {(line.RecommendedPriorCourseTitles?.length ?? 0) > 0 && (
                          <Alert
                            role="note"
                            className="py-2.5 text-muted-foreground [&>svg]:top-3 [&>svg]:text-primary"
                            data-testid="checkout-recommended-prior"
                          >
                            <Lightbulb className="h-4 w-4" aria-hidden="true" />
                            <AlertDescription className="text-xs">
                              {t("checkout.recommendedPriorCourses", {
                                titles: formatTitleList(line.RecommendedPriorCourseTitles ?? []),
                              })}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      <div className="text-end shrink-0">
                        <p className="font-medium tabular-nums">
                          {formatCurrency(line.LineTotal, quote.data?.Currency)}
                        </p>
                        {line.DiscountAmount > 0 && (
                          <p className="text-xs text-muted-foreground line-through tabular-nums">
                            {formatCurrency(line.UnitAmount, quote.data?.Currency)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <Separator />

                <CouponField
                  items={items}
                  appliedCode={quote.data?.CouponApplied ? (quote.data.CouponCode ?? couponCode) : null}
                  discountAmount={quote.data?.DiscountAmount}
                  currency={currency}
                  onApply={(code) => setCouponCode(code)}
                  onRemove={() => setCouponCode(null)}
                  disabled={createCheckout.isPending}
                />

                {providerChoices.length > 1 && (
                  <div className="space-y-2">
                    <Label>{t("checkout.provider.label")}</Label>
                    <RadioGroup
                      value={chosenProvider ?? providerChoices[0]}
                      onValueChange={setProvider}
                      className="gap-2"
                    >
                      {providerChoices.map((name) => (
                        <div key={name} className="flex items-center gap-2">
                          <RadioGroupItem value={name} id={`provider-${name}`} />
                          <Label htmlFor={`provider-${name}`} className="font-normal">
                            {t(providerLabelKey(name), { name })}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                <Separator />

                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("checkout.subtotal")}</dt>
                    <dd className="tabular-nums">{formatCurrency(quote.data?.Subtotal ?? 0, quote.data?.Currency)}</dd>
                  </div>
                  {(quote.data?.DiscountAmount ?? 0) > 0 && (
                    <div className="flex justify-between text-success">
                      <dt>{t("checkout.discount")}</dt>
                      <dd className="tabular-nums" data-testid="checkout-discount">
                        -{formatCurrency(quote.data?.DiscountAmount ?? 0, quote.data?.Currency)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold pt-1">
                    <dt>{t("checkout.total")}</dt>
                    <dd className="tabular-nums" data-testid="checkout-total">
                      {formatCurrency(quote.data?.Total ?? 0, quote.data?.Currency)}
                    </dd>
                  </div>
                </dl>

                {startError && (
                  <p className="text-sm text-destructive" role="alert" data-testid="checkout-error">
                    {startError}
                  </p>
                )}

                <Button className="w-full" size="lg" onClick={() => void handleBuy()} disabled={createCheckout.isPending}>
                  {createCheckout.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />
                      {t("checkout.placing")}
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 me-2" aria-hidden="true" />
                      {t("checkout.buyFor", { price: formatCurrency(quote.data?.Total ?? 0, quote.data?.Currency) })}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">{t("checkout.secureNote")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Checkout;
