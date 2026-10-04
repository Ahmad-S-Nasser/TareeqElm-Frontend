/**
 * Admin → Revenue (phase 5, wave F2a).
 *
 * A thin shell: the Admin sidebar/header layout `AdminAnalytics` established, plus the shared `RevenueDashboard` body.
 * The identical body is mounted under the Organization shell by `OrganizationRevenue` — `revenue.view` is an
 * Organization default as well as an Admin one, and on a single-tenant platform both roles must see exactly the same
 * figures. Anything that would make the two screens differ belongs in the page, never in the body.
 *
 * `RoleGuard` decides who may reach this route at all (base role); `<Can permission={PERMISSIONS.revenueView}>` decides
 * whether the figures themselves are rendered. They are separate questions and both are asked.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { Can } from "@/components/routing/Can";
import { RevenueDashboard } from "@/components/billing/RevenueDashboard";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const AdminRevenue = () => {
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
        </div>
      </main>
    </div>
  );
};

export default AdminRevenue;
