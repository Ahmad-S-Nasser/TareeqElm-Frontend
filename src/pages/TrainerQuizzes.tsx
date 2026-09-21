import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { getApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertCircle, FileQuestion, Clock, Target, Play } from "lucide-react";
import { useQuizListQuery, QuizSummary } from "@/hooks/useQuizzes";
import { useProgress } from "@/hooks/useProgress";

const ALL = "all";

const TrainerQuizzes = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation(["quizzes", "common"]);
  const { formatNumber, formatPercent, formatDateTime } = useFormatters();
  const [params, setParams] = useSearchParams();
  const courseFilter = params.get("courseId") ?? ALL;

  // Fetch all enrolled-course quizzes once and filter client side so the filter chips stay complete.
  const quizzesQuery = useQuizListQuery();
  const { quizResults, loading: progressLoading, error: resultsError } = useProgress();

  const quizzes = useMemo(() => quizzesQuery.data ?? [], [quizzesQuery.data]);
  const courses = useMemo(() => {
    const map = new Map<string, string>();
    quizzes.forEach((q) => map.set(q.CourseId, q.CourseTitle ?? t("common:deletedCourse")));
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [quizzes, t]);

  const grouped = useMemo(() => {
    const visible = courseFilter === ALL ? quizzes : quizzes.filter((q) => q.CourseId === courseFilter);
    const map = new Map<string, { title: string; items: QuizSummary[] }>();
    visible.forEach((q) => {
      const g = map.get(q.CourseId) ?? { title: q.CourseTitle ?? t("common:deletedCourse"), items: [] };
      g.items.push(q);
      map.set(q.CourseId, g);
    });
    return Array.from(map, ([id, g]) => ({ id, ...g }));
  }, [quizzes, courseFilter, t]);

  const setFilter = (id: string) => {
    if (id === ALL) setParams({}, { replace: true });
    else setParams({ courseId: id }, { replace: true });
  };

  const latestResults = useMemo(
    () => [...quizResults].sort((a, b) => new Date(b.TakenAt).getTime() - new Date(a.TakenAt).getTime()).slice(0, 10),
    [quizResults]
  );

  return (
    <div className="min-h-screen bg-background">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />

      <main
        className={cn(
          "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
          "ms-0"
        )}
      >
        <div className="max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold">{t("list.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("list.subtitle")}</p>
          </div>

          {quizzesQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-16" role="status">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">{t("list.loading")}</p>
            </div>
          ) : quizzesQuery.error ? (
            <div className="text-center py-16" role="alert">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
              <p className="font-medium mb-1">{t("list.loadFailedTitle")}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {getApiError(quizzesQuery.error, t("list.loadFailed"))}
              </p>
              <Button variant="outline" onClick={() => quizzesQuery.refetch()}>
                {t("common:actions.retry")}
              </Button>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-16">
              <FileQuestion className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium mb-1">{t("list.none")}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t("list.noneHint")}
              </p>
              <Button onClick={() => navigate("/catalog")}>{t("browseCatalog")}</Button>
            </div>
          ) : (
            <section className="space-y-6" aria-label={t("list.available")}>
              {courses.length > 1 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("list.filterByCourse")}>
                  <Button
                    size="sm"
                    variant={courseFilter === ALL ? "default" : "outline"}
                    aria-pressed={courseFilter === ALL}
                    onClick={() => setFilter(ALL)}
                  >
                    {t("list.allCourses")}
                  </Button>
                  {courses.map((c) => (
                    <Button
                      key={c.id}
                      size="sm"
                      variant={courseFilter === c.id ? "default" : "outline"}
                      aria-pressed={courseFilter === c.id}
                      onClick={() => setFilter(c.id)}
                    >
                      {c.title}
                    </Button>
                  ))}
                </div>
              )}

              {grouped.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground mb-3">{t("list.noneForCourse")}</p>
                  <Button variant="outline" size="sm" onClick={() => setFilter(ALL)}>
                    {t("list.showAll")}
                  </Button>
                </div>
              ) : (
                grouped.map((g) => (
                  <div key={g.id} className="space-y-3">
                    <h2 className="text-lg font-semibold">{g.title}</h2>
                    <div className="grid gap-3 md:grid-cols-2">
                      {g.items.map((q) => (
                        <Card key={q.Id}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">{q.Title}</CardTitle>
                            <CardDescription>{q.CourseTitle ?? t("common:deletedCourse")}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileQuestion className="w-4 h-4" />
                                {t("list.questions", { count: q.QuestionCount })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Target className="w-4 h-4" />
                                {t("list.pass", { score: formatPercent(q.PassingScore) })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {q.TimeLimitMinutes ? t("list.minutes", { count: q.TimeLimitMinutes }) : t("list.noTimeLimit")}
                              </span>
                            </div>
                            <Button className="gap-2" onClick={() => navigate(`/quizzes/${q.Id}`)}>
                              <Play className="w-4 h-4 rtl:-scale-x-100" />
                              {t("list.start")}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          )}

          <section className="space-y-3" aria-label={t("list.myResults")}>
            <h2 className="text-xl font-semibold">{t("list.myResults")}</h2>
            {progressLoading ? (
              <p className="text-sm text-muted-foreground">{t("list.loadingResults")}</p>
            ) : resultsError ? (
              <p className="text-sm text-destructive" role="alert">
                {resultsError}
              </p>
            ) : latestResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("list.noResults")}</p>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {latestResults.map((r) => (
                    <div key={r.Id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="flex-1 min-w-[10rem]">
                        <p className="font-medium">{r.QuizTitle ?? t("common:deletedEntity")}</p>
                        <p className="text-xs text-muted-foreground">{r.CourseTitle ? `${r.CourseTitle} · ` : ""}{formatDateTime(r.TakenAt)}</p>
                      </div>
                      <span className="text-sm font-semibold">{formatPercent(r.Percentage)}</span>
                      <span className="text-sm text-muted-foreground">
                        <bdi>{formatNumber(r.Score)}/{formatNumber(r.TotalPoints)}</bdi>
                      </span>
                      <Badge variant={r.Passed ? "default" : "destructive"}>{r.Passed ? t("status.passed") : t("status.failed")}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default TrainerQuizzes;
