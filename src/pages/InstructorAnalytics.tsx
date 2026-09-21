import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { InstructorSidebar } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, BookOpen, Calendar, Loader2, Award } from "lucide-react";
import { useInstructorStats } from "@/hooks/useInstructorStats";
import { fetchInstructorTrainerRows } from "@/hooks/useEnrolledTrainers";
import { getApiError } from "@/lib/api";

const InstructorAnalytics = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { data, isLoading, error } = useInstructorStats();
    const { data: trainerRows = [] } = useQuery({
        queryKey: ["instructor-trainers", "all"],
        queryFn: () => fetchInstructorTrainerRows(),
    });

    const stats = data?.Stats;
    const engagement = data?.EngagementData ?? [];
    const draftCount = data?.CourseDistribution.find((d) => d.Name === "Draft")?.Value ?? 0;

    // Most recent trainer activity across the instructor's courses.
    const recentActivity = trainerRows
        .filter((r) => r.LastActive)
        .sort((a, b) => (b.LastActive ?? "").localeCompare(a.LastActive ?? ""))
        .slice(0, 5);

    return (
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Instructor" />

            <main className={cn(
                "pt-20 pb-8 px-6 transition-all duration-300",
                sidebarCollapsed ? "ml-20" : "ml-64"
            )}>
                <div className="max-w-6xl mx-auto space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
                        <p className="text-muted-foreground mt-1">
                            Track your performance and trainer engagement.
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : error || !stats ? (
                        <p className="text-center text-destructive py-12">{getApiError(error, "Failed to load analytics.")}</p>
                    ) : (
                        <>
                            {/* Key Stats */}
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Average Quiz Score</CardTitle>
                                        <Award className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{stats.AvgQuizScore}%</div>
                                        <p className="text-xs text-muted-foreground">Across all your quizzes</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Active Trainers</CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{stats.TotalTrainers}</div>
                                        <p className="text-xs text-muted-foreground">Enrolled in your courses</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Course Completion</CardTitle>
                                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{stats.CompletionRate}%</div>
                                        <p className="text-xs text-muted-foreground">Of enrollments completed</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{stats.TotalCourses}</div>
                                        <p className="text-xs text-muted-foreground">{draftCount} drafts pending</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Charts */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card className="col-span-1">
                                    <CardHeader>
                                        <CardTitle>Lesson Completions</CardTitle>
                                        <CardDescription>Completions per week</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px]">
                                            {engagement.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center pt-24">No activity yet.</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={engagement}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="Week" />
                                                        <YAxis allowDecimals={false} />
                                                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                                                        <Bar dataKey="Completions" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="col-span-1">
                                    <CardHeader>
                                        <CardTitle>Trainer Activity</CardTitle>
                                        <CardDescription>Active trainers per week</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px]">
                                            {engagement.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center pt-24">No activity yet.</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={engagement}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="Week" />
                                                        <YAxis allowDecimals={false} />
                                                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                                                        <Line type="monotone" dataKey="Trainers" stroke="#82ca9d" strokeWidth={2} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Recent Activity</CardTitle>
                                    <CardDescription>Latest trainer activity across your courses</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {recentActivity.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No trainer activity yet.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {recentActivity.map((r) => (
                                                <div key={`${r.TrainerId}-${r.CourseId}`} className="flex items-center gap-4 text-sm">
                                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                        <Calendar className="w-5 h-5 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <p className="font-medium">Active in "{r.CourseTitle}"</p>
                                                        <p className="text-muted-foreground text-xs">{r.FullName} - {Math.round(r.ProgressPercentage)}% complete</p>
                                                    </div>
                                                    <div className="text-muted-foreground text-xs">
                                                        {r.LastActive ? new Date(r.LastActive).toLocaleDateString() : ""}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default InstructorAnalytics;
