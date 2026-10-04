/**
 * Organization → Payouts (catalog v12's ownership-based split).
 *
 * The same `PayoutsManager` body `AdminPayouts` mounts, under `OrganizationPageLayout` instead of the Admin shell —
 * the split `RolesManager`/`CatalogPricingManager`/`CouponsManager` already established. `payouts.manage` is now an
 * Organization default as well as an Admin one; the backend scopes every payout and instructor to the caller's own
 * tenant (Admin sees/pays platform instructors only), so this page needs no scoping logic of its own.
 */
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { PayoutsManager } from "@/components/billing/PayoutsManager";

const OrganizationPayouts = () => (
    <OrganizationPageLayout>
        <PayoutsManager />
    </OrganizationPageLayout>
);

export default OrganizationPayouts;
