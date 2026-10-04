import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Trophy, Star, Award, Loader2, Users, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiError } from "@/lib/api";
import { useMyCoursesQuery } from "@/hooks/useCourses";
import { useLeaderboardQuery, type LeaderboardPeriod } from "@/hooks/useLeaderboard";

const MEDALS = ["🥇", "🥈", "🥉"];
const PERIODS: LeaderboardPeriod[] = ["week", "month", "all"];

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const InstructorLeaderboard = () => {
  const { t } = useTranslation("instructor");
  const { formatNumber, formatPercent } = useFormatters();
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [courseId, setCourseId] = useState<string>("all");

  const { data: courses = [] } = useMyCoursesQuery();
  const { data: board, isLoading, error } = useLeaderboardQuery({
    period,
    courseId: courseId !== "all" ? courseId : undefined,
  });

  const entries = board?.Entries ?? [];

  return (
    <InstructorPageLayout>
      <section className="animate-slide-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-glow-accent">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("leaderboard.title")}</h1>
              <p className="text-muted-foreground text-sm">{t("leaderboard.subtitle")}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("leaderboard.filters.allCourses")}</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>{t(`leaderboard.periods.${p}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <p className="text-center text-destructive py-12">{getApiError(error, t("leaderboard.loadFailed"))}</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t("leaderboard.empty")}</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <section className="grid grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: "100ms" }}>
            {entries.slice(0, 3).map((entry, i) => (
              <Card key={entry.TrainerId} className={`shadow-soft border-border/50 text-center ${i === 0 ? "ring-2 ring-warning/30" : ""}`}>
                <CardContent className="pt-6 pb-4">
                  <div className="text-3xl mb-2">{MEDALS[i]}</div>
                  <Avatar className="w-14 h-14 mx-auto mb-2">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(entry.TrainerName ?? "")}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-sm">{entry.TrainerName ?? t("leaderboard.deletedTrainer")}</h3>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Star className="w-3.5 h-3.5 text-warning" />
                    <span className="font-bold text-sm">{t("leaderboard.points", { count: entry.Points })}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Award className="w-3 h-3 text-accent" />{entry.QuizAverage != null ? t("leaderboard.quizAvg", { value: formatPercent(entry.QuizAverage) }) : t("leaderboard.noQuizzes")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          {/* Full List */}
          <section className="animate-slide-up" style={{ animationDelay: "200ms" }}>
            <Card className="shadow-soft border-border/50">
              <CardHeader>
                <CardTitle className="text-base">{t("leaderboard.fullRankings")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div key={entry.TrainerId} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                      <span className="w-8 text-center font-bold text-muted-foreground">
                        {entry.Rank != null ? `#${formatNumber(entry.Rank)}` : "-"}
                      </span>
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(entry.TrainerName ?? "")}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 font-medium text-sm truncate">{entry.TrainerName ?? t("leaderboard.deletedTrainer")}</span>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-warning" />{formatNumber(entry.Points)}</span>
                        <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" />{formatNumber(entry.Streak)}</span>
                        <span>{entry.QuizAverage != null ? formatPercent(entry.QuizAverage) : "-"}</span>
                        <Badge variant="secondary" className="text-[10px]">{t("leaderboard.completed", { count: entry.CoursesCompleted })}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </InstructorPageLayout>
  );
};

export default InstructorLeaderboard;
