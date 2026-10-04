import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, Building2, FileBarChart, GraduationCap, Receipt, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** `reports.view` (backend Permissions.ReportsView, in the Organization defaults since catalog v9). Spelled out here
 *  rather than added to lib/permissions.ts, which the trainee-performance/course-completion work also touches. */
const REPORTS_VIEW = "reports.view";

interface ReportLink {
    id: string;
    path: string;
    icon: LucideIcon;
    color: string;
    permission: string;
    titleKey: string;
    descriptionKey: string;
}

/**
 * The Reports launcher: one card per dedicated report page. Every report is built on `ReportBuilder`
 * (components/reports/ReportBuilder.tsx) and loads nothing until its own "Generate report" button is clicked.
 * Each card is shown only to a user holding the permission its report's endpoint requires.
 */
const REPORT_LINKS: ReportLink[] = [
    {
        id: "financialOrders",
        path: "/organization/reports/financial",
        icon: Receipt,
        color: "text-emerald-500 bg-emerald-500/10",
        permission: PERMISSIONS.invoicesView,
        titleKey: "reports.launcher.financialOrders.title",
        descriptionKey: "reports.launcher.financialOrders.description",
    },
    {
        id: "departmentAnalytics",
        path: "/organization/reports/department-analytics",
        icon: Building2,
        color: "text-amber-500 bg-amber-500/10",
        permission: PERMISSIONS.organizationView,
        titleKey: "reports.departmentAnalytics.title",
        descriptionKey: "reports.departmentAnalytics.description",
    },
    {
        id: "traineePerformance",
        path: "/organization/reports/trainee-performance",
        icon: GraduationCap,
        color: "text-primary bg-primary/10",
        permission: REPORTS_VIEW,
        titleKey: "reports.cards.trainerPerformance.title",
        descriptionKey: "reports.cards.trainerPerformance.description",
    },
    {
        id: "courseCompletion",
        path: "/organization/reports/course-completion",
        icon: BookOpen,
        color: "text-blue-500 bg-blue-500/10",
        permission: REPORTS_VIEW,
        titleKey: "reports.cards.courseCompletion.title",
        descriptionKey: "reports.cards.courseCompletion.description",
    },
    {
        id: "instructorActivity",
        path: "/organization/reports/instructor-activity",
        icon: Users,
        color: "text-violet-500 bg-violet-500/10",
        permission: REPORTS_VIEW,
        titleKey: "reports.cards.instructorActivity.title",
        descriptionKey: "reports.cards.instructorActivity.description",
    },
];

const OrganizationReports = () => {
    const { t } = useTranslation("organization");

    return (
        <OrganizationPageLayout>
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileBarChart className="w-5 h-5 text-primary" />
                    </div>
                    {t("reports.title")}
                </h1>
                <p className="text-muted-foreground mt-1">{t("reports.subtitle")}</p>
            </div>

            <section aria-label={t("reports.launcher.heading")} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REPORT_LINKS.map((r) => (
                    <Can key={r.id} permission={r.permission}>
                        <Card className="border-border/50" data-testid={`report-card-${r.id}`}>
                            <CardContent className="p-5 flex items-start gap-4 h-full">
                                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", r.color)}>
                                    <r.icon className="w-6 h-6" aria-hidden="true" />
                                </div>
                                <div className="flex-1 flex flex-col h-full">
                                    <h2 className="font-bold text-sm mb-1">{t(r.titleKey)}</h2>
                                    <p className="text-xs text-muted-foreground mb-3 flex-1">{t(r.descriptionKey)}</p>
                                    <div>
                                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                                            <Link to={r.path} aria-label={`${t("reports.launcher.open")}: ${t(r.titleKey)}`}>
                                                {t("reports.launcher.open")}
                                                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Can>
                ))}
            </section>
        </OrganizationPageLayout>
    );
};

export default OrganizationReports;
