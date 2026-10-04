/**
 * Organization → Revenue (phase 5, wave F2a; ownership scoping, catalog v12).
 *
 * The same `RevenueDashboard` body `AdminRevenue` mounts, under `OrganizationPageLayout` instead of the Admin shell —
 * the split `RolesManager` (AdminRoles/OrganizationRoles) and `CatalogPricingManager` already established.
 *
 * `revenue.view` defaults to **both** Organization and Admin, but the backend scopes the figures by course ownership
 * (the same "null owner" convention Course/Order/Enrollment/Coupon/Payout use): Admin sees platform-owned courses only,
 * Organization sees its own tenant's only. No frontend change is needed for this — the API already answers each caller
 * with their own scoped numbers.
 */
import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Can } from "@/components/routing/Can";
import { RevenueDashboard } from "@/components/billing/RevenueDashboard";
import { PERMISSIONS } from "@/lib/permissions";

const OrganizationRevenue = () => {
  const { t } = useTranslation("billing");

  return (
    <OrganizationPageLayout>
      <div className="animate-slide-up">
        <h1 className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-3xl font-bold text-transparent">
          <TrendingUp className="h-8 w-8 text-primary" />
          {t("revenue.title")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("revenue.subtitle")}</p>
      </div>

      <Can
        permission={PERMISSIONS.revenueView}
        fallback={
          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{t("revenue.noAccess")}</p>
        }
      >
        <RevenueDashboard />
      </Can>
    </OrganizationPageLayout>
  );
};

export default OrganizationRevenue;
