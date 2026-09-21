import { useState } from "react";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    TrendingUp, TrendingDown, BarChart2, AlertTriangle,
    Download, Users, ArrowUpRight, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";

// Demo data: labels are translation keys under admin:analytics.seed.*
const topicData = [
    { id: 1, avgScore: 62, struggling: 34, dept: "Engineering" },
    { id: 2, avgScore: 71, struggling: 22, dept: "Analytics" },
    { id: 3, avgScore: 88, struggling: 8, dept: "All" },
    { id: 4, avgScore: 55, struggling: 48, dept: "Finance" },
    { id: 5, avgScore: 79, struggling: 15, dept: "IT" },
];

const deptData = [
    { key: "Engineering", completion: 82, avgScore: 88, employees: 62, atRisk: 4 },
    { key: "Finance", completion: 68, avgScore: 74, employees: 38, atRisk: 6 },
    { key: "Operations", completion: 75, avgScore: 80, employees: 55, atRisk: 2 },
    { key: "DesignAndProduct", completion: 91, avgScore: 93, employees: 28, atRisk: 0 },
    { key: "SalesAndMarketing", completion: 60, avgScore: 70, employees: 65, atRisk: 8 },
];

const atRiskEmployees = [
    { id: 1, dept: "Engineering", courseId: 1, score: 32, completion: 10 },
    { id: 2, dept: "Operations", courseId: 2, score: 45, completion: 28 },
    { id: 3, dept: "Sales", courseId: 3, score: 38, completion: 15 },
];

const AdminAnalytics = () => {
    const { t } = useTranslation("admin");
    const { formatPercent, formatNumber } = useFormatters();
    const dept = (key: string) => t(`analytics.seed.departments.${key}`);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { toast } = useToast();

    const handleExport = () => {
        const csv = [
            [t("analytics.csv.department"), t("analytics.csv.completion"), t("analytics.csv.avgScore"), t("analytics.csv.employees"), t("analytics.csv.atRisk")],
            ...deptData.map(d => [dept(d.key), d.completion, d.avgScore, d.employees, d.atRisk]),
        ].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "training_report.csv"; a.click();
        URL.revokeObjectURL(url);
        toast({ title: t("analytics.toast.exported"), description: t("analytics.toast.exportedDescription", { file: "training_report.csv" }) });
    };

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
                        <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 me-2" /> {t("analytics.export")}</Button>
                    </div>

                    {/* KPI bar */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { key: "completion", val: formatPercent(76), trend: "+" + formatPercent(5), up: true, icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10" },
                            { key: "score", val: formatPercent(83), trend: "+" + formatPercent(3), up: true, icon: BarChart2, color: "text-primary bg-primary/10" },
                            { key: "improvement", val: "+" + formatPercent(18), trend: "+" + formatPercent(2), up: true, icon: ArrowUpRight, color: "text-rose-500 bg-rose-500/10" },
                            { key: "atRisk", val: formatNumber(12), trend: "+" + formatNumber(2), up: false, icon: AlertTriangle, color: "text-amber-500 bg-amber-500/10" },
                        ].map((k) => (
                            <Card key={k.key} className="border-border/50">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t(`analytics.kpi.${k.key}`)}</p>
                                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", k.color)}>
                                            <k.icon className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <p dir="ltr" className="text-3xl font-black text-start">{k.val}</p>
                                    <p className={cn("text-xs font-semibold mt-1 flex items-center gap-0.5", k.up ? "text-emerald-500" : "text-destructive")}>
                                        {k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {t("analytics.vsLastMonth", { value: k.trend })}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Topic Difficulty */}
                        <Card className="border-border/50">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-500" /> {t("analytics.topics.title")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {topicData.map((topic) => (
                                    <div key={topic.id}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div>
                                                <span className="text-sm font-semibold">{t(`analytics.seed.topics.${topic.id}`)}</span>
                                                <span className="text-xs text-muted-foreground ms-2">· {dept(topic.dept)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={cn("text-xs font-semibold",
                                                    topic.avgScore >= 80 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" :
                                                        topic.avgScore >= 65 ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20" :
                                                            "text-destructive border-destructive/20 bg-destructive/5"
                                                )}>{t("analytics.topics.avg", { value: formatPercent(topic.avgScore) })}</Badge>
                                                <span className="text-xs text-muted-foreground">{t("analytics.topics.struggling", { value: formatPercent(topic.struggling) })}</span>
                                            </div>
                                        </div>
                                        <Progress value={topic.avgScore} className="h-1.5" />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Department Comparison */}
                        <Card className="border-border/50">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-primary" /> {t("analytics.departments.title")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {deptData.map((d) => (
                                    <div key={d.key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold">{dept(d.key)}</span>
                                                {d.atRisk > 0 && (
                                                    <Badge variant="outline" className="text-xs text-destructive border-destructive/20 bg-destructive/5">
                                                        {t("analytics.departments.atRisk", { count: d.atRisk })}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground text-end">
                                                {t("analytics.departments.doneScore", { completion: formatPercent(d.completion), score: formatPercent(d.avgScore) })}
                                            </div>
                                        </div>
                                        {/* Visual bar */}
                                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-700",
                                                    d.completion >= 85 ? "bg-emerald-500" :
                                                        d.completion >= 70 ? "bg-primary" :
                                                            "bg-amber-500"
                                                )}
                                                style={{ width: `${d.completion}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* At-Risk Employees */}
                    <Card className="border-border/50">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-destructive" /> {t("analytics.flagged.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/50 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                                            <th className="text-start pb-3">{t("analytics.flagged.employee")}</th>
                                            <th className="text-start pb-3 hidden sm:table-cell">{t("analytics.flagged.course")}</th>
                                            <th className="text-start pb-3">{t("analytics.flagged.score")}</th>
                                            <th className="text-start pb-3">{t("analytics.flagged.completion")}</th>
                                            <th className="text-start pb-3">{t("analytics.flagged.action")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {atRiskEmployees.map((e) => {
                                            const name = t(`analytics.seed.people.${e.id}`);
                                            return (
                                            <tr key={e.id} className="border-b border-border/30 last:border-0">
                                                <td className="py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center font-bold text-xs">
                                                            {name.split(" ").map(n => n[0]).join("")}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold">{name}</p>
                                                            <p className="text-xs text-muted-foreground">{dept(e.dept)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-muted-foreground hidden sm:table-cell">{t(`analytics.seed.courses.${e.courseId}`)}</td>
                                                <td className="py-3">
                                                    <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 text-xs font-semibold">{formatPercent(e.score)}</Badge>
                                                </td>
                                                <td className="py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={e.completion} className="h-1.5 w-16" />
                                                        <span className="text-xs text-muted-foreground">{formatPercent(e.completion)}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <Button size="sm" variant="outline" className="text-xs" onClick={() => toast({ title: t("analytics.toast.sessionPlanned"), description: t("analytics.toast.sessionPlannedDescription", { name }) })}>
                                                        <Users className="w-3 h-3 me-1" /> {t("analytics.flagged.followUp")}
                                                    </Button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default AdminAnalytics;
