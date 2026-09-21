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
import api, { getApiError } from "@/lib/api";

interface AdminStatsResponse {
    Stats: { TotalUsers: number; ActiveCourses: number; AvgCompletion: number; AtRiskCount: number };
    RecentActivity: { Event: string; Time: string; Type: string }[];
    TopCourses: { Name: string; Enrolled: number; Completion: number; Score: number }[];
}

const StatCard = ({
    title, value, sub, icon: Icon, trend, color,
}: {
    title: string; value: string | number; sub?: string;
    icon: React.ElementType;
    trend?: { value: number; positive: boolean };
    color: "rose" | "primary" | "emerald" | "amber";
}) => {
    const colorMap = {
        rose: "from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-500",
        primary: "from-primary/20 to-primary/5 border-primary/20 text-primary",
        emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-500",
        amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-500",
    };
    const iconBg = {
        rose: "bg-rose-500 text-white",
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
                        <p className="text-3xl font-black text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                    </div>
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-lg", iconBg[color])}>
                        <Icon className="w-5 h-5" />
                    </div>
                </div>
                {trend && (
                    <div className={cn("flex items-center gap-1 mt-4 text-xs font-semibold", trend.positive ? "text-emerald-500" : "text-destructive")}>
                        {trend.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {trend.value}% vs last month
                    </div>
                )}
            </CardContent>
            <div className={cn("absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl", iconBg[color])} />
        </Card>
    );
};

const AdminDashboard = () => {
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
                <p className="text-destructive text-center">{getApiError(error, "Could not load the dashboard.")}</p>
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
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ml-20" : "lg:ml-64")}>
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Hero */}
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 p-8 text-white shadow-xl">
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white blur-3xl translate-x-1/2 -translate-y-1/2" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white blur-3xl -translate-x-1/2 translate-y-1/2" />
                        </div>
                        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                                    <span className="text-xs font-semibold uppercase tracking-widest opacity-80">Live Admin Dashboard</span>
                                </div>
                                <h1 className="text-4xl font-black tracking-tight">System Control Center</h1>
                                <p className="text-white/70 mt-1 text-sm">
                                    Global Intelligence Platform · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => navigate("/admin/courses")}
                                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 border backdrop-blur-sm font-semibold"
                                    variant="secondary"
                                >
                                    <BookOpen className="w-4 h-4 mr-2" /> All Courses
                                </Button>
                                <Button
                                    onClick={() => navigate("/admin/users")}
                                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 border backdrop-blur-sm font-semibold"
                                    variant="secondary"
                                >
                                    <Users className="w-4 h-4 mr-2" /> User Management
                                </Button>
                            </div>
                        </div>
                        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/20">
                            {[
                                { label: "Total Users", val: stats.TotalUsers, icon: Users },
                                { label: "Active Courses", val: stats.ActiveCourses, icon: BookOpen },
                                { label: "Avg Completion", val: `${stats.AvgCompletion}%`, icon: TrendingUp },
                                { label: "At-Risk", val: stats.AtRiskCount, icon: AlertTriangle },
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

                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard title="Total Users" value={stats.TotalUsers} sub="Across the platform" icon={Users} color="primary" />
                        <StatCard title="Active Courses" value={stats.ActiveCourses} sub="Published & running" icon={BookOpen} color="rose" />
                        <StatCard title="Avg Completion" value={`${stats.AvgCompletion}%`} sub="Global average" icon={TrendingUp} color="emerald" />
                        <StatCard title="At-Risk Trainers" value={stats.AtRiskCount} sub="Below 50% progress" icon={AlertTriangle} color="amber" />
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-rose-500" /> Course Performance
                                </h2>
                                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-rose-500" onClick={() => navigate("/admin/analytics")}>
                                    View All <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {topCourses.length === 0 && (
                                    <Card className="border-border/50"><CardContent className="p-8 text-center text-sm text-muted-foreground">No course data yet.</CardContent></Card>
                                )}
                                {topCourses.map((course, i) => (
                                    <Card key={course.Name} className="border-border/50 hover:border-rose-300/50 transition-all duration-200 hover:shadow-md cursor-pointer">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                                                    i === 0 && "bg-rose-500/10 text-rose-500",
                                                    i === 1 && "bg-primary/10 text-primary",
                                                    i === 2 && "bg-emerald-500/10 text-emerald-500",
                                                    i === 3 && "bg-amber-500/10 text-amber-500",
                                                )}>
                                                    {course.Name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="font-semibold text-sm truncate">{course.Name}</p>
                                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                                            <Badge variant="outline" className={cn("text-xs font-bold border",
                                                                course.Score >= 90 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" :
                                                                    course.Score >= 80 ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20" :
                                                                        "text-destructive border-destructive/20 bg-destructive/5"
                                                            )}>
                                                                {course.Score}% avg score
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mb-2">{course.Enrolled} enrolled · {course.Completion}% completed</p>
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
                                        <Zap className="w-4 h-4 text-amber-500" /> Quick Actions
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {[
                                        { label: "User Management", path: "/admin/users", icon: Users },
                                        { label: "Content Library", path: "/admin/courses", icon: BookOpen },
                                        { label: "System Analytics", path: "/admin/analytics", icon: BarChart2 },
                                    ].map((a) => (
                                        <Button key={a.label} variant="ghost" className="w-full justify-start gap-3 text-sm" onClick={() => navigate(a.path)}>
                                            <a.icon className="w-4 h-4 text-rose-500" /> {a.label}
                                        </Button>
                                    ))}
                                </CardContent>
                            </Card>
                            <Card className="border-border/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-primary" /> Live Activity
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
                                    {recentActivity.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 group cursor-pointer">
                                            <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                                                item.Type === "success" && "bg-emerald-500",
                                                item.Type === "warn" && "bg-amber-500",
                                                item.Type === "info" && "bg-primary",
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium leading-tight">{item.Event}</p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {item.Time}
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
