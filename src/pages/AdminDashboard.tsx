import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Users, BookOpen, TrendingUp, AlertTriangle, Activity,
    ArrowUpRight, ArrowDownRight, Zap, ChevronRight, Clock, BarChart2, Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { activityTone, useActivitySentence, type RecentActivityItem } from "@/lib/activity";

interface AdminStatsResponse {
    Stats: { TotalUsers: number; ActiveCourses: number; AvgCompletion: number; AtRiskCount: number };
    RecentActivity: RecentActivityItem[];
    TopCourses: { CourseId?: string | null; Name: string; Enrolled: number; Completion: number; Score: number }[];
}

const StatCard = ({
    title, value, sub, icon: Icon, trend, color,
}: {
    title: string; value: string; sub?: string;
    icon: React.ElementType;
    trend?: { value: string; positive: boolean };
    color: "accent" | "primary" | "emerald" | "amber";
}) => {
    const { t } = useTranslation("admin");
    const colorMap = {
        accent: "from-accent/20 to-accent/5 border-accent/20 text-accent",
        primary: "from-primary/20 to-primary/5 border-primary/20 text-primary",
        emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-500",
        amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-500",
    };
    const iconBg = {
        accent: "bg-accent text-accent-foreground",
        primary: "bg-primary text-primary-foreground",
        emerald: "bg-emerald-500 text-white",
        amber: "bg-amber-500 text-white",
    };
    return (
        <Card className={cn("border bg-gradient-to-br relative overflow-hidden group hover:scale-[1.02] transition-all duration-300", colorMap[color])}>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
                        <p className="text-3xl font-black text-foreground">{value}</p>
                        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                    </div>
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-lg", iconBg[color])}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                {trend && (
                    <div className={cn("flex items-center gap-1 mt-4 text-xs font-semibold", trend.positive ? "text-emerald-500" : "text-destructive")}>
                        {trend.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {t("dashboard.vsLastMonth", { value: trend.value })}
                    </div>
                )}
            </CardContent>
            <div className={cn("absolute -bottom-4 -end-4 w-20 h-20 rounded-full opacity-10 blur-xl", iconBg[color])} />
        </Card>
    );
};

const AdminDashboard = () => {
    const { t } = useTranslation(["admin", "common"]);
    const { formatNumber, formatPercent, formatDate, formatRelativeTime } = useFormatters();
    const activitySentence = useActivitySentence();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const navigate = useNavigate();

    const { data, isLoading: loading, isError, error } = useQuery({
        queryKey: ["admin-stats"],
        queryFn: async () => (await api.get<AdminStatsResponse>("/Admin/stats")).data,
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <p className="text-destructive text-center">{getApiError(error, t("admin:dashboard.loadFailed"))}</p>
            </div>
        );
    }

    const stats = data?.Stats || { TotalUsers: 0, ActiveCourses: 0, AvgCompletion: 0, AtRiskCount: 0 };
    const recentActivity = data?.RecentActivity || [];
    const topCourses = data?.TopCourses || [];

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Hero */}
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-warning to-warning-glow p-8 text-warning-foreground shadow-xl">
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 end-0 w-96 h-96 rounded-full bg-white blur-3xl translate-x-1/2 rtl:-translate-x-1/2 -translate-y-1/2" />
                            <div className="absolute bottom-0 start-0 w-64 h-64 rounded-full bg-white blur-3xl -translate-x-1/2 rtl:translate-x-1/2 translate-y-1/2" />
                        </div>
                        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse" />
                                    <span className="text-xs font-semibold uppercase tracking-widest opacity-80">{t("admin:dashboard.liveBadge")}</span>
                                </div>
                                <h1 className="text-4xl font-black tracking-tight">{t("admin:dashboard.pageTitle")}</h1>
                                <p className="text-warning-foreground/70 mt-1 text-sm">
                                    {t("admin:dashboard.subtitle", { date: formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" }) })}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => navigate("/admin/courses")}
                                    className="bg-warning-foreground/10 hover:bg-warning-foreground/15 text-warning-foreground border-warning-foreground/20 border backdrop-blur-sm font-semibold"
                                    variant="secondary"
                                >
                                    <BookOpen className="w-4 h-4 me-2" /> {t("admin:dashboard.allCourses")}
                                </Button>
                                <Button
                                    onClick={() => navigate("/admin/users")}
                                    className="bg-warning-foreground/10 hover:bg-warning-foreground/15 text-warning-foreground border-warning-foreground/20 border backdrop-blur-sm font-semibold"
                                    variant="secondary"
                                >
                                    <Users className="w-4 h-4 me-2" /> {t("admin:dashboard.userManagement")}
                                </Button>
                            </div>
                        </div>
                        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-warning-foreground/20">
                            {[
                                { key: "totalUsers", val: formatNumber(stats.TotalUsers), icon: Users },
                                { key: "activeCourses", val: formatNumber(stats.ActiveCourses), icon: BookOpen },
                                { key: "avgCompletion", val: formatPercent(stats.AvgCompletion), icon: TrendingUp },
                                { key: "atRisk", val: formatNumber(stats.AtRiskCount), icon: AlertTriangle },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center gap-3">
                                    <item.icon className="w-4 h-4 opacity-60 shrink-0" />
                                    <div>
                                        <p className="text-xs opacity-60 font-medium">{t(`admin:dashboard.hero.${item.key}`)}</p>
                                        <p className="font-bold text-sm">{item.val}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard title={t("admin:dashboard.cards.totalUsers.title")} value={formatNumber(stats.TotalUsers)} sub={t("admin:dashboard.cards.totalUsers.sub")} icon={Users} color="primary" />
                        <StatCard title={t("admin:dashboard.cards.activeCourses.title")} value={formatNumber(stats.ActiveCourses)} sub={t("admin:dashboard.cards.activeCourses.sub")} icon={BookOpen} color="accent" />
                        <StatCard title={t("admin:dashboard.cards.avgCompletion.title")} value={formatPercent(stats.AvgCompletion)} sub={t("admin:dashboard.cards.avgCompletion.sub")} icon={TrendingUp} color="emerald" />
                        <StatCard title={t("admin:dashboard.cards.atRisk.title")} value={formatNumber(stats.AtRiskCount)} sub={t("admin:dashboard.cards.atRisk.sub")} icon={AlertTriangle} color="amber" />
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-accent" /> {t("admin:dashboard.coursePerformance")}
                                </h2>
                                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-accent" onClick={() => navigate("/admin/analytics")}>
                                    {t("common:actions.viewAll")} <ChevronRight className="w-3 h-3 ms-1 rtl:rotate-180" />
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {topCourses.length === 0 && (
                                    <Card className="border-border/50"><CardContent className="p-8 text-center text-sm text-muted-foreground">{t("admin:dashboard.noCourseData")}</CardContent></Card>
                                )}
                                {topCourses.map((course, i) => (
                                    <Card key={course.CourseId ?? `${course.Name}-${i}`} className="border-border/50 hover:border-accent/50 transition-all duration-200 hover:shadow-md cursor-pointer">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                                                    i === 0 && "bg-accent/10 text-accent",
                                                    i === 1 && "bg-primary/10 text-primary",
                                                    i === 2 && "bg-emerald-500/10 text-emerald-500",
                                                    i === 3 && "bg-amber-500/10 text-amber-500",
                                                )}>
                                                    {course.Name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="font-semibold text-sm truncate">{course.Name}</p>
                                                        <div className="flex items-center gap-2 shrink-0 ms-2">
                                                            <Badge variant="outline" className={cn("text-xs font-bold border",
                                                                course.Score >= 90 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" :
                                                                    course.Score >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20" :
                                                                        "text-destructive border-destructive/20 bg-destructive/5"
                                                            )}>
                                                                {t("admin:dashboard.avgScore", { score: formatPercent(course.Score) })}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mb-2">{t("admin:dashboard.courseStats", { enrolled: formatNumber(course.Enrolled), completion: formatPercent(course.Completion) })}</p>
                                                    <Progress value={course.Completion} className="h-1.5" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <Card className="border-border/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-500" /> {t("admin:dashboard.quickActions")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {[
                                        { key: "users", path: "/admin/users", icon: Users },
                                        { key: "courses", path: "/admin/courses", icon: BookOpen },
                                        { key: "analytics", path: "/admin/analytics", icon: BarChart2 },
                                    ].map((a) => (
                                        <Button key={a.key} variant="ghost" className="w-full justify-start gap-3 text-sm" onClick={() => navigate(a.path)}>
                                            <a.icon className="w-4 h-4 text-accent" /> {t(`admin:dashboard.quick.${a.key}`)}
                                        </Button>
                                    ))}
                                </CardContent>
                            </Card>
                            <Card className="border-border/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-primary" /> {t("admin:dashboard.liveActivity")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">{t("admin:dashboard.noActivity")}</p>}
                                    {recentActivity.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 group cursor-pointer">
                                            <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                                                activityTone(item) === "success" && "bg-emerald-500",
                                                activityTone(item) === "info" && "bg-primary",
                                                activityTone(item) === "primary" && "bg-accent",
                                                activityTone(item) === "muted" && "bg-muted-foreground",
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium leading-tight">{activitySentence(item)}</p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {formatRelativeTime(item.At)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
