/**
 * Organization → Refund requests.
 *
 * The same `RefundRequestsQueue` body `AdminRefundRequests` mounts, under `OrganizationPageLayout` instead of the Admin
 * shell (the `OrganizationRevenue`/`AdminRevenue` split). The selling Organization is the default reviewer of its own
 * trainees' requests; the server scopes the list and every decision to the caller's organization.
 */
import { useTranslation } from "react-i18next";
import { Undo2 } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Can } from "@/components/routing/Can";
import { RefundRequestsQueue } from "@/components/billing/RefundRequestsQueue";
import { PERMISSIONS } from "@/lib/permissions";

const OrganizationRefundRequests = () => {
  const { t } = useTranslation("billing");

  return (
    <OrganizationPageLayout>
      <div className="animate-slide-up">
        <h1 className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-3xl font-bold text-transparent">
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
    </OrganizationPageLayout>
  );
};

export default OrganizationRefundRequests;
