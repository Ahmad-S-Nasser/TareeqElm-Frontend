/**
 * Administrative access grants (plan §5.4, permission `entitlements.manage`, Admin-only — wave F2b).
 *
 *   GET    /api/admin/entitlements?userId=&itemType=&itemId=&status=&page=&pageSize=
 *   POST   /api/admin/entitlements   { UserId, ItemType, ItemId, ExpiresAt?, Note }   -> 201
 *   DELETE /api/admin/entitlements/{id}?reason=                                        -> 204
 *
 * A manual grant is never anonymous: `Note` is required (400 `entitlement.note_required`) and the server stamps the
 * grant with the administrator's id. It is also not only an entitlement — exactly like a purchase, the courses it
 * unlocks get an Active enrollment, which is why every mutation here invalidates the enrollment caches too.
 *
 * The buyer's own read-only view is a different, narrower endpoint (`/api/entitlements/me`, `entitlements.self`),
 * owned by @/hooks/useEntitlements.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type EntitlementSource, type EntitlementStatus, type PurchasableItemType } from './useBilling';

// ---------------------------------------------------------------------------
// DTOs (mirrors of Nafea.Application/DTOs/EntitlementAdminDtos.cs)
// ---------------------------------------------------------------------------

/** `EntitlementAdminDto` — one access grant with every id resolved to a name. */
export interface EntitlementAdminDto {
  Id: string;
  UserId: string;
  /** Null once the account is deleted (the id is still known). */
  UserName: string | null;
  ItemType: PurchasableItemType;
  ItemId: string;
  /** Course/track/chapter title; null once the item is deleted. */
  ItemName: string | null;
  /** The parent course of a Chapter grant (null for Course/Track rows). */
  CourseId: string | null;
  CourseTitle: string | null;
  Status: EntitlementStatus;
  Source: EntitlementSource;
  OrderId: string | null;
  GrantedBy: string | null;
  GrantedByName: string | null;
  GrantedAt: string;
  /** Null = perpetual. */
  ExpiresAt: string | null;
  RevokedAt: string | null;
  RevokedBy: string | null;
  RevokedByName: string | null;
  RevokedReason: string | null;
  /** Why access was handed out for free; always present on an AdminGrant. */
  Note: string | null;
  /** Active and not past its expiry — i.e. it unlocks something right now. */
  GrantsAccess: boolean;
}

export interface EntitlementAdminFilters {
  userId?: string;
  itemType?: string;
  itemId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/** Body of `POST /api/admin/entitlements`. `note` is required by the server, not merely recommended. */
export interface GrantEntitlementInput {
  userId: string;
  itemType: PurchasableItemType;
  itemId: string;
  /** ISO-8601; omitted = permanent access. */
  expiresAt?: string | null;
  /** 3..500 characters. Missing or too short is 400 `entitlement.note_required`. */
  note: string;
}

/** `EntitlementGrantResultDto` — the grant plus the enrollments it had to create. */
export interface EntitlementGrantResultDto {
  Entitlement: EntitlementAdminDto;
  /** Every course this grant unlocks (a track expands to its course list, a chapter to its parent course). */
  UnlockedCourseIds: string[];
  /** How many enrollments were created; an existing Dropped/Pending row is re-activated and does not count. */
  EnrollmentsCreated: number;
}

export interface RevokeEntitlementInput {
  id: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const ADMIN_ENTITLEMENTS_PAGE_SIZE = 25;

export interface EntitlementsAdminPage {
  items: EntitlementAdminDto[];
  total: number;
}

const fetchEntitlements = async (filters: EntitlementAdminFilters): Promise<EntitlementsAdminPage> => {
  const res = await api.get<EntitlementAdminDto[]>('/admin/entitlements', {
    params: {
      userId: filters.userId || undefined,
      itemType: filters.itemType || undefined,
      itemId: filters.itemId || undefined,
      status: filters.status || undefined,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? ADMIN_ENTITLEMENTS_PAGE_SIZE,
    },
  });
  const total = Number(res.headers['x-total-count'] ?? res.data.length);
  return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
};

/** `GET /api/admin/entitlements` — who may reach what, newest grant first (`entitlements.manage`). */
export const useAdminEntitlementsQuery = (filters: EntitlementAdminFilters = {}, enabled = true) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.admin.entitlements.list(filters),
    queryFn: () => fetchEntitlements(filters),
    enabled: !!user && enabled,
    placeholderData: keepPreviousData,
  });
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * A grant or a revoke changes access, enrollments and (for a revoke that follows a refund) the ledger, so both the
 * billing caches and the enrollment caches are dropped. `['enrollments']` is `enrollmentKeys.list`'s prefix
 * (@/hooks/useEnrollments), which is why the Access tab and the Enrollments tab of the same page stay in agreement.
 */
const useInvalidateAccess = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: billingKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
  };
};

/**
 * `POST /api/admin/entitlements` — hands a trainer the access a purchase would have given, without a payment.
 *
 * Failure modes worth surfacing distinctly: 400 `entitlement.note_required` (no reason given), 400
 * `entitlement.invalid` (unknown user or item), 409 `entitlement.already_granted` (they already have it).
 */
export const useGrantEntitlement = () => {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: async ({ userId, itemType, itemId, expiresAt, note }: GrantEntitlementInput) =>
      (
        await api.post<EntitlementGrantResultDto>('/admin/entitlements', {
          UserId: userId,
          ItemType: itemType,
          ItemId: itemId,
          ExpiresAt: expiresAt || undefined,
          Note: note,
        })
      ).data,
    onSuccess: invalidate,
  });
};

/**
 * `DELETE /api/admin/entitlements/{id}?reason=` — takes access back. It mirrors a refund: the entitlement goes first,
 * the enrollments it created are dropped, lesson progress is kept, so re-granting restores everything.
 */
export const useRevokeEntitlement = () => {
  const invalidate = useInvalidateAccess();
  return useMutation({
    mutationFn: async ({ id, reason }: RevokeEntitlementInput) => {
      await api.delete(`/admin/entitlements/${id}`, { params: { reason: reason?.trim() || undefined } });
      return id;
    },
    onSuccess: invalidate,
  });
};
