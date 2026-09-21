import { useTranslation } from "react-i18next";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileBarChart, Download, Users, BookOpen, Building2, GraduationCap, BarChart2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";

interface DeptSummary { Id: string; Name: string; Head: string | null; CoursesCount: number; TrainersCount: number; Performance: number; Trend: number }

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444"];

const reportCards = [
    { id: "trainerPerformance", icon: GraduationCap, color: "text-primary bg-primary/10" },
    { id: "courseCompletion", icon: BookOpen, color: "text-emerald-500 bg-emerald-500/10" },
    { id: "departmentAnalytics", icon: Building2, color: "text-amber-500 bg-amber-500/10" },
    { id: "instructorActivity", icon: Users, color: "text-violet-500 bg-violet-500/10" },
];

const OrganizationReports = () => {
    const { t, i18n } = useTranslation(["organization", "common"]);
    const { formatNumber, formatPercent } = useFormatters();
    const isRtl = i18n.dir() === "rtl";
    const { data: departments = [], isLoading, isError, error } = useQuery({
        queryKey: ["organization-departments"],
        queryFn: async () => (await api.get<DeptSummary[]>("/Departments")).data,
    });

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

            {/* Report Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportCards.map(r => (
                    <Card key={r.id} className="border-border/50">
                        <CardContent className="p-5 flex items-start gap-4">
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", r.color)}>
                                <r.icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-sm mb-1">{t(`reports.cards.${r.id}.title`)}</p>
                                <p className="text-xs text-muted-foreground mb-3">{t(`reports.cards.${r.id}.description`)}</p>
                                <Button variant="outline" size="sm" className="gap-1.5" disabled>
                                    <Download className="w-3.5 h-3.5" /> {t("common:states.comingSoon")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, t("reports.loadFailed"))}</CardContent></Card>
            ) : departments.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">{t("reports.empty")}</CardContent></Card>
            ) : (
                <>
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
                                    <div key={dept.Id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
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
                </>
            )}
        </OrganizationPageLayout>
    );
};

export default OrganizationReports;
