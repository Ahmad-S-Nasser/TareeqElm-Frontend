import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Users,
    GraduationCap,
    BookOpen,
    TrendingUp,
    Building2,
    Plus,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Zap,
    BarChart2,
    ChevronRight,
    Brain,
    Loader2
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { describeActivity, activityTone, type OrganizationActivity } from "@/lib/organizationActivity";

interface DeptSummary { Id: string; Name: string; Head: string | null; CoursesCount: number; TrainersCount: number; Performance: number; Trend: number }
interface DashboardData {
    Stats: { TotalTrainers: number; ActiveInstructors: number; TotalCourses: number; AvgCompletion: number };
    Departments: DeptSummary[];
    RecentActivity: OrganizationActivity[];
}

const StatCard = ({
    title, value, sub, icon: Icon, trend, color,
}: {
    title: string; value: string | number; sub?: string;
    icon: React.ElementType;
    trend?: { value: number; positive: boolean };
    color: "primary" | "accent" | "emerald" | "amber";
}) => {
    const { t } = useTranslation("organization");
    const { formatNumber } = useFormatters();
    const colorMap = {
        primary: "from-primary/20 to-primary/5 border-primary/20 text-primary",
        accent: "from-accent/20 to-accent/5 border-accent/20 text-accent",
        emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-500",
        amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-500",
    };
    const iconBg = {
        primary: "bg-primary text-primary-foreground",
        accent: "bg-accent text-white",
        emerald: "bg-emerald-500 text-white",
        amber: "bg-amber-500 text-white",
    };
    return (
        <Card className={cn("border bg-gradient-to-br relative overflow-hidden group hover:scale-[1.02] transition-all duration-300", colorMap[color])}>
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
                        <p className="text-3xl font-black text-foreground">{typeof value === 'number' ? formatNumber(value) : value}</p>
                        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                    </div>
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-lg", iconBg[color])}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                {trend && (
                    <div className={cn("flex items-center gap-1 mt-4 text-xs font-semibold", trend.positive ? "text-emerald-500" : "text-destructive")}>
                        {trend.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {t('dashboard.vsLastMonth', { value: trend.value })}
                    </div>
                )}
            </CardContent>
            <div className={cn("absolute -bottom-4 -end-4 w-20 h-20 rounded-full opacity-10 blur-xl", iconBg[color])} />
        </Card>
    );
};

const OrganizationDashboard = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newDept, setNewDept] = useState({ name: "", head: "" });
    const navigate = useNavigate();
    const { t } = useTranslation(["organization", "common"]);
    const { formatDate, formatPercent, formatNumber, formatRelativeTime } = useFormatters();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: dashboardData, isLoading: loading, isError, error } = useQuery({
        queryKey: ["organization-stats"],
        queryFn: async () => (await api.get<DashboardData>("/Organization/stats")).data,
    });

    const addDepartment = useMutation({
        mutationFn: async (d: { Name: string; HeadOfDepartment?: string }) => { await api.post("/Departments", d); },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["organization-stats"] });
            queryClient.invalidateQueries({ queryKey: ["organization-departments"] });
            queryClient.invalidateQueries({ queryKey: ["departments"] });
            setIsAddDialogOpen(false);
            setNewDept({ name: "", head: "" });
            toast({ title: t("dashboard.deptCreated") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("dashboard.createFailed")) }),
    });

    const handleAddDepartment = () => {
        if (!newDept.name.trim()) {
            toast({ variant: "destructive", title: t("dashboard.nameRequired") });
            return;
        }
        addDepartment.mutate({ Name: newDept.name.trim(), HeadOfDepartment: newDept.head.trim() || undefined });
    };

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
                <p className="text-destructive text-center">{getApiError(error, t("dashboard.loadFailed"))}</p>
            </div>
        );
    }

    const stats = dashboardData?.Stats || { TotalTrainers: 0, ActiveInstructors: 0, TotalCourses: 0, AvgCompletion: 0 };
    const departments = dashboardData?.Departments || [];
    const recentActivity = dashboardData?.RecentActivity || [];
    const topDept = [...departments].sort((x, y) => y.Performance - x.Performance)[0];

    return (
        <div className="min-h-screen bg-background">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-12 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64"
            )}>
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Hero Header */}
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary via-primary/80 to-accent p-8 text-primary-foreground shadow-xl">
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 end-0 w-96 h-96 rounded-full bg-white blur-3xl ltr:translate-x-1/2 rtl:-translate-x-1/2 -translate-y-1/2" />
                            <div className="absolute bottom-0 start-0 w-64 h-64 rounded-full bg-white blur-3xl ltr:-translate-x-1/2 rtl:translate-x-1/2 translate-y-1/2" />
                        </div>
                        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-xs font-semibold uppercase tracking-widest opacity-80">{t("dashboard.liveOverview")}</span>
                                </div>
                                <h1 className="text-4xl font-black tracking-tight">{t("dashboard.title")}</h1>
                                <p className="text-primary-foreground/70 mt-1 text-sm">
                                    {t("dashboard.subtitle", { date: formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" }) })}
                                </p>
                            </div>
                            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-white/30 border backdrop-blur-sm font-semibold">
                                        <Plus className="w-4 h-4 me-2" /> {t("dashboard.newDepartment")}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>{t("dashboard.addTitle")}</DialogTitle>
                                        <DialogDescription>{t("dashboard.addDescription")}</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">{t("dashboard.deptName")}</Label>
                                            <Input id="name" placeholder={t("dashboard.deptNamePlaceholder")} value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="head">{t("dashboard.headLabel")}</Label>
                                            <Input id="head" placeholder={t("dashboard.headPlaceholder")} value={newDept.head} onChange={(e) => setNewDept({ ...newDept, head: e.target.value })} />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{t("common:actions.cancel")}</Button>
                                        <Button onClick={handleAddDepartment} disabled={addDepartment.isPending} className="gradient-primary text-white border-0">
                                            {addDepartment.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                            {t("dashboard.addDepartment")}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/20">
                            {[
                                { label: t("dashboard.departments"), val: formatNumber(departments.length), icon: Building2 },
                                { label: t("dashboard.avgCompletion"), val: formatPercent(stats.AvgCompletion), icon: Activity },
                                { label: t("dashboard.activeCourses"), val: formatNumber(stats.TotalCourses), icon: BookOpen },
                                { label: t("dashboard.trainers"), val: formatNumber(stats.TotalTrainers), icon: GraduationCap },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center gap-3">
                                    <item.icon className="w-4 h-4 opacity-60 shrink-0" />
                                    <div>
                                        <p className="text-xs opacity-60 font-medium">{item.label}</p>
                                        <p className="font-bold text-sm">{item.val}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div onClick={() => navigate("/organization/trainers")} className="cursor-pointer">
                            <StatCard title={t("dashboard.totalTrainers")} value={stats.TotalTrainers} sub={t("dashboard.enrolledAcross")} icon={GraduationCap} color="primary" />
                        </div>
                        <div onClick={() => navigate("/organization/instructors")} className="cursor-pointer">
                            <StatCard title={t("dashboard.instructors")} value={stats.ActiveInstructors} sub={t("dashboard.activeOrgWide")} icon={Users} color="accent" />
                        </div>
                        <div onClick={() => navigate("/organization/courses")} className="cursor-pointer">
                            <StatCard title={t("dashboard.activeCourses")} value={stats.TotalCourses} sub={t("dashboard.offeringThisTerm")} icon={BookOpen} color="emerald" />
                        </div>
                        <div onClick={() => navigate("/organization/analytics")} className="cursor-pointer">
                            <StatCard title={t("dashboard.avgCompletion")} value={formatPercent(stats.AvgCompletion)} sub={t("dashboard.globalTrack")} icon={TrendingUp} color="amber" />
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-primary" />
                                    {t("dashboard.deptPerformance")}
                                </h2>
                                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary" onClick={() => navigate("/organization/departments")}>
                                    {t("common:actions.viewAll")} <ChevronRight className="w-3 h-3 ms-1 rtl:rotate-180" />
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {departments.length === 0 && (
                                    <Card className="border-border/50"><CardContent className="p-8 text-center text-sm text-muted-foreground">{t("dashboard.noDepartments")}</CardContent></Card>
                                )}
                                {departments.map((dept, i) => (
                                    <Card key={dept.Id} className="border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-md group cursor-pointer" onClick={() => navigate("/organization/departments")}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                                                    i % 4 === 0 && "bg-primary/10 text-primary",
                                                    i % 4 === 1 && "bg-accent/10 text-accent",
                                                    i % 4 === 2 && "bg-emerald-500/10 text-emerald-500",
                                                    i % 4 === 3 && "bg-amber-500/10 text-amber-500",
                                                )}>
                                                    {dept.Name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="font-semibold text-sm truncate">{dept.Name}</p>
                                                        <div className="flex items-center gap-2 shrink-0 ms-2">
                                                            <span className={cn(
                                                                "text-xs font-bold flex items-center gap-0.5",
                                                                dept.Trend > 0 ? "text-emerald-500" : "text-destructive"
                                                            )}>
                                                                {dept.Trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                                {formatPercent(Math.abs(dept.Trend))}
                                                            </span>
                                                            <Badge variant="outline" className={cn(
                                                                "text-xs font-bold border",
                                                                dept.Performance >= 90 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" :
                                                                    dept.Performance >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20" :
                                                                        "text-destructive border-destructive/20 bg-destructive/5"
                                                            )}>
                                                                {formatPercent(Math.round(dept.Performance))}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mb-2">{t("dashboard.deptMeta", { head: dept.Head ?? t("notAssigned"), courses: t("dashboard.coursesCount", { count: dept.CoursesCount }), trainers: t("dashboard.trainersCount", { count: dept.TrainersCount }) })}</p>
                                                    <Progress value={dept.Performance} className="h-1.5" />
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
                                        <Zap className="w-4 h-4 text-amber-500" />
                                        {t("dashboard.quickInsights")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {[
                                        ...(topDept ? [{ label: t("dashboard.topDept"), val: topDept.Name, sub: t("dashboard.score", { value: formatPercent(Math.round(topDept.Performance)) }) }] : []),
                                        { label: t("dashboard.departments"), val: formatNumber(departments.length), sub: t("dashboard.registered") },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                                            <div>
                                                <p className="text-xs text-muted-foreground">{item.label}</p>
                                                <p className="text-sm font-semibold">{item.val}</p>
                                            </div>
                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{item.sub}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="border-border/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-primary" />
                                        {t("dashboard.liveActivity")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>}
                                    {recentActivity.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 group cursor-pointer hover:bg-muted/50 rounded-lg p-1 -m-1 transition-colors">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                                activityTone(item.Action) === "success" && "bg-emerald-500",
                                                activityTone(item.Action) === "warn" && "bg-amber-500",
                                                activityTone(item.Action) === "info" && "bg-primary",
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium leading-tight">{describeActivity(item, t)}</p>
                                                <p className="text-xs text-muted-foreground">{item.At ? formatRelativeTime(item.At) : ""}</p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Brain className="w-5 h-5 text-primary" /> {t("dashboard.aiInsights")}
                            </h2>
                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary" onClick={() => navigate("/organization/ai-insights")}>
                                {t("common:actions.viewAll")} <ChevronRight className="w-3 h-3 ms-1 rtl:rotate-180" />
                            </Button>
                        </div>
                        <Card className="border-border/50">
                            <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("dashboard.aiNotAvailable")}</CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OrganizationDashboard;
