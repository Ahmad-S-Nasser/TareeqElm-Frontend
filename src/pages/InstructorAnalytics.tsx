import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { InstructorSidebar } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, BookOpen, Calendar, Loader2, Award } from "lucide-react";
import { useFormatters } from "@/lib/format";
import { useInstructorStats, weekLabel } from "@/hooks/useInstructorStats";
import { fetchInstructorTrainerRows } from "@/hooks/useEnrolledTrainers";
import { getApiError } from "@/lib/api";

const InstructorAnalytics = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { t, i18n } = useTranslation("instructor");
    const isRtl = i18n.dir() === "rtl";
    const { formatPercent, formatNumber, formatDate } = useFormatters();
    const { data, isLoading, error } = useInstructorStats();
    const { data: trainerRows = [] } = useQuery({
        queryKey: ["instructor-trainers", "all"],
        queryFn: () => fetchInstructorTrainerRows(),
    });

    const stats = data?.Stats;
    const engagement = (data?.EngagementData ?? []).map((e) => ({ ...e, Week: weekLabel(t, e.Week) }));
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
                sidebarCollapsed ? "ms-20" : "ms-64"
            )}>
                <div className="max-w-6xl mx-auto space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold">{t("analytics.title")}</h1>
                        <p className="text-muted-foreground mt-1">
                            {t("analytics.subtitle")}
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : error || !stats ? (
                        <p className="text-center text-destructive py-12">{getApiError(error, t("analytics.loadFailed"))}</p>
                    ) : (
                        <>
                            {/* Key Stats */}
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">{t("analytics.avgQuiz")}</CardTitle>
                                        <Award className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatPercent(stats.AvgQuizScore)}</div>
                                        <p className="text-xs text-muted-foreground">{t("analytics.avgQuizHint")}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">{t("analytics.activeTrainers")}</CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatNumber(stats.TotalTrainers)}</div>
                                        <p className="text-xs text-muted-foreground">{t("analytics.activeTrainersHint")}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">{t("analytics.completion")}</CardTitle>
                                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatPercent(stats.CompletionRate)}</div>
                                        <p className="text-xs text-muted-foreground">{t("analytics.completionHint")}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">{t("analytics.totalCourses")}</CardTitle>
                                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatNumber(stats.TotalCourses)}</div>
                                        <p className="text-xs text-muted-foreground">{t("analytics.draftsPending", { count: draftCount })}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Charts */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card className="col-span-1">
                                    <CardHeader>
                                        <CardTitle>{t("analytics.lessonCompletions")}</CardTitle>
                                        <CardDescription>{t("analytics.completionsPerWeek")}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px]">
                                            {engagement.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center pt-24">{t("analytics.noActivity")}</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={engagement}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="Week" reversed={isRtl} />
                                                        <YAxis allowDecimals={false} orientation={isRtl ? "right" : "left"} />
                                                        <Tooltip contentStyle={{ borderRadius: "8px", direction: isRtl ? "rtl" : "ltr" }} />
                                                        <Bar dataKey="Completions" name={t("analytics.completions")} fill="#8884d8" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="col-span-1">
                                    <CardHeader>
                                        <CardTitle>{t("analytics.trainerActivity")}</CardTitle>
                                        <CardDescription>{t("analytics.activePerWeek")}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px]">
                                            {engagement.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center pt-24">{t("analytics.noActivity")}</p>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={engagement}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="Week" reversed={isRtl} />
                                                        <YAxis allowDecimals={false} orientation={isRtl ? "right" : "left"} />
                                                        <Tooltip contentStyle={{ borderRadius: "8px", direction: isRtl ? "rtl" : "ltr" }} />
                                                        <Line type="monotone" dataKey="Trainers" name={t("analytics.trainers")} stroke="#82ca9d" strokeWidth={2} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>{t("analytics.recent")}</CardTitle>
                                    <CardDescription>{t("analytics.recentDesc")}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {recentActivity.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">{t("analytics.noRecent")}</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {recentActivity.map((r) => (
                                                <div key={`${r.TrainerId}-${r.CourseId}`} className="flex items-center gap-4 text-sm">
                                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                        <Calendar className="w-5 h-5 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <p className="font-medium">{t("analytics.activeIn", { course: r.CourseTitle ?? t("common:deletedCourse") })}</p>
                                                        <p className="text-muted-foreground text-xs">{t("analytics.personProgress", { name: r.FullName ?? t("common:deletedUser"), progress: formatPercent(Math.round(r.ProgressPercentage)) })}</p>
                                                    </div>
                                                    <div className="text-muted-foreground text-xs">
                                                        {r.LastActive ? formatDate(r.LastActive) : ""}
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
