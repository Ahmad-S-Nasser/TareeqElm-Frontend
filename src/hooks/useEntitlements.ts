/**
 * What the signed-in trainer has bought and can reach (plan §5.2, permission `entitlements.self`).
 *
 *   GET /api/entitlements/me
 *
 * `Entitlement` is the single source of truth for paid access: one row per item the user owns, newest first, revoked
 * rows included so a buyer can see their own history. There is no user-id parameter — the server always scopes to the
 * caller. Admin grant/revoke lives under /api/admin/entitlements (wave F2b).
 *
 * Note on titles: `EntitlementDto.Title` is declared on the contract but the self endpoint does not populate it today
 * (`EntitlementService.ToDto` copies ids only). Anything rendering an entitlement should therefore take its label
 * from somewhere that has one — an order line's `Title` snapshot, or the course itself — rather than trusting it.
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { billingKeys, type EntitlementDto, type PurchasableItemType } from './useBilling';

/** `GET /api/entitlements/me` — every access grant the caller has ever had, active and revoked, newest first. */
export const useMyEntitlementsQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: billingKeys.entitlements.me(user?.Id),
    queryFn: async () => (await api.get<EntitlementDto[]>('/entitlements/me')).data,
    enabled: !!user,
  });
};

/**
 * The live grant for one item, or `undefined`. "Live" means `Status === 'Active'`: a revoked row (a refund) and an
 * expired one both mean the content is locked again, so neither counts.
 */
export const activeEntitlementFor = (
  entitlements: EntitlementDto[] | undefined,
  itemType: PurchasableItemType,
  itemId: string
): EntitlementDto | undefined =>
  entitlements?.find((e) => e.Status === 'Active' && e.ItemType === itemType && e.ItemId === itemId);
