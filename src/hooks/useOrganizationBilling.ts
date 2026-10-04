/**
 * Organization → Billing (catalog v12 phase 4): the caller's own tenant's trainee seat cap and current usage.
 *
 *   GET /api/Organization/billing -> OrganizationSeatUsageDto | 204 (Admin, who belongs to no tenant)
 *
 * Package tiers themselves (price, cap) are not here — they ride `GET /api/Settings` (see `useCheckoutSettings` in
 * `./useCheckout`), since every signed-in caller needs to see them to shop, not just an Organization. Purchasing one
 * is an ordinary `POST /api/checkout` with a `PackageSubscription` line, the same `useCreateCheckout` flow
 * `OrganizationPlatformCourses.tsx` already uses for a course license.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** `OrganizationSeatUsageDto`. */
export interface OrganizationSeatUsageDto {
  /** Null = uncapped. */
  TraineeCap: number | null;
  PackageTier: string | null;
  UsedSeats: number;
}

const seatUsageKey = ['organization-billing', 'seat-usage'] as const;

/** 204 (Admin) resolves to `null`, not an error — Admin belongs to no tenant. */
export const useSeatUsageQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: seatUsageKey,
    queryFn: async (): Promise<OrganizationSeatUsageDto | null> => {
      const res = await api.get<OrganizationSeatUsageDto | ''>('/Organization/billing');
      if (res.status === 204 || !res.data) return null;
      return res.data;
    },
    enabled: !!user,
  });
};

/** Invalidated after a successful package checkout so the usage card reflects the new cap without a hard reload. */
export const useInvalidateSeatUsage = () => {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: seatUsageKey });
};
