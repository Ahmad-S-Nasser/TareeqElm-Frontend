import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { Can } from "@/components/routing/Can";
import { FinancialAnalyticsPanel } from "@/components/billing/FinancialAnalyticsPanel";
import { PERMISSIONS } from "@/lib/permissions";

interface DeptSummary { Id: string; Name: string; Head: string | null; CoursesCount: number; TrainersCount: number; Performance: number; Trend: number }
interface OrganizationStats {
    Stats: { TotalTrainers: number; ActiveInstructors: number; TotalCourses: number; AvgCompletion: number };
    Departments: DeptSummary[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8b5cf6', '#ec4899'];

const NotAvailable = ({ text }: { text: string }) => {
    const { t } = useTranslation("organization");
    return (
        <Card className="border-border/50 shadow-soft">
            <CardContent className="p-12 text-center">
                <p className="font-semibold">{t("notAvailable")}</p>
                <p className="text-sm text-muted-foreground mt-1">{text}</p>
            </CardContent>
        </Card>
    );
};

const OrganizationAnalytics = () => {
    const { t, i18n } = useTranslation(["organization", "common"]);
    const { formatNumber, formatPercent } = useFormatters();
    const isRtl = i18n.dir() === "rtl";
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["organization-stats"],
        queryFn: async () => (await api.get<OrganizationStats>("/Organization/stats")).data,
    });

    const stats = data?.Stats;
    const departments = data?.Departments ?? [];

    return (
        <div className="min-h-screen bg-background">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Organization"
                mobileSidebar={<OrganizationSidebarContent collapsed={false} />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
                "ms-0"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="animate-slide-up">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                            {t("analytics.title")}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {t("analytics.subtitle")}
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : isError ? (
                        <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, t("analytics.loadFailed"))}</CardContent></Card>
                    ) : (
                    <Tabs defaultValue="enrollment" className="animate-slide-up" style={{ animationDelay: "100ms" }}>
                        <TabsList className="bg-card border border-border/50 shadow-sm p-1 rounded-xl mb-6">
                            <TabsTrigger value="enrollment" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{t("analytics.tabs.enrollment")}</TabsTrigger>
                            <TabsTrigger value="academic" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{t("analytics.tabs.academic")}</TabsTrigger>
                            <TabsTrigger value="financial" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">{t("analytics.tabs.financial")}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="enrollment" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="border-border/50 shadow-soft hover:shadow-lg transition-all">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">{t("analytics.totalTrainers")}</CardTitle>
                                        <CardTitle className="text-3xl font-bold text-primary">{formatNumber(stats?.TotalTrainers ?? 0)}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="border-border/50 shadow-soft hover:shadow-lg transition-all">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">{t("analytics.activeInstructors")}</CardTitle>
                                        <CardTitle className="text-3xl font-bold text-accent">{formatNumber(stats?.ActiveInstructors ?? 0)}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="border-border/50 shadow-soft hover:shadow-lg transition-all">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">{t("analytics.completionRate")}</CardTitle>
                                        <CardTitle className="text-3xl font-bold text-blue-500">{formatPercent(stats?.AvgCompletion ?? 0)}</CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>

                            {departments.length === 0 ? (
                                <NotAvailable text={t("analytics.trendsNotAvailable")} />
                            ) : (
                                <Card className="border-border/50 shadow-soft">
                                    <CardHeader>
                                        <CardTitle>{t("analytics.trainersByDept")}</CardTitle>
                                        <CardDescription>{t("analytics.trainersByDeptDesc")}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-[400px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={departments}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="Name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} reversed={isRtl} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} allowDecimals={false} orientation={isRtl ? "right" : "left"} />
                                                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', direction: isRtl ? 'rtl' : 'ltr' }} />
                                                <Bar dataKey="TrainersCount" name={t("analytics.trainersSeries")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="academic" className="space-y-6">
                            {departments.length === 0 ? (
                                <NotAvailable text={t("analytics.noDeptData")} />
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card className="border-border/50 shadow-soft">
                                        <CardHeader>
                                            <CardTitle>{t("analytics.deptPerformance")}</CardTitle>
                                            <CardDescription>{t("analytics.deptPerformanceDesc")}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-[350px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={departments}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                    <XAxis dataKey="Name" axisLine={false} tickLine={false} reversed={isRtl} />
                                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} orientation={isRtl ? "right" : "left"} />
                                                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', direction: isRtl ? 'rtl' : 'ltr' }} />
                                                    <Bar dataKey="Performance" name={t("analytics.performanceSeries")} radius={[4, 4, 0, 0]}>
                                                        {departments.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-border/50 shadow-soft">
                                        <CardHeader>
                                            <CardTitle>{t("analytics.coursesByDept")}</CardTitle>
                                            <CardDescription>{t("analytics.coursesByDeptDesc")}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-[350px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={departments} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="CoursesCount" nameKey="Name">
                                                        {departments.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ borderRadius: '8px', direction: isRtl ? 'rtl' : 'ltr' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="flex justify-center flex-wrap gap-4 mt-4">
                                                {departments.map((entry, index) => (
                                                    <div key={entry.Id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                        {entry.Name}
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="financial" className="space-y-6">
                            <Can permission={PERMISSIONS.revenueView} fallback={<NotAvailable text={t("analytics.financialNoAccess")} />}>
                                <FinancialAnalyticsPanel />
                            </Can>
                        </TabsContent>
                    </Tabs>
                    )}
                </div>
            </main>
        </div>
    );
};

export default OrganizationAnalytics;
