import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Lock, Star, Loader2, AlertCircle } from "lucide-react";
import { useAchievements } from "@/hooks/useAchievements";
import { AchievementUnlockToast } from "@/components/gamification/AchievementUnlockToast";

const tierStyles = {
  bronze: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-600" },
  silver: { bg: "bg-slate-400/10", border: "border-slate-400/30", text: "text-slate-500" },
  gold: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-500" },
  platinum: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-500" },
};

const Achievements = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const { achievements, earned, loading, error, newlyUnlocked, dismissNewlyUnlocked, totalXP, levelInfo } = useAchievements();
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");
  const { formatNumber, formatPercent } = useFormatters();

  const categories = ['all', 'streak', 'study', 'mastery', 'productivity'] as const;
  const filtered = activeTab === 'all' ? achievements : achievements.filter(a => a.category === activeTab);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent onItemClick={() => {}} />} />

      <AchievementUnlockToast
        achievements={achievements.filter(a => newlyUnlocked.includes(a.id))}
        onDismiss={dismissNewlyUnlocked}
      />

      <main className={cn("pt-20 pb-8 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0")}>
        {loading ? (
          <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t("achievements.loading")}</p>
          </div>
        ) : error ? (
          <div className="max-w-5xl mx-auto text-center py-24">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="font-medium mb-1">{t("achievements.loadFailed")}</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <section className="animate-slide-up">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t("achievements.title")}</h1>
                <p className="text-muted-foreground text-sm">{t("achievements.unlockedOf", { earned: formatNumber(earned.length), total: formatNumber(achievements.length) })}</p>
              </div>
            </div>
          </section>

          {/* Level & XP Card */}
          {levelInfo && (
            <Card className="animate-slide-up bg-gradient-to-br from-primary/5 via-accent/5 to-transparent border-primary/20" style={{ animationDelay: "50ms" }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow-primary">
                      <Star className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{t("achievements.level", { level: formatNumber(levelInfo.level) })}</p>
                      <p className="text-sm text-muted-foreground">{levelInfo.title}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-2xl font-bold text-primary">{formatNumber(totalXP)}</p>
                    <p className="text-xs text-muted-foreground">{t("achievements.totalXP")}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-muted-foreground">{t("achievements.progressToLevel", { level: formatNumber(levelInfo.level + 1) })}</p>
                    <p className="text-xs font-medium">{t("achievements.xpOf", { current: formatNumber(levelInfo.currentXP), total: formatNumber(levelInfo.xpForNext) })}</p>
                  </div>
                  <Progress value={(levelInfo.currentXP / levelInfo.xpForNext) * 100} className="h-3" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overall progress */}
          <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">{t("achievements.badgeProgress")}</p>
                <Badge variant="secondary">{formatPercent((earned.length / achievements.length) * 100)}</Badge>
              </div>
              <Progress value={(earned.length / achievements.length) * 100} className="h-3" />
              <div className="grid grid-cols-4 gap-4 mt-4">
                {(['bronze', 'silver', 'gold', 'platinum'] as const).map(tier => {
                  const count = earned.filter(a => a.tier === tier).length;
                  const total = achievements.filter(a => a.tier === tier).length;
                  const style = tierStyles[tier];
                  return (
                    <div key={tier} className={cn("rounded-xl p-3 text-center border", style.bg, style.border)}>
                      <p className={cn("text-lg font-bold", style.text)}><bdi>{formatNumber(count)}/{formatNumber(total)}</bdi></p>
                      <p className="text-xs text-muted-foreground">{t(`achievements.tiers.${tier}`)}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full max-w-lg">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="text-xs">{t(`achievements.categories.${cat}`)}</TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((a) => {
                const style = tierStyles[a.tier];
                return (
                  <Card key={a.id} className={cn("transition-all duration-300 overflow-hidden", a.unlocked ? cn("border", style.border, "hover:shadow-md") : "opacity-60 border-border/40")}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0", a.unlocked ? style.bg : "bg-muted")}>
                          {a.unlocked ? a.icon : <Lock className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{a.title}</p>
                            <Badge variant="outline" className={cn("text-[10px] shrink-0", style.text)}>{t(`achievements.tiers.${a.tier}`)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">{a.requirement}</span>
                              <span className="text-[10px] font-medium">
                                {a.unlocked ? <span className="text-primary">+{t("achievements.xp", { count: formatNumber(a.xp) })}</span> : formatPercent(a.progress)}
                              </span>
                            </div>
                            <Progress value={a.progress} className="h-1.5" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </Tabs>
        </div>
        )}
      </main>
    </div>
  );
};

export default Achievements;
