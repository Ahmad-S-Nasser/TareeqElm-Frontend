/**
 * Organization → Reports → Instructor activity (Phase 5).
 *
 * Per instructor: sessions taught and their attendance rate, content uploads, and current active courses/enrollments.
 * Built on the shared `ReportBuilder` shell + `useReportBuilder` state, mirroring `CourseCompletionReport.tsx`: nothing is
 * fetched until "Generate report" is clicked, and editing a filter afterwards leaves the shown results alone until
 * Generate is clicked again.
 *
 * There is no ratings/reviews column: the platform records no such data, so the report never suggests it does. A null
 * attendance rate (nothing to measure in the window) renders as "—", never as "0%".
 */
import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Can } from "@/components/routing/Can";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { InstructorActivityFilterFields } from "@/components/reports/InstructorActivityFilterFields";
import { Card, CardContent } from "@/components/ui/card";
import { useReportBuilder } from "@/hooks/useReportBuilder";
import {
    isValidInstructorActivityRange,
    useInstructorActivityReportQuery,
    type InstructorActivityFilters,
    type InstructorActivityReport as Report,
} from "@/hooks/useInstructorActivityReport";
import { useFormatters } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

const Results = ({ report }: { report: Report }) => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber, formatPercent } = useFormatters();

    return (
        <Card className="border-border/50">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="instructor-activity-rows">
                        <thead>
                            <tr className="border-b border-border/50 bg-muted/30">
                                <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.instructorActivity.table.instructor")}</th>
                                <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.instructorActivity.table.sessionsTaught")}</th>
                                <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.instructorActivity.table.attendanceRate")}</th>
                                <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.instructorActivity.table.contentUploads")}</th>
                                <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.instructorActivity.table.activeCourses")}</th>
                                <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.instructorActivity.table.activeEnrollments")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.Rows.map((r) => (
                                <tr key={r.InstructorId} className="border-b border-border/30" data-testid={`instructor-activity-row-${r.InstructorId}`}>
                                    <td className="px-5 py-3 font-semibold">{r.InstructorName ?? t("common:deletedUser")}</td>
                                    <td className="px-5 py-3">{formatNumber(r.SessionsTaught)}</td>
                                    <td className="px-5 py-3" dir="ltr" data-testid="attendance-rate">
                                        {r.AttendanceRate == null ? (
                                            <span title={t("reports.instructorActivity.noAttendance")}>
                                                <span aria-hidden="true">—</span>
                                                <span className="sr-only">{t("reports.instructorActivity.noAttendance")}</span>
                                            </span>
                                        ) : (
                                            formatPercent(r.AttendanceRate * 100, { maximumFractionDigits: 1 })
                                        )}
                                    </td>
                                    <td className="px-5 py-3">{formatNumber(r.ContentUploads)}</td>
                                    <td className="px-5 py-3">{formatNumber(r.ActiveCourses)}</td>
                                    <td className="px-5 py-3">{formatNumber(r.ActiveEnrollments)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

const InstructorActivityBody = () => {
    const { t } = useTranslation("organization");
    const builder = useReportBuilder<InstructorActivityFilters>({});

    const applied = builder.appliedFilters ?? {};
    const query = useInstructorActivityReportQuery(applied, builder.hasGenerated, builder.runId);
    const rangeValid = isValidInstructorActivityRange(builder.filters);

    return (
        <ReportBuilder
            title={t("reports.instructorActivity.title")}
            description={t("reports.instructorActivity.subtitle")}
            icon={Activity}
            backTo="/organization/reports"
            filters={<InstructorActivityFilterFields filters={builder.filters} onChange={builder.setFilter} rangeInvalid={!rangeValid} />}
            onGenerate={builder.generate}
            canGenerate={rangeValid}
            hasGenerated={builder.hasGenerated}
            isLoading={query.isLoading}
            isFetching={query.isFetching}
            isError={query.isError}
            error={query.error}
            errorMessage={t("reports.instructorActivity.loadFailed")}
            isEmpty={!!query.data && query.data.Rows.length === 0}
            emptyMessage={t("reports.instructorActivity.empty")}
            results={query.data ? <Results report={query.data} /> : null}
        />
    );
};

const InstructorActivityReport = () => {
    const { t } = useTranslation("organization");
    return (
        <OrganizationPageLayout>
            <Can
                permission={PERMISSIONS.reportsView}
                fallback={
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center text-muted-foreground" data-testid="report-no-access">
                            {t("reports.instructorActivity.noAccess")}
                        </CardContent>
                    </Card>
                }
            >
                <InstructorActivityBody />
            </Can>
        </OrganizationPageLayout>
    );
};

export default InstructorActivityReport;
