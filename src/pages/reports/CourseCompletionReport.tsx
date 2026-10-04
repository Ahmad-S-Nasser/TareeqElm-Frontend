/**
 * Organization → Reports → Course completion (Phase 4).
 *
 * Completion, dropout, and average time-to-complete rates by course over a date range. Built on the shared
 * `ReportBuilder` shell + `useReportBuilder` state, mirroring `TraineePerformanceReport.tsx`: nothing is fetched until
 * "Generate report" is clicked, and editing a filter afterwards leaves the shown results alone until Generate is
 * clicked again.
 */
import { useTranslation } from "react-i18next";
import { BookCheck, Percent, TrendingDown, Users } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Can } from "@/components/routing/Can";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { PerformanceReportFilterFields } from "@/components/reports/PerformanceReportFilterFields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReportBuilder } from "@/hooks/useReportBuilder";
import {
    REPORTS_VIEW,
    isValidReportRange,
    useCourseCompletionReportQuery,
    type CourseCompletionReport as Report,
    type PerformanceReportFilters,
} from "@/hooks/usePerformanceReports";
import { useFormatters } from "@/lib/format";

const Kpi = ({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) => (
    <Card className="border-border/50">
        <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-black" dir="ltr">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
            </div>
        </CardContent>
    </Card>
);

const Results = ({ report }: { report: Report }) => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber, formatPercent } = useFormatters();

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-4">
                <Kpi icon={Users} label={t("reports.courseCompletion.kpis.enrollments")} value={formatNumber(report.EnrollmentCount)} />
                <Kpi icon={BookCheck} label={t("reports.courseCompletion.kpis.completionRate")} value={formatPercent(report.CompletionRate * 100, { maximumFractionDigits: 1 })} />
                <Kpi
                    icon={Percent}
                    label={t("reports.courseCompletion.kpis.averageDays")}
                    value={report.AverageDaysToComplete == null ? "—" : formatNumber(report.AverageDaysToComplete, { maximumFractionDigits: 1 })}
                />
                <Kpi icon={TrendingDown} label={t("reports.courseCompletion.kpis.dropoutRate")} value={formatPercent(report.DropoutRate * 100, { maximumFractionDigits: 1 })} />
            </div>

            <Card className="border-border/50">
                <CardHeader><CardTitle className="text-base">{t("reports.traineePerformance.byCourse.title")}</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="course-completion-rows">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.courseCompletion.table.course")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.courseCompletion.table.enrollments")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.courseCompletion.table.completed")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.courseCompletion.table.dropped")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.courseCompletion.table.completionRate")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.courseCompletion.table.averageDays")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.courseCompletion.table.dropoutRate")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.Rows.map((r) => (
                                    <tr key={r.CourseId} className="border-b border-border/30">
                                        <td className="px-5 py-3 font-semibold">{r.CourseTitle ?? t("common:deletedCourse")}</td>
                                        <td className="px-5 py-3">{formatNumber(r.EnrollmentCount)}</td>
                                        <td className="px-5 py-3">{formatNumber(r.CompletedCount)}</td>
                                        <td className="px-5 py-3">{formatNumber(r.DroppedCount)}</td>
                                        <td className="px-5 py-3" dir="ltr">{formatPercent(r.CompletionRate * 100, { maximumFractionDigits: 1 })}</td>
                                        <td className="px-5 py-3" dir="ltr">
                                            {r.AverageDaysToComplete == null ? t("reports.courseCompletion.noCompletions") : formatNumber(r.AverageDaysToComplete, { maximumFractionDigits: 1 })}
                                        </td>
                                        <td className="px-5 py-3" dir="ltr">{formatPercent(r.DropoutRate * 100, { maximumFractionDigits: 1 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const CourseCompletionBody = () => {
    const { t } = useTranslation("organization");
    const builder = useReportBuilder<PerformanceReportFilters>({});

    const applied = builder.appliedFilters ?? {};
    const query = useCourseCompletionReportQuery(applied, builder.hasGenerated, builder.runId);
    const rangeValid = isValidReportRange(builder.filters);

    return (
        <ReportBuilder
            title={t("reports.courseCompletion.title")}
            description={t("reports.courseCompletion.subtitle")}
            icon={BookCheck}
            backTo="/organization/reports"
            filters={<PerformanceReportFilterFields filters={builder.filters} onChange={builder.setFilter} rangeInvalid={!rangeValid} />}
            onGenerate={builder.generate}
            canGenerate={rangeValid}
            hasGenerated={builder.hasGenerated}
            isLoading={query.isLoading}
            isFetching={query.isFetching}
            isError={query.isError}
            error={query.error}
            errorMessage={t("reports.courseCompletion.loadFailed")}
            isEmpty={!!query.data && query.data.EnrollmentCount === 0}
            emptyMessage={t("reports.courseCompletion.empty")}
            results={query.data ? <Results report={query.data} /> : null}
        />
    );
};

const CourseCompletionReport = () => {
    const { t } = useTranslation("organization");
    return (
        <OrganizationPageLayout>
            <Can
                permission={REPORTS_VIEW}
                fallback={
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center text-muted-foreground" data-testid="report-no-access">
                            {t("reports.courseCompletion.noAccess")}
                        </CardContent>
                    </Card>
                }
            >
                <CourseCompletionBody />
            </Can>
        </OrganizationPageLayout>
    );
};

export default CourseCompletionReport;
