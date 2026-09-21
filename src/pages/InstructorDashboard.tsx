import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { GraduationCap, Users, TrendingUp, AlertTriangle, BookOpen, BarChart3, CheckCircle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useCourses } from "@/hooks/useCourses";
import { useFormatters } from "@/lib/format";
import { useInstructorStats, weekLabel, courseStatusLabel } from "@/hooks/useInstructorStats";
import { getApiError } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))"];

const InstructorDashboard = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("instructor");
  const isRtl = i18n.dir() === "rtl";
  const { formatPercent, formatNumber } = useFormatters();
  const { courses, fetchInstructorCourses, loading: coursesLoading } = useCourses();
  const { data: dashboardData, isLoading: statsLoading, error: statsError } = useInstructorStats();

  useEffect(() => {
    fetchInstructorCourses();
  }, [fetchInstructorCourses]);

  const aiInsights: { icon: React.ElementType; text: string; color: string }[] = [];
  if (dashboardData) {
    const completionRate = dashboardData.Stats.CompletionRate;
    const avgQuizScore = dashboardData.Stats.AvgQuizScore;
    const draftCount = dashboardData.CourseDistribution.find((d) => d.Name === "Draft")?.Value || 0;

    if (completionRate < 30 && completionRate > 0) aiInsights.push({ icon: AlertTriangle, text: t("dashboard.insights.lowCompletion", { rate: formatPercent(completionRate) }), color: "text-warning" });
    if (avgQuizScore > 0 && avgQuizScore < 60) aiInsights.push({ icon: AlertTriangle, text: t("dashboard.insights.lowScore", { score: formatPercent(avgQuizScore) }), color: "text-warning" });
    if (avgQuizScore >= 80) aiInsights.push({ icon: TrendingUp, text: t("dashboard.insights.highScore", { score: formatPercent(avgQuizScore) }), color: "text-success" });
    if (draftCount > 0) aiInsights.push({ icon: Sparkles, text: t("dashboard.insights.drafts", { count: draftCount }), color: "text-primary" });
    if (aiInsights.length === 0) {
      aiInsights.push({ icon: Sparkles, text: dashboardData.Stats.TotalCourses > 0 ? t("dashboard.insights.good") : t("dashboard.insights.createFirst"), color: "text-primary" });
    }
  }

  if (coursesLoading || statsLoading) {
    return (
      <InstructorPageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </InstructorPageLayout>
    );
  }

  const stats = dashboardData?.Stats ?? { TotalCourses: 0, TotalTrainers: 0, CompletionRate: 0, PendingQuizzes: 0, AvgQuizScore: 0 };
  const engagementData = (dashboardData?.EngagementData ?? []).map((e) => ({ ...e, Week: weekLabel(t, e.Week) }));
  const courseDistribution = (dashboardData?.CourseDistribution ?? []).filter((d) => d.Value > 0)
    .map((d) => ({ ...d, Name: courseStatusLabel(t, d.Name) }));

  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
            </div>
            <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/instructor/courses")}><BookOpen className="w-4 h-4 me-2" /> {t("dashboard.myCourses")}</Button>
            <Button className="gradient-accent text-white shadow-glow-accent" onClick={() => navigate("/instructor/create-course")}>{t("dashboard.createCourse")}</Button>
          </div>
        </div>
      </section>

      {statsError && (
        <p className="text-sm text-destructive">{getApiError(statsError, t("dashboard.loadFailed"))}</p>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <StatsCard icon={BookOpen} title={t("dashboard.stats.totalCourses")} value={courses.length} variant="default" onClick={() => navigate("/instructor/courses")} />
        <StatsCard icon={Users} title={t("dashboard.stats.totalTrainers")} value={stats.TotalTrainers} variant="primary" onClick={() => navigate("/instructor/trainers")} />
        <StatsCard icon={CheckCircle} title={t("dashboard.stats.completionRate")} value={formatPercent(stats.CompletionRate)} variant="success" onClick={() => navigate("/instructor/analytics")} />
        <StatsCard icon={BarChart3} title={t("dashboard.stats.avgQuizScore")} value={formatPercent(stats.AvgQuizScore)} variant="warning" onClick={() => navigate("/instructor/quizzes")} />
      </section>

      <section className="grid md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.engagement.title")}</CardTitle>
            <CardDescription>{t("dashboard.engagement.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="Week" className="text-xs" reversed={isRtl} />
                  <YAxis className="text-xs" orientation={isRtl ? "right" : "left"} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", direction: isRtl ? "rtl" : "ltr" }} />
                  <Bar dataKey="Trainers" name={t("dashboard.engagement.activeTrainers")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Completions" name={t("dashboard.engagement.completions")} fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.distribution.title")}</CardTitle>
            <CardDescription>{t("dashboard.distribution.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] flex items-center justify-center">
              {courseDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={courseDistribution} cx="50%" cy="50%" outerRadius={90} dataKey="Value" label={({ Name, Value }: { Name: string; Value: number }) => `${Name}: ${formatNumber(Value)}`}>
                      {courseDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm">{t("dashboard.distribution.empty")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="animate-slide-up" style={{ animationDelay: "300ms" }}>
        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <CardTitle className="text-base">{t("dashboard.insights.title")}</CardTitle>
            </div>
            <CardDescription>{t("dashboard.insights.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiInsights.map((insight, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <insight.icon className={`w-5 h-5 ${insight.color} flex-shrink-0`} />
                  <span className="text-sm">{insight.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </InstructorPageLayout>
  );
};

export default InstructorDashboard;
