/**
 * Organization → Coupons (catalog v12's ownership-based split).
 *
 * The same `CouponsManager` body `AdminCoupons` mounts, under `OrganizationPageLayout` instead of the Admin shell —
 * the split `RolesManager`/`CatalogPricingManager`/`RevenueDashboard` already established. `coupons.manage` is now an
 * Organization default as well as an Admin one; the backend scopes every coupon to the caller's own tenant (Admin sees
 * platform-owned coupons only), so this page needs no scoping logic of its own.
 */
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { CouponsManager } from "@/components/billing/CouponsManager";

const OrganizationCoupons = () => (
    <OrganizationPageLayout>
        <CouponsManager />
    </OrganizationPageLayout>
);

export default OrganizationCoupons;
