import { useEffect } from "react";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { GraduationCap, Users, TrendingUp, AlertTriangle, BookOpen, BarChart3, CheckCircle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useCourses } from "@/hooks/useCourses";
import { useInstructorStats } from "@/hooks/useInstructorStats";
import { getApiError } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))"];

const InstructorDashboard = () => {
  const navigate = useNavigate();
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

    if (completionRate < 30 && completionRate > 0) aiInsights.push({ icon: AlertTriangle, text: `Course completion rate is ${completionRate}% — consider adding more engaging content`, color: "text-warning" });
    if (avgQuizScore > 0 && avgQuizScore < 60) aiInsights.push({ icon: AlertTriangle, text: `Average quiz score is ${avgQuizScore}% — trainers may need more preparation material`, color: "text-warning" });
    if (avgQuizScore >= 80) aiInsights.push({ icon: TrendingUp, text: `Great quiz performance! Average score is ${avgQuizScore}%`, color: "text-success" });
    if (draftCount > 0) aiInsights.push({ icon: Sparkles, text: `You have ${draftCount} draft course${draftCount > 1 ? "s" : ""} ready to publish`, color: "text-primary" });
    if (aiInsights.length === 0) {
      aiInsights.push({ icon: Sparkles, text: dashboardData.Stats.TotalCourses > 0 ? "Your courses are performing well. Keep it up!" : "Create your first course to see insights", color: "text-primary" });
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
  const engagementData = dashboardData?.EngagementData ?? [];
  const courseDistribution = (dashboardData?.CourseDistribution ?? []).filter((d) => d.Value > 0);

  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Instructor Dashboard</h1>
            </div>
            <p className="text-muted-foreground">Monitor trainer performance and manage your courses</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/instructor/courses")}><BookOpen className="w-4 h-4 mr-2" /> My Courses</Button>
            <Button className="gradient-accent text-white shadow-glow-accent" onClick={() => navigate("/instructor/create-course")}>Create Course</Button>
          </div>
        </div>
      </section>

      {statsError && (
        <p className="text-sm text-destructive">{getApiError(statsError, "Failed to load your dashboard statistics.")}</p>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <StatsCard icon={BookOpen} title="Total Courses" value={courses.length} variant="default" onClick={() => navigate("/instructor/courses")} />
        <StatsCard icon={Users} title="Total Trainers" value={stats.TotalTrainers} variant="primary" onClick={() => navigate("/instructor/trainers")} />
        <StatsCard icon={CheckCircle} title="Completion Rate" value={`${stats.CompletionRate}%`} variant="success" onClick={() => navigate("/instructor/analytics")} />
        <StatsCard icon={BarChart3} title="Avg Quiz Score" value={`${stats.AvgQuizScore}%`} variant="warning" onClick={() => navigate("/instructor/quizzes")} />
      </section>

      <section className="grid md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Trainer Engagement</CardTitle>
            <CardDescription>Weekly active trainers & lesson completions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="Week" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="Trainers" name="Active Trainers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Completions" name="Completions" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Course Status Distribution</CardTitle>
            <CardDescription>Breakdown of your courses by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] flex items-center justify-center">
              {courseDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={courseDistribution} cx="50%" cy="50%" outerRadius={90} dataKey="Value" label={({ Name, Value }: { Name: string; Value: number }) => `${Name}: ${Value}`}>
                      {courseDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-sm">No courses yet</p>
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
              <CardTitle className="text-base">Insights</CardTitle>
            </div>
            <CardDescription>Observations about your courses and trainers, based on your data</CardDescription>
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
