import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ClipboardList, Loader2, Users, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { useOrganizationExamsQuery, useQuizResultsQuery, type ExamSummary } from "@/hooks/useOrganizationExams";

const ALL = "all";

interface CourseOption { Id: string; Title: string }
interface DepartmentOption { Id: string; Name: string }

const passRateColor = (rate: number) =>
    rate >= 80 ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" :
        rate >= 50 ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20" :
            "text-destructive border-destructive/20 bg-destructive/5";

const OrganizationExams = () => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber, formatDateTime } = useFormatters();

    const [courseFilter, setCourseFilter] = useState(ALL);
    const [departmentFilter, setDepartmentFilter] = useState(ALL);
    const [selectedExam, setSelectedExam] = useState<ExamSummary | null>(null);

    const filters = {
        courseId: courseFilter !== ALL ? courseFilter : undefined,
        departmentId: departmentFilter !== ALL ? departmentFilter : undefined,
    };
    const { data: exams = [], isLoading, isError, error } = useOrganizationExamsQuery(filters);

    const { data: courses = [] } = useQuery({
        queryKey: ["enrollment-courses"],
        queryFn: async () => (await api.get<CourseOption[]>("/Courses", { params: { status: "Published", pageSize: 100 } })).data,
    });
    const { data: departments = [] } = useQuery({
        queryKey: ["organization-departments"],
        queryFn: async () => (await api.get<DepartmentOption[]>("/Departments")).data,
    });

    const { data: results = [], isLoading: resultsLoading, isError: resultsError, error: resultsErrorObj } =
        useQuizResultsQuery(selectedExam?.QuizId ?? null);

    return (
        <OrganizationPageLayout>
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-primary" />
                    </div>
                    {t("organization:exams.title")}
                </h1>
                <p className="text-muted-foreground mt-1">{t("organization:exams.subtitle")}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                    <SelectTrigger className="w-full sm:w-56" aria-label={t("organization:exams.table.course")}><SelectValue placeholder={t("organization:exams.filters.allCourses")} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("organization:exams.filters.allCourses")}</SelectItem>
                        {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-56" aria-label={t("organization:exams.table.department")}><SelectValue placeholder={t("organization:exams.filters.allDepartments")} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("organization:exams.filters.allDepartments")}</SelectItem>
                        {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <Card className="border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("organization:exams.table.exam")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("organization:exams.table.course")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("organization:exams.table.department")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("organization:exams.table.attempts")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("organization:exams.table.average")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("organization:exams.table.passRate")}</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && (
                                    <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></td></tr>
                                )}
                                {isError && (
                                    <tr><td colSpan={7} className="text-center py-12 text-destructive">{getApiError(error, t("organization:exams.loadFailed"))}</td></tr>
                                )}
                                {!isLoading && !isError && exams.map((exam) => (
                                    <tr key={exam.QuizId} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <p className="font-semibold">{exam.QuizTitle}</p>
                                            <p className="text-xs text-muted-foreground">{t("organization:exams.questionCount", { count: exam.QuestionCount })}</p>
                                        </td>
                                        <td className="px-5 py-3.5">{exam.CourseTitle ?? t("common:deletedCourse")}</td>
                                        <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{exam.DepartmentName ?? t("common:labels.none")}</td>
                                        <td className="px-5 py-3.5">{formatNumber(exam.AttemptCount)}</td>
                                        <td className="px-5 py-3.5">
                                            {exam.AttemptCount === 0 ? (
                                                <span className="text-muted-foreground">{t("organization:exams.noAttempts")}</span>
                                            ) : (
                                                <span dir="ltr">{formatNumber(exam.AverageScore, { maximumFractionDigits: 1 })}%</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {exam.AttemptCount === 0 ? (
                                                <span className="text-muted-foreground">—</span>
                                            ) : (
                                                <Badge variant="outline" className={cn("text-xs font-semibold", passRateColor(exam.PassRate))}>
                                                    {formatNumber(exam.PassRate, { maximumFractionDigits: 0 })}%
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-end">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedExam(exam)}>
                                                {t("organization:exams.viewResults")}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading && !isError && exams.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">{t("organization:exams.empty")}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Sheet open={!!selectedExam} onOpenChange={(open) => !open && setSelectedExam(null)}>
                <SheetContent className="sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>{selectedExam?.QuizTitle}</SheetTitle>
                        <SheetDescription>{selectedExam?.CourseTitle ?? t("common:deletedCourse")}</SheetDescription>
                    </SheetHeader>

                    {selectedExam && (
                        <div className="mt-6 space-y-6">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl border border-border/50 p-3 text-center">
                                    <Users className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                                    <p className="font-bold">{formatNumber(selectedExam.AttemptCount)}</p>
                                    <p className="text-[11px] text-muted-foreground">{t("organization:exams.table.attempts")}</p>
                                </div>
                                <div className="rounded-xl border border-border/50 p-3 text-center">
                                    <TrendingUp className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                                    <p className="font-bold" dir="ltr">{formatNumber(selectedExam.AverageScore, { maximumFractionDigits: 1 })}%</p>
                                    <p className="text-[11px] text-muted-foreground">{t("organization:exams.table.average")}</p>
                                </div>
                                <div className="rounded-xl border border-border/50 p-3 text-center">
                                    <Target className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                                    <p className="font-bold" dir="ltr">{formatNumber(selectedExam.PassRate, { maximumFractionDigits: 0 })}%</p>
                                    <p className="text-[11px] text-muted-foreground">{t("organization:exams.table.passRate")}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-semibold mb-2">{t("organization:exams.resultsTitle")}</p>
                                {resultsLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                ) : resultsError ? (
                                    <p className="text-sm text-destructive">{getApiError(resultsErrorObj, t("organization:exams.resultsLoadFailed"))}</p>
                                ) : results.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{t("organization:exams.noAttempts")}</p>
                                ) : (
                                    <ul className="divide-y divide-border/50 border border-border/50 rounded-xl overflow-hidden">
                                        {results.map((r) => (
                                            <li key={r.Id} className="px-4 py-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold">{r.TrainerName ?? t("common:deletedUser")}</p>
                                                    <p className="text-xs text-muted-foreground">{formatDateTime(r.TakenAt)}</p>
                                                </div>
                                                <Badge variant="outline" className={cn("text-xs font-semibold shrink-0", r.Passed ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : "text-destructive border-destructive/20 bg-destructive/5")}>
                                                    {formatNumber(r.Percentage)}%
                                                </Badge>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </OrganizationPageLayout>
    );
};

export default OrganizationExams;
