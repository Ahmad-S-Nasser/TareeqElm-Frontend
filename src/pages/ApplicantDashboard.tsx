import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useFormatters } from "@/lib/format";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ReadinessGauge } from "@/components/dashboard/ReadinessGauge";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { ExamCountdown } from "@/components/dashboard/ExamCountdown";
import { TodaysPlan } from "@/components/dashboard/TodaysPlan";
import { WeaknessAnalysis } from "@/components/dashboard/WeaknessAnalysis";
import { AIChatBar } from "@/components/dashboard/AIChatBar";
import { StudyCoachWidget } from "@/components/dashboard/StudyCoachWidget";
import { FloatingCoachButton } from "@/components/dashboard/FloatingCoachButton";
import { useCourses } from "@/hooks/useCourses";
import { useProgress } from "@/hooks/useProgress";
import { useStudyCoach } from "@/hooks/useStudyCoach";
import { useAchievements } from "@/hooks/useAchievements";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Flame, Target, Clock, Trophy, Loader2, Brain, RotateCcw, Star, Bell, Award, Zap } from "lucide-react";

const ApplicantDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { formatNumber, formatPercent } = useFormatters();

  const [todaysPlanItems, setTodaysPlanItems] = useState([
    { id: "1", title: "plan.items.reviewTestDesign", minutes: 25, type: "lesson" as const, completed: true },
    { id: "2", title: "plan.items.practiceBlackBox", minutes: 15, type: "quiz" as const, completed: true },
    { id: "3", title: "plan.items.flashcardReview", minutes: 10, type: "flashcard" as const, completed: false },
    { id: "4", title: "plan.items.aiReview", minutes: 30, type: "ai-review" as const, completed: false },
  ]);

  const handleTogglePlanItem = (id: string) => {
    setTodaysPlanItems(items => items.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const { courses, loading: coursesLoading, fetchEnrolledCourses } = useCourses();
  const { stats, loading: progressLoading } = useProgress();
  const { trainerData, dataLoading: coachLoading } = useStudyCoach();
  const { levelInfo, totalXP, earned } = useAchievements();
  const { unreadCount } = useSmartNotifications();

  useEffect(() => { fetchEnrolledCourses(); }, [fetchEnrolledCourses]);

  const loading = coursesLoading || progressLoading;

  const readinessPercentage = trainerData?.RetentionRate || 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} mobileSidebar={<ApplicantSidebarContent onItemClick={() => console.log('Mobile sidebar clicked')} />} />

      <main className={cn("pt-20 pb-24 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0")}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Welcome + Level */}
          <section className="animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">{t("welcomeBack", { name: user?.FullName ?? "" })} 👋</h1>
                <p className="text-muted-foreground">{t("welcomeSubtitle")}</p>
              </div>
              {levelInfo && (
                <div className="hidden sm:flex items-center gap-3 bg-card border border-border/50 rounded-xl px-4 py-2.5 shadow-sm cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/achievements')}>
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                    <Star className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("levelShort", { level: formatNumber(levelInfo.level), title: levelInfo.title })}</p>
                    <div className="flex items-center gap-2">
                      <Progress value={(levelInfo.currentXP / levelInfo.xpForNext) * 100} className="h-1.5 w-20" />
                      <span className="text-[10px] text-muted-foreground">{t("xp", { count: formatNumber(totalXP) })}</span>
                    </div>
                  </div>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="icon" className="relative ms-1" aria-label={t("notificationsAria")} onClick={() => navigate('/notifications')}>
                      <Bell className="w-4 h-4" />
                      <span className="absolute -top-0.5 -end-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">{formatNumber(unreadCount)}</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Stats Grid - Connected to real data */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <StatsCard
              icon={Flame}
              title={t("stats.streak")}
              value={t("stats.days", { count: trainerData?.Streak ?? 0 })}
              trend={trainerData?.Streak ? { value: trainerData.Streak, positive: true } : undefined}
              variant="warning"
              onClick={() => navigate('/achievements')}
            />
            <StatsCard
              icon={Target}
              title={t("stats.focusScore")}
              value={formatPercent(trainerData?.AvgFocusScore ?? 0)}
              trend={{ value: 8, positive: true }}
              variant="success"
              onClick={() => navigate('/analytics')}
            />
            <StatsCard
              icon={Clock}
              title={t("stats.studyHours")}
              value={t("stats.hoursValue", { value: formatNumber(trainerData?.TotalStudyHours ?? 0) })}
              subtitle={t("stats.total")}
              variant="primary"
              onClick={() => navigate('/analytics')}
            />
            <StatsCard
              icon={Trophy}
              title={t("stats.badgesEarned")}
              value={formatNumber(earned.length)}
              subtitle={t("xp", { count: formatNumber(totalXP) })}
              variant="accent"
              onClick={() => navigate('/achievements')}
            />
          </section>

          {/* Quick Action Chips */}
          {trainerData && (
            <section className="flex gap-2 flex-wrap animate-slide-up" style={{ animationDelay: "150ms" }}>
              {trainerData.FlashcardsDue > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5 border-rose-500/30 text-rose-600 hover:bg-rose-500/5" onClick={() => navigate('/spaced-repetition')}>
                  <RotateCcw className="w-3.5 h-3.5" /> {t("chips.cardsDue", { count: trainerData.FlashcardsDue })}
                </Button>
              )}
              {trainerData.TimeBlocksToday === 0 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/time-blocking')}>
                  <Clock className="w-3.5 h-3.5" /> {t("chips.planToday")}
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/ai-coach')}>
                <Brain className="w-3.5 h-3.5" /> {t("chips.askCoach")}
              </Button>
            </section>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-card border border-border/50 shadow-card p-6 flex flex-col items-center justify-center cursor-pointer hover:shadow-elevated transition-all" onClick={() => navigate("/analytics")}>
                  <p className="text-sm text-muted-foreground mb-2">{t("readiness.title")}</p>
                  <ReadinessGauge percentage={readinessPercentage} />
                  <p className="text-sm text-muted-foreground mt-2">{t("readiness.overall")}</p>
                </div>
                <ExamCountdown examName={t("exam.defaultName")} date={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)} onStartPractice={() => navigate("/mock-exam")} />
              </div>

              {/* Enrolled Courses */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">{t("myCourses")}</h2>
                  <button onClick={() => navigate("/catalog")} className="text-sm text-primary hover:underline">{t("browseAll")}</button>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : courses.length === 0 ? (
                  <div className="rounded-2xl bg-card border border-border/50 shadow-card p-8 text-center">
                    <p className="text-muted-foreground mb-4">{t("noCourses")}</p>
                    <button onClick={() => navigate("/catalog")} className="text-primary font-medium hover:underline">{t("browseCatalog")} <span className="inline-block rtl:rotate-180">→</span></button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {courses.slice(0, 4).map((course) => (
                      <CourseCard 
                        key={course.Id} 
                        Title={course.Title} 
                        Description={course.Description || ""} 
                        Progress={course.Enrollment?.ProgressPercentage || 0} 
                        Lessons={course.LessonsCount || 0} 
                        Duration={t("stats.hoursValue", { value: formatNumber(course.DurationHours || 0) })} 
                        onClick={() => navigate(`/courses/${course.Id}`)} 
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6 animate-slide-up" style={{ animationDelay: "300ms" }}>
              <TodaysPlan items={todaysPlanItems} onToggleComplete={handleTogglePlanItem} />
              <StudyCoachWidget />
            </div>
          </div>
        </div>
      </main>

      <AIChatBar onSend={(msg) => navigate(`/ai-tutor?q=${encodeURIComponent(msg)}`)} />
      <FloatingCoachButton />
    </div>
  );
};

export default ApplicantDashboard;
