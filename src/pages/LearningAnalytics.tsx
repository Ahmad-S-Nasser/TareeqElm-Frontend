import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart3, TrendingUp, Clock, Target, Brain, Flame,
  Calendar, BookOpen, Zap, Award, Activity, Loader2, AlertCircle
} from "lucide-react";
import api, { getApiError } from "@/lib/api";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { StudyHeatmap } from "@/components/analytics/StudyHeatmap";

interface StudySessionDto {
  Id: string;
  CourseId: string | null;
  LessonId: string | null;
  StartedAt: string;
  EndedAt: string | null;
  DurationSeconds: number;
}

interface FlashcardDto {
  Id: string;
  Topic: string;
  EaseFactor: number;
  Repetitions: number;
  NextReview: string;
  LastReviewed: string | null;
}

interface TimeBlockDto {
  Id: string;
  Category: string;
  Date: string;
  StartTime: string;
  EndTime: string;
}

interface TrainerStatsDto {
  TotalStudyHours: number;
  AvgFocusScore: number;
  Streak: number;
  FlashcardsDue: number;
  WeakTopics: string[];
  BestStudyTime: string;
  CardsReviewedToday: number;
  SessionsThisWeek: number;
  TotalCards: number;
  RetentionRate: number;
  DeepWorkSessions: number;
}

interface ActivitySummaryDto {
  TotalSessions: number;
  TotalStudySeconds: number;
  CardsReviewed: number;
  DistractionsLogged: number;
}

const dayKey = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

const QueryError = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
    <AlertCircle className="w-4 h-4" />
    <span className="flex-1">{getApiError(error, "Failed to load analytics")}</span>
    <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
  </div>
);

const EmptyChart = ({ message }: { message: string }) => (
  <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">{message}</div>
);

const LearningAnalytics = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const statsQuery = useQuery({
    queryKey: ["trainer-stats"],
    queryFn: async () => (await api.get<TrainerStatsDto>("/Trainers/stats")).data,
  });
  const summaryQuery = useQuery({
    queryKey: ["trainer-activity-summary"],
    queryFn: async () => (await api.get<ActivitySummaryDto>("/Trainers/activity-summary")).data,
  });
  const sessionsQuery = useQuery({
    queryKey: ["study-sessions", "year"],
    queryFn: async () => {
      const from = format(subDays(new Date(), 364), "yyyy-MM-dd");
      const to = format(addDays(new Date(), 1), "yyyy-MM-dd");
      return (await api.get<StudySessionDto[]>("/study-sessions", { params: { from, to } })).data;
    },
  });
  const cardsQuery = useQuery({
    queryKey: ["flashcards", "raw"],
    queryFn: async () => (await api.get<FlashcardDto[]>("/Flashcards")).data,
  });
  const blocksQuery = useQuery({
    queryKey: ["timeblocks", "analytics-week"],
    queryFn: async () => {
      const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
      return (await api.get<TimeBlockDto[]>("/TimeBlocks", { params: { from: format(ws, "yyyy-MM-dd"), to: format(addDays(ws, 6), "yyyy-MM-dd") } })).data;
    },
  });

  const queries = [statsQuery, summaryQuery, sessionsQuery, cardsQuery, blocksQuery];
  const loading = queries.some((q) => q.isLoading);
  const firstError = queries.find((q) => q.isError);
  const refetchAll = () => queries.forEach((q) => { if (q.isError) q.refetch(); });

  const stats = statsQuery.data;
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);

  const totalStudyHours = stats ? Math.round(stats.TotalStudyHours * 10) / 10 : 0;
  const avgFocusScore = stats ? Math.round(stats.AvgFocusScore) : 0;
  const currentStreak = stats?.Streak ?? 0;
  const flashcardRetention = stats ? Math.round(stats.RetentionRate) : 0;
  const bestStudyTime = stats?.BestStudyTime || "N/A";

  // Heatmap: sessions per day over the last year (derived from GET /study-sessions)
  const heatmapData = useMemo(() => {
    const counts = new Map<string, number>();
    sessions.forEach((s) => { const k = dayKey(s.StartedAt); counts.set(k, (counts.get(k) ?? 0) + 1); });
    return Array.from(counts, ([date, value]) => ({ date, value }));
  }, [sessions]);

  // Weekly hours: tracked study time per day this week (Mon-Sun)
  const weeklyProductivity = useMemo(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(ws, i);
      const key = format(day, "yyyy-MM-dd");
      const daySessions = sessions.filter((s) => dayKey(s.StartedAt) === key);
      const seconds = daySessions.reduce((acc, s) => acc + s.DurationSeconds, 0);
      return { day: format(day, "EEE"), hours: Math.round((seconds / 3600) * 10) / 10, sessions: daySessions.length };
    });
  }, [sessions]);

  // Planned study hours per day this week from time blocks
  const plannedHours = useMemo(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    return Array.from({ length: 7 }, (_, i) => {
      const key = format(addDays(ws, i), "yyyy-MM-dd");
      const mins = (blocksQuery.data ?? [])
        .filter((b) => b.Date.slice(0, 10) === key && b.Category !== "break" && b.Category !== "personal")
        .reduce((acc, b) => acc + Math.max(0, toMin(b.EndTime) - toMin(b.StartTime)), 0);
      return { day: format(addDays(ws, i), "EEE"), hours: Math.round((mins / 60) * 10) / 10 };
    });
  }, [blocksQuery.data]);

  // Daily study minutes for the last 14 days (focus tab)
  const dailyMinutesTrend = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const day = subDays(new Date(), 13 - i);
      const key = format(day, "yyyy-MM-dd");
      const seconds = sessions.filter((s) => dayKey(s.StartedAt) === key).reduce((acc, s) => acc + s.DurationSeconds, 0);
      return { date: format(day, "MMM d"), minutes: Math.round(seconds / 60) };
    });
  }, [sessions]);

  // Cards reviewed per day for the last 14 days, based on each card's last review date
  const reviewTrend = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const day = subDays(new Date(), 13 - i);
      const key = format(day, "yyyy-MM-dd");
      const reviewed = cards.filter((c) => c.LastReviewed && dayKey(c.LastReviewed) === key).length;
      return { date: format(day, "MMM d"), reviewed };
    });
  }, [cards]);

  const weeklyTotalHours = weeklyProductivity.reduce((s, d) => s + d.hours, 0);
  const bestDay = weeklyProductivity.reduce((best, d) => (d.hours > best.hours ? d : best), weeklyProductivity[0] ?? { day: "", hours: 0, sessions: 0 });
  const longestSessionMin = sessions.reduce((m, s) => Math.max(m, s.DurationSeconds), 0) / 60;
  const cardsReviewedWeek = cards.filter((c) => c.LastReviewed && new Date(c.LastReviewed) >= subDays(new Date(), 7)).length;
  const hasSessions = sessions.length > 0;
  const hasReviews = reviewTrend.some((d) => d.reviewed > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header
        sidebarCollapsed={sidebarCollapsed}
        userRole="Trainer"
        mobileSidebar={<ApplicantSidebarContent onItemClick={() => {}} />}
      />

      <main className={cn("pt-20 pb-10 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ml-20" : "lg:ml-64", "ml-0")}>
        <div className="max-w-7xl mx-auto space-y-6">
          {firstError && <QueryError error={firstError.error} onRetry={refetchAll} />}
          {/* Header */}
          <div className="rounded-2xl bg-gradient-to-br from-accent/10 via-primary/5 to-background border border-accent/10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-accent/15">
                    <BarChart3 className="w-6 h-6 text-accent" />
                  </div>
                  Learning Analytics
                </h1>
                <p className="text-muted-foreground text-sm mt-2 max-w-md">
                  Track your study patterns, focus scores, and retention to optimize your learning.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-warning" />
                  {currentStreak} day streak
                </Badge>
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Clock, label: "Total Study Time", value: `${totalStudyHours}h`, color: "text-primary", bg: "bg-primary/10" },
              { icon: Target, label: "Avg Focus Score", value: `${avgFocusScore}%`, color: "text-accent", bg: "bg-accent/10" },
              { icon: Brain, label: "Flashcard Retention", value: `${flashcardRetention}%`, color: "text-success", bg: "bg-success/10" },
              { icon: Zap, label: "Best Study Time", value: bestStudyTime.split(" ")[0], color: "text-warning-foreground", bg: "bg-warning/10" },
            ].map((stat) => (
              <Card key={stat.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className={cn("p-2 rounded-lg", stat.bg)}>
                      <stat.icon className={cn("w-4 h-4", stat.color)} />
                    </div>
                  </div>
                  <p className={cn("text-2xl font-bold mt-3", stat.color)}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="overview" className="gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="focus" className="gap-1.5">
                <Target className="w-3.5 h-3.5" /> Focus
              </TabsTrigger>
              <TabsTrigger value="retention" className="gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Retention
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Study Heatmap */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Study Activity (Last 12 Months)
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto pb-4">
                  <StudyHeatmap data={heatmapData} />
                  {!hasSessions && <p className="text-xs text-muted-foreground text-center mt-2">No study sessions recorded yet. Open a lesson to start tracking.</p>}
                </CardContent>
              </Card>

              {/* Weekly Productivity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      Weekly Study Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyProductivity} barSize={32}>
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="h" width={30} />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 8 }}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "12px",
                            }}
                          />
                          <Bar dataKey="hours" radius={[8, 8, 4, 4]} fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Total: {weeklyTotalHours.toFixed(1)}h this week
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      Planned Study Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={plannedHours} barSize={32}>
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="h" width={30} />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 8 }}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "12px",
                            }}
                          />
                          <Bar dataKey="hours" radius={[8, 8, 4, 4]} fill="hsl(var(--accent))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Planned this week: {plannedHours.reduce((s, d) => s + d.hours, 0).toFixed(1)}h (from your time blocks)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Insights */}
              <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-primary/5">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4 text-accent" /> 
                    Weekly Insights
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    {bestDay.hours > 0 ? (
                      <li>• Your most productive day this week was <strong className="text-foreground">{bestDay.day}</strong> with {bestDay.hours}h of study time.</li>
                    ) : (
                      <li>• No study time tracked yet this week.</li>
                    )}
                    {stats && stats.BestStudyTime && <li>• Your best study time is <strong className="text-foreground">{stats.BestStudyTime}</strong>.</li>}
                    <li>• You've had <strong className="text-foreground">{stats?.SessionsThisWeek ?? 0}</strong> study sessions this week.</li>
                    <li>• You've reviewed <strong className="text-foreground">{cardsReviewedWeek}</strong> flashcards in the last 7 days.</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="focus" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    Daily Study Minutes (Last 2 Weeks)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {hasSessions ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyMinutesTrend}>
                          <defs>
                            <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="m" width={35} />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "12px",
                            }}
                          />
                          <Area type="monotone" dataKey="minutes" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#focusGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="No study sessions yet. Your daily study time will appear here." />
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-accent">{avgFocusScore}%</p>
                    <p className="text-sm text-muted-foreground mt-1">Average Focus</p>
                    <Progress value={avgFocusScore} className="mt-3 h-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-success">{Math.round(longestSessionMin)}m</p>
                    <p className="text-sm text-muted-foreground mt-1">Longest Session</p>
                    <p className="text-xs text-muted-foreground mt-1">Last 12 months</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{stats?.DeepWorkSessions ?? 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">Deep Work Sessions</p>
                    <p className="text-xs text-muted-foreground mt-1">{summaryQuery.data?.DistractionsLogged ?? 0} distractions logged</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="retention" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-muted-foreground" />
                    Cards Reviewed (Last 2 Weeks)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {hasReviews ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reviewTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} width={30} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem",
                            fontSize: "12px",
                          }}
                        />
                        <Line type="monotone" dataKey="reviewed" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: "hsl(var(--success))", strokeWidth: 0, r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    ) : (
                      <EmptyChart message="No flashcard reviews yet. Review some cards to see your activity here. Counts are based on each card's most recent review." />
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-success">{flashcardRetention}%</p>
                    <p className="text-sm text-muted-foreground mt-1">Current Retention</p>
                    <Progress value={flashcardRetention} className="mt-3 h-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{stats?.CardsReviewedToday ?? 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">Cards Reviewed</p>
                    <p className="text-xs text-muted-foreground mt-1">Today</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-warning-foreground">{stats?.FlashcardsDue ?? 0}</p>
                    <p className="text-sm text-muted-foreground mt-1">Due for Review</p>
                    <p className="text-xs text-muted-foreground mt-1">Now</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-success/20 bg-gradient-to-r from-success/5 to-accent/5">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-success" />
                    Retention Tips
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Review cards marked "Hard" more frequently to strengthen weak memories.</li>
                    {stats && stats.WeakTopics.length > 0 ? (
                      <li>• Consider adding more cards for <strong className="text-foreground">{stats.WeakTopics.join(", ")}</strong> — {stats.WeakTopics.length === 1 ? "it's a weak area" : "these are weak areas"}.</li>
                    ) : (
                      <li>• No weak topics detected yet. Keep reviewing to build up your data.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default LearningAnalytics;
