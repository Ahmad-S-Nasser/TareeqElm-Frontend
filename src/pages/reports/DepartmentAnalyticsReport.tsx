import { useTranslation } from "react-i18next";
import { BarChart2, Building2, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useReportBuilder } from "@/hooks/useReportBuilder";
import { useDepartmentAnalyticsQuery, type DepartmentAnalyticsFilters, type DepartmentSummary } from "@/hooks/useDepartmentAnalyticsReport";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444"];

/** The bar/pie/summary visuals that used to sit always-on at the bottom of the Reports page, now behind Generate. */
const DepartmentCharts = ({ departments }: { departments: DepartmentSummary[] }) => {
    const { t, i18n } = useTranslation("organization");
    const { formatNumber, formatPercent } = useFormatters();
    const isRtl = i18n.dir() === "rtl";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-primary" /> {t("reports.deptPerformance")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={departments}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="Name" className="text-xs" reversed={isRtl} />
                                <YAxis className="text-xs" domain={[0, 100]} orientation={isRtl ? "right" : "left"} />
                                <Tooltip wrapperStyle={{ direction: isRtl ? "rtl" : "ltr" }} />
                                <Bar dataKey="Performance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t("reports.performanceSeries")} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" /> {t("reports.trainersByDept")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={departments} cx="50%" cy="50%" outerRadius={100} dataKey="TrainersCount" nameKey="Name" label={({ name, value }) => t("reports.pieLabel", { name, value: formatNumber(value) })} labelLine={false}>
                                    {departments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip wrapperStyle={{ direction: isRtl ? "rtl" : "ltr" }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/50">
                <CardHeader>
                    <CardTitle className="text-sm font-bold">{t("reports.deptSummary")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {departments.map((dept, i) => (
                            <div key={dept.Id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30" data-testid={`dept-row-${dept.Id}`}>
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                    i % 5 === 0 && "bg-primary/10 text-primary",
                                    i % 5 === 1 && "bg-accent/10 text-accent",
                                    i % 5 === 2 && "bg-emerald-500/10 text-emerald-500",
                                    i % 5 === 3 && "bg-amber-500/10 text-amber-500",
                                    i % 5 === 4 && "bg-destructive/10 text-destructive",
                                )}>
                                    {dept.Name.slice(0, 2)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-semibold">{dept.Name}</span>
                                        <span className="text-xs text-muted-foreground">{t("reports.trainersCount", { count: dept.TrainersCount })}</span>
                                    </div>
                                    <Progress value={dept.Performance} className="h-1.5" />
                                </div>
                                <div className="text-end shrink-0">
                                    <p className="text-sm font-bold">{formatPercent(Math.round(dept.Performance))}</p>
                                    <p className="text-xs text-muted-foreground">{t("reports.performanceLabel")}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const DepartmentAnalyticsReportBody = () => {
    const { t } = useTranslation("organization");
    const report = useReportBuilder<DepartmentAnalyticsFilters>({ from: "", to: "" });
    const { filters, setFilter } = report;
    const rangeValid = !filters.from || !filters.to || filters.from <= filters.to;

    const { data: departments = [], isLoading, isFetching, isError, error } = useDepartmentAnalyticsQuery(report.appliedFilters, {
        enabled: report.hasGenerated,
        runId: report.runId,
    });

    return (
        <ReportBuilder
            title={t("reports.departmentAnalytics.title")}
            description={t("reports.departmentAnalytics.subtitle")}
            icon={Building2}
            backTo="/organization/reports"
            onGenerate={report.generate}
            hasGenerated={report.hasGenerated}
            canGenerate={rangeValid}
            isLoading={isLoading}
            isFetching={isFetching}
            isError={isError}
            error={error}
            errorMessage={t("reports.departmentAnalytics.loadFailed")}
            isEmpty={departments.length === 0}
            emptyMessage={t("reports.departmentAnalytics.empty")}
            filters={
                <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="dept-report-from">{t("reports.builder.from")}</Label>
                            <Input id="dept-report-from" type="date" value={filters.from ?? ""} onChange={(e) => setFilter("from", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="dept-report-to">{t("reports.builder.to")}</Label>
                            <Input id="dept-report-to" type="date" value={filters.to ?? ""} onChange={(e) => setFilter("to", e.target.value)} />
                        </div>
                    </div>
                    {!rangeValid && <p className="text-xs text-destructive" role="alert">{t("reports.builder.invalidRange")}</p>}
                    <p className="text-xs text-muted-foreground">{t("reports.departmentAnalytics.windowNote")}</p>
                </div>
            }
            results={<DepartmentCharts departments={departments} />}
        />
    );
};

/** Department Analytics report (`GET /Organization/departments?from=&to=`, permission `organization.view`). */
const DepartmentAnalyticsReport = () => {
    const { t } = useTranslation("organization");
    return (
        <OrganizationPageLayout>
            <Can
                permission={PERMISSIONS.organizationView}
                fallback={
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center text-muted-foreground" data-testid="report-no-access">
                            {t("reports.builder.noAccess")}
                        </CardContent>
                    </Card>
                }
            >
                <DepartmentAnalyticsReportBody />
            </Can>
        </OrganizationPageLayout>
    );
};

export default DepartmentAnalyticsReport;
