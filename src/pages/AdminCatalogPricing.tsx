/**
 * Admin → Catalog & pricing (phase 5, wave F3a).
 *
 * A thin shell: the Admin sidebar/header layout `AdminRevenue` established, plus the shared `CatalogPricingManager`
 * body (courses & chapter prices, and tracks). The identical body is mounted under the Organization shell by
 * `OrganizationCatalogPricing` — `pricing.manage` and `tracks.manage` are Organization defaults as well as Admin ones,
 * and on a single-tenant platform both roles must see exactly the same catalogue. Anything that would make the two
 * screens differ belongs in the page, never in the body.
 *
 * `RoleGuard` decides who may reach `/admin/catalog` at all (base role); the `<Can>` gates *inside* the body decide
 * which controls render, and they are per-permission: a price control asks for `pricing.manage`, a track control for
 * `tracks.manage`. This page deliberately adds no gate of its own, so it cannot drift from the Organization one.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "lucide-react";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { CatalogPricingManager } from "@/components/billing/CatalogPricingManager";
import { cn } from "@/lib/utils";

const AdminCatalogPricing = () => {
  const { t } = useTranslation("billing");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar onCollapse={setSidebarCollapsed} />
      <Header
        sidebarCollapsed={sidebarCollapsed}
        userRole="Admin"
        mobileSidebar={<AdminSidebarContent collapsed={false} />}
      />
      <main
        className={cn(
          "px-4 pb-12 pt-20 transition-all duration-300 sm:px-6",
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64"
        )}
      >
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="animate-slide-up">
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Tag className="h-8 w-8 text-primary" />
              {t("pricing.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">{t("pricing.subtitle")}</p>
          </div>

          <CatalogPricingManager />
        </div>
      </main>
    </div>
  );
};

export default AdminCatalogPricing;
