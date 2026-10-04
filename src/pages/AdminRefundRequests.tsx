/**
 * Admin → Refund requests.
 *
 * A thin shell: the Admin sidebar/header layout `AdminRevenue` uses, plus the shared `RefundRequestsQueue` body that
 * `OrganizationRefundRequests` also mounts. Admin is the fallback reviewer and sees every organization's requests; the
 * direct refund (Admin → Orders, `refunds.manage`) remains a separate, unchanged path.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Undo2 } from "lucide-react";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { Can } from "@/components/routing/Can";
import { RefundRequestsQueue } from "@/components/billing/RefundRequestsQueue";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const AdminRefundRequests = () => {
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
              <Undo2 className="h-8 w-8 text-primary" aria-hidden="true" />
              {t("refundRequest.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">{t("refundRequest.subtitle")}</p>
          </div>

          <Can
            permission={PERMISSIONS.refundRequestsManage}
            fallback={
              <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground" data-testid="refund-requests-no-access">
                {t("refundRequest.noAccess")}
              </p>
            }
          >
            <RefundRequestsQueue />
          </Can>
        </div>
      </main>
    </div>
  );
};

export default AdminRefundRequests;
