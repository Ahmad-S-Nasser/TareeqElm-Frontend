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
import { useTranslation, Trans } from "react-i18next";
import i18n from "@/i18n";
import api, { getApiError } from "@/lib/api";
import { formatDate, useFormatters } from "@/lib/format";
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
  /** Null = no data; otherwise Morning | Afternoon | Evening | Night. */
  BestStudyTime: string | null;
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
    <span className="flex-1">{getApiError(error, i18n.t("learning:analytics.loadFailed"))}</span>
    <Button size="sm" variant="outline" onClick={onRetry}>{i18n.t("common:actions.retry")}</Button>
  </div>
);

const EmptyChart = ({ message }: { message: string }) => (
  <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">{message}</div>
);

const LearningAnalytics = () => {
  const { t, i18n: i18nInstance } = useTranslation(["learning", "common"]);
  const { formatNumber, formatPercent } = useFormatters();
  const rtl = i18nInstance.dir() === "rtl";
  const axisNum = (v: number) => formatNumber(v);
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
  const bestStudyTime = stats?.BestStudyTime ? t(`analytics.bestTime.${stats.BestStudyTime}`, { defaultValue: stats.BestStudyTime }) : t("analytics.na");

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
      return { day: formatDate(day, { weekday: "short" }), hours: Math.round((seconds / 3600) * 10) / 10, sessions: daySessions.length };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, i18nInstance.language]);

  // Planned study hours per day this week from time blocks
  const plannedHours = useMemo(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const toMin = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
    return Array.from({ length: 7 }, (_, i) => {
      const key = format(addDays(ws, i), "yyyy-MM-dd");
      const mins = (blocksQuery.data ?? [])
        .filter((b) => b.Date.slice(0, 10) === key && b.Category !== "break" && b.Category !== "personal")
        .reduce((acc, b) => acc + Math.max(0, toMin(b.EndTime) - toMin(b.StartTime)), 0);
      return { day: formatDate(addDays(ws, i), { weekday: "short" }), hours: Math.round((mins / 60) * 10) / 10 };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksQuery.data, i18nInstance.language]);

  // Daily study minutes for the last 14 days (focus tab)
  const dailyMinutesTrend = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const day = subDays(new Date(), 13 - i);
      const key = format(day, "yyyy-MM-dd");
      const seconds = sessions.filter((s) => dayKey(s.StartedAt) === key).reduce((acc, s) => acc + s.DurationSeconds, 0);
      return { date: formatDate(day, { month: "short", day: "numeric" }), minutes: Math.round(seconds / 60) };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, i18nInstance.language]);

  // Cards reviewed per day for the last 14 days, based on each card's last review date
  const reviewTrend = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const day = subDays(new Date(), 13 - i);
      const key = format(day, "yyyy-MM-dd");
      const reviewed = cards.filter((c) => c.LastReviewed && dayKey(c.LastReviewed) === key).length;
      return { date: formatDate(day, { month: "short", day: "numeric" }), reviewed };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, i18nInstance.language]);

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

      <main className={cn("pt-20 pb-10 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0")}>
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
                  {t("analytics.title")}
                </h1>
                <p className="text-muted-foreground text-sm mt-2 max-w-md">
                  {t("analytics.subtitle")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-warning" />
                  {t("analytics.streakDays", { count: currentStreak })}
                </Badge>
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Clock, label: t("analytics.stats.totalStudy"), value: t("analytics.hoursValue", { value: formatNumber(totalStudyHours, { maximumFractionDigits: 1 }) }), color: "text-primary", bg: "bg-primary/10" },
              { icon: Target, label: t("analytics.stats.avgFocus"), value: formatPercent(avgFocusScore), color: "text-accent", bg: "bg-accent/10" },
              { icon: Brain, label: t("analytics.stats.retention"), value: formatPercent(flashcardRetention), color: "text-success", bg: "bg-success/10" },
              { icon: Zap, label: t("analytics.stats.bestTime"), value: bestStudyTime, color: "text-warning-foreground", bg: "bg-warning/10" },
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
                <Activity className="w-3.5 h-3.5" /> {t("analytics.tabs.overview")}
              </TabsTrigger>
              <TabsTrigger value="focus" className="gap-1.5">
                <Target className="w-3.5 h-3.5" /> {t("analytics.tabs.focus")}
              </TabsTrigger>
              <TabsTrigger value="retention" className="gap-1.5">
                <Brain className="w-3.5 h-3.5" /> {t("analytics.tabs.retention")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Study Heatmap */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {t("analytics.activity")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto pb-4">
                  <StudyHeatmap data={heatmapData} />
                  {!hasSessions && <p className="text-xs text-muted-foreground text-center mt-2">{t("analytics.noSessionsYet")}</p>}
                </CardContent>
              </Card>

              {/* Weekly Productivity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      {t("analytics.weeklyHours")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyProductivity} barSize={32}>
                          <XAxis dataKey="day" reversed={rtl} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} orientation={rtl ? "right" : "left"} tickFormatter={(v: number) => t("analytics.hoursValue", { value: axisNum(v) })} width={36} />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 8 }}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "12px",
                              textAlign: rtl ? "right" : "left",
                            }}
                          />
                          <Bar dataKey="hours" radius={[8, 8, 4, 4]} fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {t("analytics.weekTotal", { value: formatNumber(weeklyTotalHours, { maximumFractionDigits: 1 }) })}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      {t("analytics.plannedHours")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={plannedHours} barSize={32}>
                          <XAxis dataKey="day" reversed={rtl} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} orientation={rtl ? "right" : "left"} tickFormatter={(v: number) => t("analytics.hoursValue", { value: axisNum(v) })} width={36} />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 8 }}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "12px",
                              textAlign: rtl ? "right" : "left",
                            }}
                          />
                          <Bar dataKey="hours" radius={[8, 8, 4, 4]} fill="hsl(var(--accent))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {t("analytics.plannedTotal", { value: formatNumber(plannedHours.reduce((s, d) => s + d.hours, 0), { maximumFractionDigits: 1 }) })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Insights */}
              <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-primary/5">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4 text-accent" /> 
                    {t("analytics.insights")}
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    {bestDay.hours > 0 ? (
                      <li>• <Trans i18nKey="analytics.insight.bestDay" ns="learning" values={{ day: bestDay.day, hours: formatNumber(bestDay.hours, { maximumFractionDigits: 1 }) }} components={{ b: <strong className="text-foreground" /> }} /></li>
                    ) : (
                      <li>• {t("analytics.insight.noTime")}</li>
                    )}
                    {stats && stats.BestStudyTime && <li>• <Trans i18nKey="analytics.insight.bestTime" ns="learning" values={{ time: t(`analytics.bestTime.${stats.BestStudyTime}`, { defaultValue: stats.BestStudyTime }) }} components={{ b: <strong className="text-foreground" /> }} /></li>}
                    <li>• <Trans i18nKey="analytics.insight.sessions" ns="learning" count={stats?.SessionsThisWeek ?? 0} values={{ n: formatNumber(stats?.SessionsThisWeek ?? 0) }} components={{ b: <strong className="text-foreground" /> }} /></li>
                    <li>• <Trans i18nKey="analytics.insight.reviewed" ns="learning" count={cardsReviewedWeek} values={{ n: formatNumber(cardsReviewedWeek) }} components={{ b: <strong className="text-foreground" /> }} /></li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="focus" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    {t("analytics.dailyMinutes")}
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
                          <XAxis dataKey="date" reversed={rtl} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} orientation={rtl ? "right" : "left"} tickFormatter={(v: number) => t("analytics.minutesShort", { value: axisNum(v) })} width={40} />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "12px",
                              textAlign: rtl ? "right" : "left",
                            }}
                          />
                          <Area type="monotone" dataKey="minutes" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#focusGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart message={t("analytics.noSessionsChart")} />
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-accent">{formatPercent(avgFocusScore)}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("analytics.avgFocus")}</p>
                    <Progress value={avgFocusScore} className="mt-3 h-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-success">{t("analytics.minutesShort", { value: formatNumber(Math.round(longestSessionMin)) })}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("analytics.longestSession")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("analytics.last12")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{formatNumber(stats?.DeepWorkSessions ?? 0)}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("analytics.deepWork")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("analytics.distractionsLogged", { count: summaryQuery.data?.DistractionsLogged ?? 0 })}</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="retention" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-muted-foreground" />
                    {t("analytics.cardsReviewed2w")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {hasReviews ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reviewTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" reversed={rtl} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} orientation={rtl ? "right" : "left"} tickFormatter={axisNum} width={30} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem",
                            fontSize: "12px",
                              textAlign: rtl ? "right" : "left",
                          }}
                        />
                        <Line type="monotone" dataKey="reviewed" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: "hsl(var(--success))", strokeWidth: 0, r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    ) : (
                      <EmptyChart message={t("analytics.noReviews")} />
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-success">{formatPercent(flashcardRetention)}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("analytics.currentRetention")}</p>
                    <Progress value={flashcardRetention} className="mt-3 h-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{formatNumber(stats?.CardsReviewedToday ?? 0)}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("analytics.cardsReviewed")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("analytics.today")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-warning-foreground">{formatNumber(stats?.FlashcardsDue ?? 0)}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("analytics.dueForReview")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("analytics.now")}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-success/20 bg-gradient-to-r from-success/5 to-accent/5">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-success" />
                    {t("analytics.tips.title")}
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• {t("analytics.tips.hard")}</li>
                    {stats && stats.WeakTopics.length > 0 ? (
                      <li>• <Trans i18nKey="analytics.tips.weak" ns="learning" count={stats.WeakTopics.length} values={{ topics: stats.WeakTopics.join(t("analytics.listSeparator")) }} components={{ b: <strong className="text-foreground" /> }} /></li>
                    ) : (
                      <li>• {t("analytics.tips.noWeak")}</li>
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
