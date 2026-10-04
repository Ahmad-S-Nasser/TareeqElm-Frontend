/**
 * Organization "Catalog & pricing" (phase 5, wave F1c).
 *
 * Reachable by Organization — and by Admin, who holds `pricing.manage` automatically — this is the *only* place in the
 * product where a course or chapter price is set. Instructor course-authoring screens (`InstructorCourses`,
 * `CourseEditor`, `CreateCourse`) stay deliberately price-free: pricing authority belongs to the organization, while an
 * instructor's own read-only revenue lives on `InstructorEarnings`.
 *
 * The table itself is `CatalogPricingManager`, kept as a component so the same surface can later be mounted under the
 * Admin shell (`/admin/catalog`) without duplicating it.
 */
import { useTranslation } from "react-i18next";
import { Tag } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { CatalogPricingManager } from "@/components/billing/CatalogPricingManager";

const OrganizationCatalogPricing = () => {
  const { t } = useTranslation("billing");

  return (
    <OrganizationPageLayout>
      <div className="animate-slide-up">
        <h1 className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-3xl font-bold text-transparent">
          <Tag className="h-8 w-8 text-primary" />
          {t("pricing.title")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("pricing.subtitle")}</p>
      </div>

      <CatalogPricingManager />
    </OrganizationPageLayout>
  );
};

export default OrganizationCatalogPricing;
