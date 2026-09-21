import { useState } from "react";
import { UniversitySidebar, UniversitySidebarContent } from "@/components/layout/UniversitySidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";

interface DeptSummary { Id: string; Name: string; Head: string | null; CoursesCount: number; TrainersCount: number; Performance: number; Trend: number }
interface UniversityStats {
    Stats: { TotalTrainers: number; ActiveInstructors: number; TotalCourses: number; AvgCompletion: number };
    Departments: DeptSummary[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8b5cf6', '#ec4899'];

const NotAvailable = ({ text }: { text: string }) => (
    <Card className="border-border/50 shadow-soft">
        <CardContent className="p-12 text-center">
            <p className="font-semibold">Not available yet</p>
            <p className="text-sm text-muted-foreground mt-1">{text}</p>
        </CardContent>
    </Card>
);

const UniversityAnalytics = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["university-stats"],
        queryFn: async () => (await api.get<UniversityStats>("/University/stats")).data,
    });

    const stats = data?.Stats;
    const departments = data?.Departments ?? [];

    return (
        <div className="min-h-screen bg-background">
            <UniversitySidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="University"
                mobileSidebar={<UniversitySidebarContent collapsed={false} />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
                "ml-0"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="animate-slide-up">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                            Analytics & Reports
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Insights into university performance and trainer enrollment.
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : isError ? (
                        <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, "Could not load analytics.")}</CardContent></Card>
                    ) : (
                    <Tabs defaultValue="enrollment" className="animate-slide-up" style={{ animationDelay: "100ms" }}>
                        <TabsList className="bg-card border border-border/50 shadow-sm p-1 rounded-xl mb-6">
                            <TabsTrigger value="enrollment" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Enrollment</TabsTrigger>
                            <TabsTrigger value="academic" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Academic Performance</TabsTrigger>
                            <TabsTrigger value="financial" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Financials</TabsTrigger>
                        </TabsList>

                        <TabsContent value="enrollment" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="border-border/50 shadow-soft hover:shadow-lg transition-all">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Trainers</CardTitle>
                                        <CardTitle className="text-3xl font-bold text-primary">{(stats?.TotalTrainers ?? 0).toLocaleString()}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="border-border/50 shadow-soft hover:shadow-lg transition-all">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Instructors</CardTitle>
                                        <CardTitle className="text-3xl font-bold text-accent">{(stats?.ActiveInstructors ?? 0).toLocaleString()}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="border-border/50 shadow-soft hover:shadow-lg transition-all">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-muted-foreground">Course Completion Rate</CardTitle>
                                        <CardTitle className="text-3xl font-bold text-blue-500">{stats?.AvgCompletion ?? 0}%</CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>

                            {departments.length === 0 ? (
                                <NotAvailable text="Enrollment trends over time will appear here once they are tracked." />
                            ) : (
                                <Card className="border-border/50 shadow-soft">
                                    <CardHeader>
                                        <CardTitle>Trainers by Department</CardTitle>
                                        <CardDescription>Current trainer count per department.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="h-[400px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={departments}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="Name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} allowDecimals={false} />
                                                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                <Bar dataKey="TrainersCount" name="Trainers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="academic" className="space-y-6">
                            {departments.length === 0 ? (
                                <NotAvailable text="No department data yet." />
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card className="border-border/50 shadow-soft">
                                        <CardHeader>
                                            <CardTitle>Department Performance</CardTitle>
                                            <CardDescription>Performance score by department.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-[350px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={departments}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                    <XAxis dataKey="Name" axisLine={false} tickLine={false} />
                                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                                                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px' }} />
                                                    <Bar dataKey="Performance" name="Performance %" radius={[4, 4, 0, 0]}>
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
                                            <CardTitle>Courses by Department</CardTitle>
                                            <CardDescription>Share of courses per department.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="h-[350px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={departments} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="CoursesCount" nameKey="Name">
                                                        {departments.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
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
                            <NotAvailable text="Financial data is not tracked by the platform yet." />
                        </TabsContent>
                    </Tabs>
                    )}
                </div>
            </main>
        </div>
    );
};

export default UniversityAnalytics;
