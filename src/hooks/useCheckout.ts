/**
 * The trainer buy flow (plan §5.4 "Checkout", permission `checkout.self`).
 *
 * Four endpoints, all of them POST:
 *   POST /api/checkout/quote               prices a basket, writes nothing
 *   POST /api/checkout                     creates the PendingPayment order, then starts the payment
 *   POST /api/checkout/{providerRef}/simulate   development-only: drives a real webhook through the real grant path
 *   POST /api/coupons/validate             always 200; branch on `Valid`, never on the HTTP status
 *
 * Two rules the whole file obeys:
 *  1. **No money is computed here.** Every amount rendered comes back from the server (plan §5.0); the client only
 *     displays what it was given.
 *  2. **Every cache key comes from `billingKeys`** (@/hooks/useBilling), so a purchase invalidates the order,
 *     entitlement and earnings caches other waves filled.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import {
  billingKeys,
  type CheckoutItemDto,
  type CouponReasonCode,
  type Money,
  type OrderStatus,
  type PackageTierDto,
  type PurchasableItemType,
} from './useBilling';

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/BillingDtos.cs)
// ---------------------------------------------------------------------------

/** `CheckoutRequestDto` — the body every checkout endpoint takes. */
export interface CheckoutRequestDto {
  /** 1..20 lines. */
  Items: CheckoutItemDto[];
  CouponCode?: string | null;
  /** Provider name; omitted = `PlatformSettings.DefaultPaymentProvider`. */
  Provider?: string | null;
  /** Where a redirect-based provider should send the buyer back to. */
  ReturnUrl?: string | null;
}

/** `CheckoutLineDto` — one priced line of a quote. `Title` is the resolved item name at quote time. */
export interface CheckoutLineDto {
  ItemType: PurchasableItemType;
  ItemId: string;
  Title: string;
  UnitAmount: Money;
  DiscountAmount: Money;
  LineTotal: Money;
  CourseId: string | null;
  InstructorId: string | null;
  /**
   * Advisory only: titles of prerequisite courses (of this course, or of any course in a track) the buyer has not
   * completed yet. Shown as a friendly suggestion; never blocks the purchase. Empty/absent when there is nothing to suggest.
   */
  RecommendedPriorCourseTitles?: string[];
}

/** `CheckoutQuoteDto` — what a purchase would cost right now. */
export interface CheckoutQuoteDto {
  Currency: string;
  Lines: CheckoutLineDto[];
  Subtotal: Money;
  DiscountAmount: Money;
  /** Always 0 in v1 — there is no tax engine. */
  TaxAmount: Money;
  Total: Money;
  CouponCode: string | null;
  CouponApplied: boolean;
  /** Why a supplied coupon was not applied; null when it was. A quote treats a bad coupon as advisory, not an error. */
  CouponReasonCode: CouponReasonCode | string | null;
}

/** `CheckoutSessionDto` — the started payment. The order already exists (PendingPayment) before the provider was called. */
export interface CheckoutSessionDto {
  OrderId: string;
  /** "mock" | "manual" | a real gateway's name. */
  Provider: string;
  ProviderRef: string;
  Status: OrderStatus;
  Currency: string;
  Total: Money;
  SessionId: string | null;
  /** Redirect-based providers only; follow it. */
  RedirectUrl: string | null;
  /** Manual (bank transfer) providers return instructions instead of a redirect. */
  Instructions: string | null;
  RequiresManualCapture: boolean;
  /** True when an `Idempotency-Key` replay returned the order the first call created. */
  Replayed: boolean;
}

/** `CouponValidationDto` — answer of `POST /api/coupons/validate`; an unusable coupon is still HTTP 200. */
export interface CouponValidationDto {
  Valid: boolean;
  Code: string | null;
  /** `coupon.not_found`, `coupon.expired`, ... — null when valid. */
  ReasonCode: CouponReasonCode | string | null;
  /** `Percentage` | `FixedAmount`; null when invalid. */
  Kind: string | null;
  DiscountAmount: Money;
  Currency: string | null;
}

/** The outcome of a simulated payment; the order comes back in whatever state the grant path left it. */
export interface SimulatePaymentResultDto {
  /** `Processed` | `Duplicate` | `Ignored` | `Failed` ... (server-side `WebhookOutcome`). */
  Outcome: string;
  Order: { Id: string; Status: OrderStatus } | null;
}

/** The slice of `GET /api/Settings` the buying UI needs. Anything the caller may not see comes back null. */
export interface CheckoutSettings {
  Currency: string;
  /** Master switch: false hides every buy button. */
  CheckoutEnabled: boolean;
  RefundWindowDays: number;
  /** Null unless the caller holds `settings.manage` — a trainer never learns which provider is the default. */
  DefaultPaymentProvider: string | null;
  /** The two self-service organization packages (catalog v12 phase 4); always visible, every org needs to shop. */
  PackageTiers: PackageTierDto[];
}

// ---------------------------------------------------------------------------
// Coupon reason codes -> i18n keys
// ---------------------------------------------------------------------------

/**
 * `coupon.not_found` (an `ErrorCodes` constant) -> `billing:coupon.reason.notFound`. Anything unrecognised falls back
 * to `coupon.reason.default` rather than rendering a raw error code at a buyer.
 */
export const couponReasonKey = (reasonCode?: string | null): string => {
  const suffix = (reasonCode ?? '').split('.').slice(1).join('.');
  if (!suffix) return 'coupon.reason.default';
  const camel = suffix.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const known = [
    'invalid',
    'notFound',
    'inactive',
    'expired',
    'exhausted',
    'alreadyUsed',
    'notApplicable',
    'minSubtotal',
  ];
  return known.includes(camel) ? `coupon.reason.${camel}` : 'coupon.reason.default';
};

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------

/**
 * `GET /api/Settings`, narrowed to the four billing fields every signed-in caller may read. Cached under
 * `billingKeys.settings()`; five minutes is plenty, these change about once a year.
 */
export const useCheckoutSettings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.settings(),
    queryFn: async () => {
      const { data } = await api.get<Partial<CheckoutSettings>>('/Settings');
      return {
        Currency: (data.Currency ?? 'USD').trim().toUpperCase(),
        CheckoutEnabled: data.CheckoutEnabled !== false,
        RefundWindowDays: data.RefundWindowDays ?? 14,
        DefaultPaymentProvider: data.DefaultPaymentProvider ?? null,
        PackageTiers: data.PackageTiers ?? [],
      } satisfies CheckoutSettings;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
};

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

const quoteBasket = async (body: CheckoutRequestDto): Promise<CheckoutQuoteDto> =>
  (await api.post<CheckoutQuoteDto>('/checkout/quote', body)).data;

/**
 * `POST /api/checkout/quote` — the price of a basket, never cached.
 *
 * A quote goes stale the moment a sale window opens or closes, a coupon is exhausted or the buyer gains access some
 * other way, and it is the number the buy button is about to charge. So: `staleTime: 0`, `gcTime: 0` and a refetch on
 * every mount. It is modelled as a query rather than a mutation because it writes nothing and because
 * `billingKeys.checkout.quote` already keys it by basket + coupon.
 *
 * A basket the buyer already owns answers 409 `checkout.already_owned`; read that through `getApiError`.
 */
export const useQuoteCheckout = (items: CheckoutItemDto[], couponCode?: string | null) => {
  const { user } = useAuth();
  const code = couponCode?.trim() || undefined;
  return useQuery({
    queryKey: billingKeys.checkout.quote(items, code),
    queryFn: () => quoteBasket({ Items: items, CouponCode: code ?? null }),
    enabled: !!user && items.length > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: false,
  });
};

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export interface CreateCheckoutVariables extends CheckoutRequestDto {
  /**
   * Sent as the `Idempotency-Key` header. The backend honours it through the `(UserId, ClientRequestId)` unique
   * partial index, so retrying a request that may already have been received returns the *same* order (with
   * `Replayed: true`) instead of starting a second payment. Keep one key per basket attempt, not per click.
   */
  idempotencyKey?: string;
}

/**
 * `POST /api/checkout` — creates the order (PendingPayment) and asks the provider to start the payment.
 *
 * Nothing has been charged when this resolves: the answer is a `CheckoutSessionDto` describing what to do next
 * (follow `RedirectUrl`, or show `Instructions` and wait). Every billing cache is invalidated because the new order
 * must appear in "my purchases" immediately.
 */
export const useCreateCheckout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ idempotencyKey, ...body }: CreateCheckoutVariables) => {
      const { data } = await api.post<CheckoutSessionDto>('/checkout', body, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.orders.all() });
    },
  });
};

/** A random `Idempotency-Key`. Generate one per basket attempt and reuse it for every retry of that attempt. */
export const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------------
// Simulated payment (development only)
// ---------------------------------------------------------------------------

/** The provider name whose payments can be simulated; the backend enables it in Development only. */
export const MOCK_PROVIDER = 'mock';

/**
 * Whether the "simulate payment" affordance may be rendered at all.
 *
 * Two gates, both of which must hold:
 *  - `import.meta.env.DEV` — a production bundle must never contain a button that fakes a payment. This is read at
 *    call time (not captured in a module constant) so the check is honest in tests and so bundlers can still drop the
 *    branch from a production build.
 *  - the order is actually on the mock provider — `MockPaymentProvider` is the only one with a `SimulateAsync`, and
 *    the endpoint answers 400 `payment.simulation_unavailable` for anything else.
 *
 * A trainer cannot read `PlatformSettings.DefaultPaymentProvider` (it is `settings.manage`-only), so the provider is
 * taken from the checkout session the server just returned — which is the authoritative answer anyway.
 */
export const canSimulatePayment = (provider?: string | null): boolean =>
  import.meta.env.DEV && (provider ?? '').toLowerCase() === MOCK_PROVIDER;

/**
 * `POST /api/checkout/{providerRef}/simulate?succeed=` — signs a webhook for this order and feeds it through the real
 * signature check and the real grant path, so a simulated payment differs from a genuine one in nothing but its
 * origin. Development only; gate every caller with {@link canSimulatePayment}.
 */
export const useSimulatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerRef, succeed = true }: { providerRef: string; succeed?: boolean }) => {
      const { data } = await api.post<SimulatePaymentResultDto>(
        `/checkout/${encodeURIComponent(providerRef)}/simulate`,
        null,
        { params: { succeed } }
      );
      return data;
    },
    // A simulated payment grants entitlements, enrollments and earnings exactly as a real one does, so everything
    // billing has cached is now potentially wrong.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
};

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

/**
 * `POST /api/coupons/validate` — **always** answers 200. A coupon that cannot be used comes back as
 * `{ Valid: false, ReasonCode }`, so branch on `Valid`; only a transport failure lands in `onError`.
 *
 * Modelled as a mutation because a buyer applies a code deliberately: nothing should be sent while they are still
 * typing it.
 */
export const useValidateCoupon = () =>
  useMutation({
    mutationKey: billingKeys.checkout.coupon('', []),
    mutationFn: async ({ code, items = [] }: { code: string; items?: CheckoutItemDto[] }) => {
      const { data } = await api.post<CouponValidationDto>('/coupons/validate', {
        Code: code.trim(),
        Items: items.length > 0 ? items : undefined,
      });
      return data;
    },
  });
