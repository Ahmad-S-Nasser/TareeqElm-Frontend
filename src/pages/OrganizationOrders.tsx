/**
 * Organization → Orders (catalog v12's ownership-based split).
 *
 * The same `OrdersManager` body `AdminOrders` mounts, under `OrganizationPageLayout` instead of the Admin shell —
 * the split `RolesManager`/`CatalogPricingManager`/`CouponsManager`/`PayoutsManager` already established.
 * `orders.manage` is now an Organization default as well as an Admin one; the backend scopes every order to the
 * caller's own tenant (Admin sees platform-owned orders only), so this page needs no scoping logic of its own.
 */
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { OrdersManager } from "@/components/billing/OrdersManager";

const OrganizationOrders = () => (
    <OrganizationPageLayout>
        <OrdersManager />
    </OrganizationPageLayout>
);

export default OrganizationOrders;
