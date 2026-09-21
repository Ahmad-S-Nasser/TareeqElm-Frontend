import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api, { getApiError } from "@/lib/api";
import { useProfile, initials } from "@/hooks/useProfile";
import {
  Mail, BookOpen, Clock, Flame, Trophy, Target,
  Brain, Award, Star, Zap, GraduationCap, TrendingUp, Loader2
} from "lucide-react";

interface TrainerStats {
  TotalStudyHours: number;
  Streak: number;
  CoursesEnrolled: number;
  LessonsCompleted: number;
  QuizAverage: number;
  TotalCards: number;
}
interface ActivitySummary {
  TotalStudySeconds: number;
  CardsReviewed: number;
  LessonsCompleted: number;
  QuizzesPassed: number;
  PerfectQuizzes: number;
  CoursesEnrolled: number;
  CoursesCompleted: number;
  Streak: number;
}

const buildAchievements = (a: ActivitySummary) => [
  { name: "First Steps", desc: "Complete your first lesson", icon: Star, earned: a.LessonsCompleted >= 1, color: "text-amber-500" },
  { name: "Streak Starter", desc: "Maintain a 7-day streak", icon: Flame, earned: a.Streak >= 7, color: "text-orange-500" },
  { name: "Quiz Master", desc: "Score 100% on a quiz", icon: Zap, earned: a.PerfectQuizzes >= 1, color: "text-primary" },
  { name: "Knowledge Seeker", desc: "Complete 10 lessons", icon: Brain, earned: a.LessonsCompleted >= 10, color: "text-accent" },
  { name: "Study Marathon", desc: "Study for 50+ hours total", icon: Clock, earned: a.TotalStudySeconds >= 50 * 3600, color: "text-muted-foreground" },
  { name: "Course Champion", desc: "Complete a full course", icon: GraduationCap, earned: a.CoursesCompleted >= 1, color: "text-muted-foreground" },
  { name: "Quiz Passer", desc: "Pass 5 quizzes", icon: Trophy, earned: a.QuizzesPassed >= 5, color: "text-muted-foreground" },
  { name: "Flashcard Pro", desc: "Review 100 flashcards", icon: Target, earned: a.CardsReviewed >= 100, color: "text-muted-foreground" },
];

const UserProfile = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: me, isLoading: profileLoading, isError: profileError, error: profileErr } = useProfile();

  const stats = useQuery({
    queryKey: ["trainer-stats"],
    queryFn: async () => (await api.get<TrainerStats>("/Trainers/stats")).data,
  });
  const activity = useQuery({
    queryKey: ["trainer-activity-summary"],
    queryFn: async () => (await api.get<ActivitySummary>("/Trainers/activity-summary")).data,
  });

  const achievements = activity.data ? buildAchievements(activity.data) : [];
  const earnedCount = achievements.filter(a => a.earned).length;
  const userName = me?.FullName ?? "";

  const statCards = stats.data && activity.data ? [
    { label: "Total Study Hours", value: `${stats.data.TotalStudyHours.toFixed(1)}h`, icon: Clock, color: "bg-primary/10 text-primary" },
    { label: "Study Streak", value: `${stats.data.Streak} days`, icon: Flame, color: "bg-warning/10 text-warning" },
    { label: "Completed Courses", value: String(activity.data.CoursesCompleted), icon: BookOpen, color: "bg-success/10 text-success" },
    { label: "Quiz Average", value: `${Math.round(stats.data.QuizAverage)}%`, icon: Target, color: "bg-accent/10 text-accent" },
    { label: "Flashcards", value: `${stats.data.TotalCards} cards`, icon: Brain, color: "bg-primary/10 text-primary" },
    { label: "Achievements", value: `${earnedCount} / ${achievements.length}`, icon: Trophy, color: "bg-amber-500/10 text-amber-500" },
  ] : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent onItemClick={() => {}} />} />

      <main className={cn("pt-20 pb-8 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ml-20" : "lg:ml-64", "ml-0")}>
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="p-6">
              {profileLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : profileError ? (
                <p className="text-destructive text-sm">{getApiError(profileErr, "Could not load your profile.")}</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  {me?.AvatarUrl ? (
                    <img src={me.AvatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-lg">
                      {initials(userName)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold">{userName}</h1>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {me?.Email}</span>
                      <Badge variant="secondary" className="capitalize">{me?.Role || "Trainer"}</Badge>
                    </div>
                  </div>
                  {activity.data && (
                    <div className="flex items-center gap-2">
                      <div className="text-center px-4 py-2 rounded-xl bg-muted">
                        <p className="text-2xl font-bold text-primary">{activity.data.CoursesEnrolled}</p>
                        <p className="text-xs text-muted-foreground">Enrolled</p>
                      </div>
                      <div className="text-center px-4 py-2 rounded-xl bg-muted">
                        <p className="text-2xl font-bold text-success">{activity.data.CoursesCompleted}</p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {stats.isLoading || activity.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : stats.isError || activity.isError ? (
            <Card><CardContent className="p-6 text-center text-destructive text-sm">{getApiError(stats.error ?? activity.error, "Could not load your learning statistics.")}</CardContent></Card>
          ) : (
            <>
              {/* Learning Statistics */}
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" /> Learning Statistics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {statCards.map(s => (
                    <Card key={s.label}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.color)}>
                          <s.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{s.value}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Achievements */}
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" /> Achievements
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {achievements.map(a => (
                    <Card key={a.name} className={cn(!a.earned && "opacity-50")}>
                      <CardContent className="p-4 text-center">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2", a.earned ? "bg-amber-500/10" : "bg-muted")}>
                          <a.icon className={cn("w-6 h-6", a.color)} />
                        </div>
                        <p className="font-medium text-sm">{a.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{a.desc}</p>
                        {a.earned && <Badge className="mt-2 bg-success/10 text-success border-success/20 text-[10px]">Earned</Badge>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default UserProfile;
