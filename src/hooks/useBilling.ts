/**
 * Shared monetization vocabulary (phase 5, wave F0).
 *
 * Every later billing wave imports from here rather than re-declaring a status union or inventing its own react-query
 * key. Two rules keep it that way:
 *
 *  1. **Types mirror the backend DTOs field-for-field, PascalCase included** (`Nafea.Application/DTOs/BillingDtos.cs`
 *     and friends). Only the shapes that genuinely cross wave boundaries live here; a DTO used by exactly one page
 *     (admin coupons, revenue series, payout statements...) belongs in that page's own hook file.
 *  2. **Every billing query key comes from `billingKeys`**, so an invalidation written in one wave reaches the caches
 *     another wave filled. The convention follows `enrollmentKeys` in ./useEnrollments.ts: flat readonly tuples,
 *     user-scoped where the endpoint is "me", with `?? ''` defaults so an absent filter is a stable key segment.
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * An amount of money, in major units of its own currency (79.99, not 7999). The server sends `decimal`, which lands
 * as a JSON number; it is never summed, multiplied or split on the client, so a plain `number` is honest.
 * Parsing/rounding helpers live in `@/lib/money`, display in `useFormatters().formatCurrency`.
 */
export type Money = number;

// ---------------------------------------------------------------------------
// Enums (mirrors of Nafea.Domain/Enums/*.cs — the API sends and accepts the names, not the numbers)
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  'PendingPayment',
  'Paid',
  'Failed',
  'Cancelled',
  'Refunded',
  'PartiallyRefunded',
  'Expired',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * `CourseLicense`/`PackageSubscription` (catalog v12 phase 3) are a platform<->organization transaction, never a
 * personal grant — {@link GRANTABLE_ITEM_TYPES} is the narrower set a manual entitlement (`AccessGrants`) may target.
 */
export const PURCHASABLE_ITEM_TYPES = ['Course', 'Track', 'Chapter', 'CourseLicense', 'PackageSubscription'] as const;
export type PurchasableItemType = (typeof PURCHASABLE_ITEM_TYPES)[number];

/** What a manual entitlement grant (`AccessGrants`) may target — never a CourseLicense/PackageSubscription. */
export const GRANTABLE_ITEM_TYPES = ['Course', 'Track', 'Chapter'] as const;

export const ENTITLEMENT_STATUSES = ['Active', 'Revoked', 'Expired'] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const ENTITLEMENT_SOURCES = ['Purchase', 'AdminGrant', 'Grandfather'] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export const TRACK_STATUSES = ['Draft', 'Published', 'Archived'] as const;
export type TrackStatus = (typeof TRACK_STATUSES)[number];

/** `Subscription` exists in the backend enum but is refused on write (`pricing.invalid`) — there is no plan product. */
export const COURSE_ACCESS_MODELS = ['Free', 'Subscription', 'AlaCarte'] as const;
export type CourseAccessModel = (typeof COURSE_ACCESS_MODELS)[number];
/** The access models a pricing form may actually write. */
export const WRITABLE_ACCESS_MODELS = ['Free', 'AlaCarte'] as const;

export const COUPON_KINDS = ['Percentage', 'FixedAmount'] as const;
export type CouponKind = (typeof COUPON_KINDS)[number];

export const REFUND_KINDS = ['Full', 'Partial'] as const;
export type RefundKind = (typeof REFUND_KINDS)[number];

export const REFUND_STATUSES = ['Pending', 'Succeeded', 'Failed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const EARNING_KINDS = ['Sale', 'Reversal', 'Adjustment'] as const;
export type EarningKind = (typeof EARNING_KINDS)[number];

export const EARNING_STATUSES = ['Pending', 'Available', 'Paid', 'Reversed'] as const;
export type EarningStatus = (typeof EARNING_STATUSES)[number];

export const PAYOUT_STATUSES = ['Draft', 'Approved', 'Paid', 'Cancelled'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const PAYOUT_METHODS = ['BankTransfer', 'Manual', 'Other'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/** `day | week | month` — the bucket size of `GET /api/admin/revenue/series`. */
export const REVENUE_GRANULARITIES = ['day', 'week', 'month'] as const;
export type RevenueGranularity = (typeof REVENUE_GRANULARITIES)[number];

/** Coupon rejection reasons the *quote* and *validate* endpoints return with HTTP 200 (see `billing:coupon.reason.*`). */
export const COUPON_REASON_CODES = [
  'coupon.invalid',
  'coupon.not_found',
  'coupon.inactive',
  'coupon.expired',
  'coupon.exhausted',
  'coupon.already_used',
  'coupon.not_applicable',
  'coupon.min_subtotal',
] as const;
export type CouponReasonCode = (typeof COUPON_REASON_CODES)[number];

// ---------------------------------------------------------------------------
// Cross-wave DTOs
// ---------------------------------------------------------------------------

/** `PricingDto` — a price as the client sees it. Read-only: the server computes `EffectiveAmount` and `OnSale`. */
export interface PricingDto {
  IsFree: boolean;
  /** The list price. */
  Amount: Money;
  /** What is actually charged right now: `SaleAmount` while a sale window is open, otherwise `Amount`. */
  EffectiveAmount: Money;
  /** Display-only "was" price, struck through next to the current one. */
  CompareAtAmount: Money | null;
  SaleAmount: Money | null;
  /** ISO-8601 UTC. */
  SaleStartsAt: string | null;
  SaleEndsAt: string | null;
  /** ISO-4217 code this price is quoted in; never assume the platform default. */
  Currency: string;
  /** True when a sale window is open right now (server-decided — never recompute from the dates). */
  OnSale: boolean;
}

/** `PricingWriteDto` — body of `PUT /api/Courses/{id}/pricing` and (without `AccessModel`) `PUT /api/tracks/{id}/pricing`. */
export interface PricingWriteDto {
  IsFree: boolean;
  Amount: Money;
  CompareAtAmount?: Money | null;
  SaleAmount?: Money | null;
  SaleStartsAt?: string | null;
  SaleEndsAt?: string | null;
  /** 3-letter ISO-4217 code; omitted = the platform currency. */
  Currency?: string | null;
  /** `Free | AlaCarte`. Omitted = keep the course's current model. Courses only — tracks have no access model. */
  AccessModel?: (typeof WRITABLE_ACCESS_MODELS)[number] | null;
}

/** `ChapterPricingWriteDto` — body of `PUT /api/Courses/{courseId}/chapters/{chapterId}/pricing`. */
export interface ChapterPricingWriteDto {
  /** True = the chapter is no longer sold separately; the stored price is cleared. */
  IsFree: boolean;
  Amount: Money;
  SaleAmount?: Money | null;
  /** A free sample chapter: its content stays visible on a paid course without an entitlement. */
  IsPreview: boolean;
}

/**
 * `PackageTierDto` (catalog v12 phase 4) — one self-service organization seat-cap package, as every signed-in caller
 * sees it via `GET /api/Settings`. `Tier` is one of `PACKAGE_TIER_IDS` below; `Price` null = Admin has not priced this
 * tier yet, so it is not yet purchasable (same convention as a platform course's `LicensePrice`).
 */
export interface PackageTierDto {
  Tier: string;
  Name: string;
  Cap: number;
  Price: PricingDto | null;
}

/** The two self-service tier ids (`PackageTierCatalog` on the backend). "Enterprise" is negotiated, never one of these. */
export const PACKAGE_TIER_IDS = ['package1', 'package2'] as const;

/** `TrackRefDto` — a track a course belongs to, for the "buy the whole path instead" banner. */
export interface TrackRefDto {
  Id: string;
  Title: string;
  Pricing: PricingDto | null;
  CoursesCount: number;
  Owned: boolean;
}

/** `CheckoutItemDto` — one line of a checkout request / quote / coupon validation. */
export interface CheckoutItemDto {
  ItemType: PurchasableItemType;
  ItemId: string;
}

/** `OrderItemDto` — one line of the buyer's own order. Amounts are snapshots taken at checkout. */
export interface OrderItemDto {
  LineId: string;
  ItemType: PurchasableItemType;
  ItemId: string;
  /** What the item was called when it was bought; this never changes. */
  Title: string;
  CourseId: string | null;
  InstructorId: string | null;
  UnitAmount: Money;
  DiscountAmount: Money;
  LineTotal: Money;
  RefundedAmount: Money;
}

/** `OrderDto` — `GET /api/orders/me` and `/me/{id}` (orders.self). The admin view is a wider shape, owned by F2b. */
export interface OrderDto {
  Id: string;
  UserId: string;
  Status: OrderStatus;
  /** Provider name ("mock", "manual", ...). */
  Provider: string;
  ProviderRef: string;
  Currency: string;
  Subtotal: Money;
  DiscountAmount: Money;
  /** Always 0 in v1 — there is no tax engine. */
  TaxAmount: Money;
  Total: Money;
  RefundedAmount: Money;
  CouponCode: string | null;
  PlacedAt: string;
  PaidAt: string | null;
  CancelledAt: string | null;
  FailedAt: string | null;
  FailureReason: string | null;
  PaymentReference: string | null;
  Items: OrderItemDto[];
}

/** `EntitlementDto` — `GET /api/entitlements/me` (entitlements.self). The admin view adds resolved names (F2b). */
export interface EntitlementDto {
  Id: string;
  UserId: string;
  ItemType: PurchasableItemType;
  ItemId: string;
  /** Resolved title; null once the item is deleted. */
  Title: string | null;
  Status: EntitlementStatus;
  Source: EntitlementSource;
  OrderId: string | null;
  GrantedAt: string;
  /** Null = perpetual. */
  ExpiresAt: string | null;
  RevokedAt: string | null;
  RevokedReason: string | null;
  Note: string | null;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/** Shared filter shape for the paged "my orders" list. */
export interface MyOrderFilters {
  status?: string;
  page?: number;
  pageSize?: number;
}

/** Shared filter shape for the track list (`GET /api/tracks`). */
export interface TrackFilters {
  status?: string;
  search?: string;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

/** Any date window an admin money screen is looking at; both ends are ISO-8601 (or absent = server default). */
export interface DateRange {
  from?: string;
  to?: string;
}

/** `DateRange` + the currency and bucket size the revenue endpoints also take. */
export interface RevenueRange extends DateRange {
  currency?: string;
  granularity?: RevenueGranularity;
  limit?: number;
}

const range = (r: DateRange | RevenueRange = {}) =>
  [
    r.from ?? '',
    r.to ?? '',
    'currency' in r ? (r.currency ?? '') : '',
    'granularity' in r ? (r.granularity ?? '') : '',
    'limit' in r ? (r.limit ?? 0) : 0,
  ] as const;

const page = (p?: number, size?: number) => [p ?? 1, size ?? 20] as const;

/**
 * Every react-query key used by a billing screen, in one place.
 *
 * `billingKeys.all` is the common prefix, so `queryClient.invalidateQueries({ queryKey: billingKeys.all })` after a
 * purchase, refund or grant refreshes every billing cache at once — which is usually what a money mutation wants,
 * because a single refund touches orders, entitlements, earnings, payouts and revenue simultaneously.
 */
export const billingKeys = {
  all: ['billing'] as const,

  /** Platform currency / checkout switch, read from GET /api/Settings (see `@/lib/money`). */
  settings: () => ['billing', 'settings'] as const,

  /** Trainer checkout (checkout.self). Quotes are keyed by the basket so a re-quote of the same basket is cached. */
  checkout: {
    all: () => ['billing', 'checkout'] as const,
    quote: (items: readonly CheckoutItemDto[] = [], couponCode?: string) =>
      [
        'billing',
        'checkout',
        'quote',
        items.map((i) => `${i.ItemType}:${i.ItemId}`).join(','),
        couponCode ?? '',
      ] as const,
    coupon: (code: string, items: readonly CheckoutItemDto[] = []) =>
      ['billing', 'checkout', 'coupon', code, items.map((i) => `${i.ItemType}:${i.ItemId}`).join(',')] as const,
  },

  /** The signed-in trainer's own orders (orders.self). */
  orders: {
    all: () => ['billing', 'orders'] as const,
    me: (userId?: string, filters: MyOrderFilters = {}) =>
      ['billing', 'orders', 'me', userId ?? '', filters.status ?? '', ...page(filters.page, filters.pageSize)] as const,
    detail: (userId?: string, orderId?: string) => ['billing', 'orders', 'me', userId ?? '', orderId ?? ''] as const,
  },

  /** The signed-in trainer's own access grants (entitlements.self). */
  entitlements: {
    all: () => ['billing', 'entitlements'] as const,
    me: (userId?: string) => ['billing', 'entitlements', 'me', userId ?? ''] as const,
  },

  /** Learning tracks: list/detail are readable by any signed-in user, writes need tracks.manage. */
  tracks: {
    all: () => ['billing', 'tracks'] as const,
    list: (filters: TrackFilters = {}) =>
      [
        'billing',
        'tracks',
        'list',
        filters.status ?? '',
        filters.search ?? '',
        filters.mine ?? false,
        ...page(filters.page, filters.pageSize),
      ] as const,
    detail: (trackId?: string) => ['billing', 'tracks', 'detail', trackId ?? ''] as const,
  },

  /** The signed-in instructor's own ledger (earnings.self). Scoped by the server, keyed by user for cache hygiene. */
  earnings: {
    all: () => ['billing', 'earnings'] as const,
    summary: (userId?: string, r: DateRange = {}) =>
      ['billing', 'earnings', 'summary', userId ?? '', ...range(r)] as const,
    ledger: (userId?: string, filters: DateRange & MyOrderFilters = {}) =>
      [
        'billing',
        'earnings',
        'ledger',
        userId ?? '',
        filters.status ?? '',
        ...range(filters),
        ...page(filters.page, filters.pageSize),
      ] as const,
    payouts: (userId?: string, p?: number, size?: number) =>
      ['billing', 'earnings', 'payouts', userId ?? '', ...page(p, size)] as const,
  },

  /** Admin / Organization money operations. */
  admin: {
    all: () => ['billing', 'admin'] as const,

    orders: {
      all: () => ['billing', 'admin', 'orders'] as const,
      list: (filters: Record<string, unknown> = {}) =>
        [
          'billing',
          'admin',
          'orders',
          'list',
          String(filters.status ?? ''),
          String(filters.userId ?? ''),
          String(filters.provider ?? ''),
          String(filters.itemId ?? ''),
          String(filters.from ?? ''),
          String(filters.to ?? ''),
          String(filters.search ?? ''),
          ...page(filters.page as number | undefined, filters.pageSize as number | undefined),
        ] as const,
      detail: (orderId?: string) => ['billing', 'admin', 'orders', 'detail', orderId ?? ''] as const,
    },

    refunds: {
      all: () => ['billing', 'admin', 'refunds'] as const,
      list: (filters: DateRange & MyOrderFilters = {}) =>
        [
          'billing',
          'admin',
          'refunds',
          'list',
          filters.status ?? '',
          ...range(filters),
          ...page(filters.page, filters.pageSize),
        ] as const,
    },

    coupons: {
      all: () => ['billing', 'admin', 'coupons'] as const,
      list: (filters: { active?: boolean; search?: string; page?: number; pageSize?: number } = {}) =>
        [
          'billing',
          'admin',
          'coupons',
          'list',
          filters.active ?? null,
          filters.search ?? '',
          ...page(filters.page, filters.pageSize ?? 25),
        ] as const,
      redemptions: (couponId?: string, p?: number, size?: number) =>
        ['billing', 'admin', 'coupons', 'redemptions', couponId ?? '', ...page(p, size ?? 25)] as const,
    },

    entitlements: {
      all: () => ['billing', 'admin', 'entitlements'] as const,
      list: (
        filters: { userId?: string; itemType?: string; itemId?: string; status?: string; page?: number; pageSize?: number } = {}
      ) =>
        [
          'billing',
          'admin',
          'entitlements',
          'list',
          filters.userId ?? '',
          filters.itemType ?? '',
          filters.itemId ?? '',
          filters.status ?? '',
          ...page(filters.page, filters.pageSize ?? 25),
        ] as const,
    },

    revenue: {
      all: () => ['billing', 'admin', 'revenue'] as const,
      summary: (r: RevenueRange = {}) => ['billing', 'admin', 'revenue', 'summary', ...range(r)] as const,
      series: (r: RevenueRange = {}) => ['billing', 'admin', 'revenue', 'series', ...range(r)] as const,
      topItems: (r: RevenueRange = {}) => ['billing', 'admin', 'revenue', 'top-items', ...range(r)] as const,
      byInstructor: (r: RevenueRange = {}) => ['billing', 'admin', 'revenue', 'by-instructor', ...range(r)] as const,
    },

    payouts: {
      all: () => ['billing', 'admin', 'payouts'] as const,
      list: (filters: { instructorId?: string; status?: string; page?: number; pageSize?: number } = {}) =>
        [
          'billing',
          'admin',
          'payouts',
          'list',
          filters.instructorId ?? '',
          filters.status ?? '',
          ...page(filters.page, filters.pageSize),
        ] as const,
      eligible: (instructorId?: string, r: DateRange & { currency?: string } = {}) =>
        ['billing', 'admin', 'payouts', 'eligible', instructorId ?? '', r.from ?? '', r.to ?? '', r.currency ?? ''] as const,
      statement: (payoutId?: string) => ['billing', 'admin', 'payouts', 'statement', payoutId ?? ''] as const,
    },
  },
} as const;
