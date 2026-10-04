/**
 * Discount-code administration (phase 5, wave F2c) — `coupons.manage`, Admin-only.
 *
 *   GET    /api/admin/coupons?active=&search=&page=&pageSize=   total in X-Total-Count
 *   POST   /api/admin/coupons                                   201 + the created coupon
 *   PUT    /api/admin/coupons/{id}                              204
 *   DELETE /api/admin/coupons/{id}                              204 deleted | 200 + CouponDeleteResult (deactivated)
 *   GET    /api/admin/coupons/{id}/redemptions?page=&pageSize=  total in X-Total-Count
 *
 * **The delete has two successful outcomes and neither is an error.** A coupon nobody ever redeemed is really gone
 * (204). One that was used is only switched off (200 + a body explaining why), because deleting it would orphan the
 * redemption rows an order's history points at. `useDeleteCoupon` normalises both into one `CouponDeleteResult`, so a
 * caller branches on `Deleted`/`Deactivated` instead of on an HTTP status — and the "deactivated instead" case is an
 * *informational* toast, never a destructive one.
 *
 * Money is never computed here: what a coupon is worth at checkout is decided by the backend's CouponService. These
 * hooks only manage the documents it reads.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import {
  billingKeys,
  type CouponKind,
  type Money,
  type OrderStatus,
  type PurchasableItemType,
} from './useBilling';

/** `CouponScopeDto` — restricts a coupon to one item type, optionally to a single item. */
export interface CouponScope {
  ItemType: PurchasableItemType;
  /** Null/empty = every item of `ItemType`. */
  ItemId: string | null;
}

/** `CouponDto` — one coupon as the admin screen sees it. */
export interface Coupon {
  Id: string;
  Code: string;
  Description: string | null;
  Kind: CouponKind;
  /** 0..100, set on a `Percentage` coupon. */
  Percentage: number | null;
  /** Set on a `FixedAmount` coupon, together with `Currency`. */
  AmountOff: Money | null;
  Currency: string | null;
  MinSubtotal: Money | null;
  /** Null = unlimited. */
  MaxRedemptions: number | null;
  /** 0 = no per-buyer limit. */
  MaxRedemptionsPerUser: number;
  /** Denormalized cache refreshed from a real count on every write; enforcement never trusts it. */
  RedeemedCount: number;
  StartsAt: string | null;
  EndsAt: string | null;
  IsActive: boolean;
  /** Switched on **and** inside its date window right now — server-decided, never recomputed here. */
  IsLive: boolean;
  /** Empty = applies to everything. */
  AppliesTo: CouponScope[];
  CreatedAt: string;
  UpdatedAt: string;
}

/** `CouponWriteDto` — the create/update body. The server uppercases and trims the code. */
export interface CouponWrite {
  Code: string;
  Description?: string | null;
  Kind: CouponKind;
  Percentage?: number | null;
  AmountOff?: Money | null;
  Currency?: string | null;
  MinSubtotal?: Money | null;
  MaxRedemptions?: number | null;
  MaxRedemptionsPerUser: number;
  StartsAt?: string | null;
  EndsAt?: string | null;
  IsActive: boolean;
  AppliesTo?: CouponScope[];
}

/** `CouponDeleteResultDto` — what the delete actually did. Synthesised for the 204 case (see the file header). */
export interface CouponDeleteResult {
  Id: string;
  Code: string;
  /** The document is gone. */
  Deleted: boolean;
  /** The document was kept and switched off instead, because it had already been redeemed. */
  Deactivated: boolean;
  RedeemedCount: number;
  Note: string;
}

/** `CouponRedemptionDto` — one use of a coupon, with the buyer's resolved name and a link to the order. */
export interface CouponRedemption {
  Id: string;
  CouponId: string;
  CouponCode: string;
  UserId: string;
  /** Null once the buyer's account is gone (the id is still shown). */
  UserName: string | null;
  OrderId: string;
  /** Client-side route of the admin order page for `OrderId` — the server builds it, the UI just links to it. */
  OrderLink: string;
  OrderStatus: OrderStatus | null;
  OrderTotal: Money | null;
  Currency: string | null;
  AmountDiscounted: Money;
  RedeemedAt: string;
}

export interface CouponFilters {
  /** `true` = active only, `false` = inactive only, omitted = both. */
  active?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** A page of rows plus the server's total, read from `X-Total-Count`. */
export interface CouponsPage<T> {
  items: T[];
  total: number;
}

export const COUPONS_PAGE_SIZE = 20;
export const REDEMPTIONS_PAGE_SIZE = 10;

const totalOf = (headers: Record<string, unknown>, fallback: number) => {
  const total = Number(headers['x-total-count'] ?? fallback);
  return Number.isFinite(total) ? total : fallback;
};

/** `GET /api/admin/coupons` — newest first, paged, optionally filtered by state and a code/description search. */
export const useAdminCouponsQuery = (filters: CouponFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.coupons.list(filters),
    queryFn: async (): Promise<CouponsPage<Coupon>> => {
      const res = await api.get<Coupon[]>('/admin/coupons', {
        params: {
          active: filters.active,
          search: filters.search?.trim() || undefined,
          page: filters.page ?? 1,
          pageSize: filters.pageSize ?? COUPONS_PAGE_SIZE,
        },
      });
      return { items: res.data, total: totalOf(res.headers, res.data.length) };
    },
    enabled: !!user,
    // Paging or re-searching should not blink the table back to a spinner.
    placeholderData: keepPreviousData,
  });
};

/** `GET /api/admin/coupons/{id}/redemptions` — who used this coupon, on which order. */
export const useCouponRedemptionsQuery = (couponId?: string | null, page = 1, pageSize = REDEMPTIONS_PAGE_SIZE) =>
  useQuery({
    queryKey: billingKeys.admin.coupons.redemptions(couponId ?? undefined, page, pageSize),
    queryFn: async (): Promise<CouponsPage<CouponRedemption>> => {
      const res = await api.get<CouponRedemption[]>(`/admin/coupons/${couponId}/redemptions`, {
        params: { page, pageSize },
      });
      return { items: res.data, total: totalOf(res.headers, res.data.length) };
    },
    enabled: !!couponId,
    placeholderData: keepPreviousData,
  });

/**
 * Every coupon cache, plus the checkout caches a coupon change invalidates (a quote carries the discount it granted).
 * `billingKeys.all` is the shared prefix, so one call covers both.
 */
const useInvalidateCoupons = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: billingKeys.admin.coupons.all() });
    void queryClient.invalidateQueries({ queryKey: billingKeys.checkout.all() });
  };
};

/** `POST /api/admin/coupons` — 409 `coupon.code_exists` when the code is taken. */
export const useCreateCoupon = () => {
  const invalidate = useInvalidateCoupons();
  return useMutation({
    mutationFn: async (body: CouponWrite) => (await api.post<Coupon>('/admin/coupons', body)).data,
    onSuccess: invalidate,
  });
};

/** `PUT /api/admin/coupons/{id}` — 204. `RedeemedCount` is never writable: the redemption path owns it. */
export const useUpdateCoupon = () => {
  const invalidate = useInvalidateCoupons();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: CouponWrite }) => {
      await api.put(`/admin/coupons/${id}`, body);
      return id;
    },
    onSuccess: invalidate,
  });
};

/**
 * `DELETE /api/admin/coupons/{id}` — resolves for **both** successful outcomes:
 *   204 (no body)            -> `{ Deleted: true,  Deactivated: false }`, synthesised from what the caller passed in;
 *   200 + CouponDeleteResult -> the server's own body, `{ Deleted: false, Deactivated: true }` plus its note.
 * Only a real failure (404/500/network) rejects.
 */
export const useDeleteCoupon = () => {
  const invalidate = useInvalidateCoupons();
  return useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }): Promise<CouponDeleteResult> => {
      const res = await api.delete<CouponDeleteResult | ''>(`/admin/coupons/${id}`);
      const body = res.data;
      if (res.status === 204 || !body || typeof body !== 'object') {
        return { Id: id, Code: code, Deleted: true, Deactivated: false, RedeemedCount: 0, Note: '' };
      }
      return { ...body, Id: body.Id || id, Code: body.Code || code };
    },
    onSuccess: invalidate,
  });
};

// ---------------------------------------------------------------------------
// Scope pickers — a coupon may be restricted to one item, and an id is never shown to a human.
// ---------------------------------------------------------------------------

/** A track as the scope picker reads it (`TrackSummaryDto`); only the two fields the picker needs. */
export interface TrackOption {
  Id: string;
  Title: string;
  Status: string;
  CoursesCount: number;
}

/**
 * `GET /api/tracks` — readable by any signed-in caller. Used only to turn a track id into a title in the scope picker;
 * the full track management surface lands with wave F3a.
 */
export const useTrackOptionsQuery = (enabled = true) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.tracks.list({ pageSize: 200 }),
    queryFn: async () => (await api.get<TrackOption[]>('/tracks', { params: { page: 1, pageSize: 200 } })).data,
    enabled: enabled && !!user,
    staleTime: 60_000,
  });
};
