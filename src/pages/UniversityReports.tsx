import { UniversityPageLayout } from "@/components/layout/UniversityPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileBarChart, Download, Users, BookOpen, Building2, GraduationCap, BarChart2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";

interface DeptSummary { Id: string; Name: string; Head: string | null; CoursesCount: number; TrainersCount: number; Performance: number; Trend: number }

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444"];

const reportCards = [
    { title: "Trainer Performance Report", description: "Detailed grade distribution, pass/fail rates, and trainer progress across all courses", icon: GraduationCap, color: "text-primary bg-primary/10" },
    { title: "Course Completion Statistics", description: "Completion rates, dropout analysis, and time-to-completion metrics by course", icon: BookOpen, color: "text-emerald-500 bg-emerald-500/10" },
    { title: "Department Analytics", description: "Cross-department performance comparison, resource utilization, and growth trends", icon: Building2, color: "text-amber-500 bg-amber-500/10" },
    { title: "Instructor Activity Report", description: "Teaching hours, trainer engagement scores, course ratings, and content uploads", icon: Users, color: "text-violet-500 bg-violet-500/10" },
];

const UniversityReports = () => {
    const { data: departments = [], isLoading, isError, error } = useQuery({
        queryKey: ["university-departments"],
        queryFn: async () => (await api.get<DeptSummary[]>("/Departments")).data,
    });

    return (
        <UniversityPageLayout>
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileBarChart className="w-5 h-5 text-primary" />
                    </div>
                    Reports
                </h1>
                <p className="text-muted-foreground mt-1">Generate and download detailed academic performance reports</p>
            </div>

            {/* Report Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reportCards.map(r => (
                    <Card key={r.title} className="border-border/50">
                        <CardContent className="p-5 flex items-start gap-4">
                            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", r.color)}>
                                <r.icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-sm mb-1">{r.title}</p>
                                <p className="text-xs text-muted-foreground mb-3">{r.description}</p>
                                <Button variant="outline" size="sm" className="gap-1.5" disabled>
                                    <Download className="w-3.5 h-3.5" /> Coming soon
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, "Could not load department data.")}</CardContent></Card>
            ) : departments.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">No department data yet.</CardContent></Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-border/50">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-primary" /> Department Performance
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={departments}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="Name" className="text-xs" />
                                        <YAxis className="text-xs" domain={[0, 100]} />
                                        <Tooltip />
                                        <Bar dataKey="Performance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Performance %" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-border/50">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Users className="w-4 h-4 text-primary" /> Trainers by Department
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center justify-center">
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={departments} cx="50%" cy="50%" outerRadius={100} dataKey="TrainersCount" nameKey="Name" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                                            {departments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-border/50">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold">Department Summary</CardTitle>
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
                                                <span className="text-xs text-muted-foreground">{dept.TrainersCount} trainers</span>
                                            </div>
                                            <Progress value={dept.Performance} className="h-1.5" />
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold">{dept.Performance.toFixed(0)}%</p>
                                            <p className="text-xs text-muted-foreground">performance</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </UniversityPageLayout>
    );
};

export default UniversityReports;
