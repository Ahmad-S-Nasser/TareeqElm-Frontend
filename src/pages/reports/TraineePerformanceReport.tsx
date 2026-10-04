/**
 * Organization → Reports → Trainee performance (Phase 4).
 *
 * Grade distribution and pass/fail over quiz attempts in a window, with a paged per-attempt drill-down. Built on the
 * shared `ReportBuilder` shell + `useReportBuilder` state: nothing is fetched until "Generate report" is clicked, and
 * editing a filter afterwards leaves the shown results alone until Generate is clicked again. Paging the drill-down is
 * the one thing that re-queries without a Generate click (it is a view of the same generated report).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, GraduationCap, Target, TrendingUp, Users } from "lucide-react";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Can } from "@/components/routing/Can";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { PerformanceReportFilterFields } from "@/components/reports/PerformanceReportFilterFields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReportBuilder } from "@/hooks/useReportBuilder";
import {
    REPORTS_VIEW,
    TRAINEE_PERFORMANCE_PAGE_SIZE,
    isValidReportRange,
    useTraineePerformanceReportQuery,
    type PerformanceReportFilters,
    type ScoreBucket,
    type TraineePerformanceReport as Report,
} from "@/hooks/usePerformanceReports";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Lowest band red through highest band green — the same semantic run the pass-rate badges use elsewhere. */
const BUCKET_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#10b981", "#059669"];

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

/** The grade distribution as a bar per band. A visually hidden list carries the same numbers for screen readers. */
export const ScoreDistributionChart = ({ buckets }: { buckets: ScoreBucket[] }) => {
    const { t, i18n } = useTranslation("organization");
    const { formatNumber } = useFormatters();
    const isRtl = i18n.dir() === "rtl";
    const data = buckets.map((b) => ({ ...b, Name: t(`reports.traineePerformance.buckets.${b.Label}`, { defaultValue: `${b.Label}%` }) }));

    return (
        <div data-testid="score-distribution" role="img" aria-label={t("reports.traineePerformance.distribution.title")}>
            <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="Name" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} reversed={isRtl} />
                        <YAxis
                            allowDecimals={false}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#6b7280", fontSize: 12 }}
                            orientation={isRtl ? "right" : "left"}
                            width={48}
                            tickFormatter={(v: number) => formatNumber(v)}
                        />
                        <Tooltip
                            cursor={{ fill: "rgba(0,0,0,0.04)" }}
                            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", direction: isRtl ? "rtl" : "ltr" }}
                            formatter={(value: number) => [formatNumber(value), t("reports.traineePerformance.distribution.attempts")]}
                        />
                        <Bar dataKey="Count" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                            {data.map((b, i) => <Cell key={b.Label} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <ul className="sr-only">
                {data.map((b) => (
                    <li key={b.Label} data-testid={`bucket-${b.Label}`}>
                        {b.Name}: {formatNumber(b.Count)}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const Results = ({ report, page, onPage }: { report: Report; page: number; onPage: (page: number) => void }) => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber, formatPercent, formatDateTime } = useFormatters();
    const { Summary: s, Rows: rows } = report;
    const pageSize = report.PageSize || TRAINEE_PERFORMANCE_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(rows.Total / pageSize));

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
                <Kpi icon={Users} label={t("reports.traineePerformance.kpis.attempts")} value={formatNumber(s.AttemptCount)} />
                <Kpi icon={Target} label={t("reports.traineePerformance.kpis.passRate")} value={formatPercent(s.PassRate * 100, { maximumFractionDigits: 1 })} />
                <Kpi icon={TrendingUp} label={t("reports.traineePerformance.kpis.averageScore")} value={formatPercent(s.AverageScore, { maximumFractionDigits: 1 })} />
            </div>

            <Card className="border-border/50">
                <CardHeader><CardTitle className="text-base">{t("reports.traineePerformance.distribution.title")}</CardTitle></CardHeader>
                <CardContent><ScoreDistributionChart buckets={s.DistributionBuckets} /></CardContent>
            </Card>

            {s.Courses.length > 0 && (
                <Card className="border-border/50">
                    <CardHeader><CardTitle className="text-base">{t("reports.traineePerformance.byCourse.title")}</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50 bg-muted/30">
                                        <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.traineePerformance.table.course")}</th>
                                        <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.traineePerformance.kpis.attempts")}</th>
                                        <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.traineePerformance.kpis.passRate")}</th>
                                        <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.traineePerformance.kpis.averageScore")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {s.Courses.map((c) => (
                                        <tr key={c.CourseId} className="border-b border-border/30">
                                            <td className="px-5 py-3">{c.CourseTitle ?? t("common:deletedCourse")}</td>
                                            <td className="px-5 py-3">{formatNumber(c.AttemptCount)}</td>
                                            <td className="px-5 py-3" dir="ltr">{formatPercent(c.PassRate * 100, { maximumFractionDigits: 1 })}</td>
                                            <td className="px-5 py-3" dir="ltr">{formatPercent(c.AverageScore, { maximumFractionDigits: 1 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-border/50">
                <CardHeader><CardTitle className="text-base">{t("reports.traineePerformance.attempts.title")}</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="trainee-performance-rows">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.traineePerformance.table.trainee")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.traineePerformance.table.course")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("reports.traineePerformance.table.quiz")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.traineePerformance.table.score")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("reports.traineePerformance.table.result")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("reports.traineePerformance.table.takenAt")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.Items.map((r) => (
                                    <tr key={r.ResultId} className="border-b border-border/30">
                                        <td className="px-5 py-3 font-semibold">{r.TrainerName ?? t("common:deletedUser")}</td>
                                        <td className="px-5 py-3">{r.CourseTitle ?? t("common:deletedCourse")}</td>
                                        <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">{r.QuizTitle ?? "—"}</td>
                                        <td className="px-5 py-3" dir="ltr">{formatPercent(r.Percentage)}</td>
                                        <td className="px-5 py-3">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-xs font-semibold",
                                                    r.Passed
                                                        ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"
                                                        : "text-destructive border-destructive/20 bg-destructive/5"
                                                )}
                                            >
                                                {r.Passed ? t("reports.traineePerformance.passed") : t("reports.traineePerformance.failed")}
                                            </Badge>
                                        </td>
                                        <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">{formatDateTime(r.TakenAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border/50">
                        <p className="text-xs text-muted-foreground">
                            {t("reports.traineePerformance.pagination.pageOf", { page: formatNumber(page), pages: formatNumber(pageCount), total: formatNumber(rows.Total) })}
                        </p>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} className="gap-1">
                                <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                                {t("reports.traineePerformance.pagination.previous")}
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)} className="gap-1">
                                {t("reports.traineePerformance.pagination.next")}
                                <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const TraineePerformanceBody = () => {
    const { t } = useTranslation("organization");
    const builder = useReportBuilder<PerformanceReportFilters>({});
    const [page, setPage] = useState(1);

    const applied = builder.appliedFilters ?? {};
    const query = useTraineePerformanceReportQuery(
        { ...applied, page, pageSize: TRAINEE_PERFORMANCE_PAGE_SIZE },
        builder.hasGenerated,
        builder.runId
    );
    const rangeValid = isValidReportRange(builder.filters);

    return (
        <ReportBuilder
            title={t("reports.traineePerformance.title")}
            description={t("reports.traineePerformance.subtitle")}
            icon={GraduationCap}
            backTo="/organization/reports"
            filters={<PerformanceReportFilterFields filters={builder.filters} onChange={builder.setFilter} rangeInvalid={!rangeValid} />}
            onGenerate={() => {
                setPage(1);
                builder.generate();
            }}
            canGenerate={rangeValid}
            hasGenerated={builder.hasGenerated}
            isLoading={query.isLoading}
            isFetching={query.isFetching}
            isError={query.isError}
            error={query.error}
            errorMessage={t("reports.traineePerformance.loadFailed")}
            isEmpty={!!query.data && query.data.Summary.AttemptCount === 0}
            emptyMessage={t("reports.traineePerformance.empty")}
            results={query.data ? <Results report={query.data} page={page} onPage={setPage} /> : null}
        />
    );
};

const TraineePerformanceReport = () => {
    const { t } = useTranslation("organization");
    return (
        <OrganizationPageLayout>
            <Can
                permission={REPORTS_VIEW}
                fallback={
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center text-muted-foreground" data-testid="report-no-access">
                            {t("reports.traineePerformance.noAccess")}
                        </CardContent>
                    </Card>
                }
            >
                <TraineePerformanceBody />
            </Can>
        </OrganizationPageLayout>
    );
};

export default TraineePerformanceReport;
