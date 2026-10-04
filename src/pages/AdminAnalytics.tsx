import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, BarChart2, Download, GraduationCap, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { useAtRiskTrainersQuery } from "@/hooks/useAtRiskTrainers";

interface OrganizationStats {
    TotalTrainers: number;
    ActiveInstructors: number;
    TotalCourses: number;
    AvgCompletion: number;
}

const AdminAnalytics = () => {
    const { t } = useTranslation("admin");
    const { formatPercent, formatNumber } = useFormatters();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { toast } = useToast();

    const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErrorObj } = useQuery({
        queryKey: ["organization-stats"],
        queryFn: async () => (await api.get<OrganizationStats>("/Organization/stats")).data,
    });
    const { data: atRisk = [], isLoading: atRiskLoading, isError: atRiskError, error: atRiskErrorObj } = useAtRiskTrainersQuery();

    const loading = statsLoading || atRiskLoading;
    const hasError = statsError || atRiskError;

    const handleExport = () => {
        const csv = [
            [t("analytics.csv.trainer"), t("analytics.csv.course"), t("analytics.csv.department"), t("analytics.csv.daysInactive"), t("analytics.csv.progress")],
            ...atRisk.map((r) => [r.TrainerName, r.CourseTitle, r.DepartmentName ?? "", r.DaysInactive, Math.round(r.ProgressPercentage)]),
        ].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "at_risk_trainers.csv"; a.click();
        URL.revokeObjectURL(url);
        toast({ title: t("analytics.toast.exported"), description: t("analytics.toast.exportedDescription", { file: "at_risk_trainers.csv" }) });
    };

    const kpis = [
        { key: "totalTrainers", val: stats ? formatNumber(stats.TotalTrainers) : "-", icon: Users, color: "text-primary bg-primary/10" },
        { key: "activeInstructors", val: stats ? formatNumber(stats.ActiveInstructors) : "-", icon: GraduationCap, color: "text-emerald-500 bg-emerald-500/10" },
        { key: "completion", val: stats ? formatPercent(stats.AvgCompletion) : "-", icon: BarChart2, color: "text-blue-500 bg-blue-500/10" },
        { key: "atRisk", val: formatNumber(atRisk.length), icon: AlertTriangle, color: "text-amber-500 bg-amber-500/10" },
    ];

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black">{t("analytics.title")}</h1>
                            <p className="text-muted-foreground text-sm mt-1">{t("analytics.subtitle")}</p>
                        </div>
                        <Button variant="outline" onClick={handleExport} disabled={atRisk.length === 0}><Download className="w-4 h-4 me-2" /> {t("analytics.export")}</Button>
                    </div>

                    {hasError && (
                        <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{getApiError(statsErrorObj ?? atRiskErrorObj, t("analytics.loadFailed"))}</CardContent></Card>
                    )}

                    {/* KPI bar */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {kpis.map((k) => (
                            <Card key={k.key} className="border-border/50">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t(`analytics.kpi.${k.key}`)}</p>
                                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", k.color)}>
                                            <k.icon className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <p dir="ltr" className="text-3xl font-black text-start">{loading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : k.val}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* At-Risk Trainers */}
                    <Card className="border-border/50">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-destructive" /> {t("analytics.flagged.title")}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">{t("analytics.flagged.subtitle")}</p>
                        </CardHeader>
                        <CardContent>
                            {atRiskLoading ? (
                                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                            ) : atRiskError ? (
                                <p className="text-center py-12 text-destructive text-sm">{getApiError(atRiskErrorObj, t("analytics.loadFailed"))}</p>
                            ) : atRisk.length === 0 ? (
                                <p className="text-center py-12 text-muted-foreground text-sm">{t("analytics.flagged.empty")}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border/50 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                                                <th className="text-start pb-3">{t("analytics.flagged.trainer")}</th>
                                                <th className="text-start pb-3 hidden sm:table-cell">{t("analytics.flagged.course")}</th>
                                                <th className="text-start pb-3 hidden md:table-cell">{t("analytics.flagged.department")}</th>
                                                <th className="text-start pb-3">{t("analytics.flagged.daysInactive")}</th>
                                                <th className="text-start pb-3">{t("analytics.flagged.progress")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {atRisk.map((r) => (
                                                <tr key={`${r.TrainerId}-${r.CourseId}`} className="border-b border-border/30 last:border-0">
                                                    <td className="py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center font-bold text-xs shrink-0">
                                                                {r.TrainerName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <p className="font-semibold">{r.TrainerName}</p>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 text-muted-foreground hidden sm:table-cell">{r.CourseTitle}</td>
                                                    <td className="py-3 text-muted-foreground hidden md:table-cell">{r.DepartmentName ?? "-"}</td>
                                                    <td className="py-3">
                                                        <span className="text-destructive font-semibold">{formatNumber(r.DaysInactive)}</span>
                                                    </td>
                                                    <td className="py-3">
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={r.ProgressPercentage} className="h-1.5 w-16" />
                                                            <span className="text-xs text-muted-foreground">{formatPercent(r.ProgressPercentage)}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default AdminAnalytics;
