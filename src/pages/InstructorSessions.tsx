import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { InstructorPageLayout } from "@/components/instructor/InstructorPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import api, { getApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useFormatters } from "@/lib/format";
import { useMyCoursesQuery } from "@/hooks/useCourses";
import { SessionScheduler } from "@/components/organization/SessionScheduler";
import { type CourseSessionDto } from "@/lib/courseSessionTime";

const statusBadgeClass: Record<string, string> = {
    Scheduled: "text-primary border-primary/20 bg-primary/5",
    Cancelled: "text-muted-foreground border-border bg-muted",
    Completed: "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20",
};

const InstructorSessions = () => {
    const { t } = useTranslation(["organization", "instructor", "common"]);
    const { user } = useAuth();
    const { formatDateTime } = useFormatters();
    const { data: courses = [] } = useMyCoursesQuery();
    const [schedulerOpen, setSchedulerOpen] = useState(false);
    const [editingSession, setEditingSession] = useState<CourseSessionDto | null>(null);

    const range = useMemo(() => {
        const now = new Date();
        return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) };
    }, []);

    const { data: sessions = [], isLoading, isError, error, refetch } = useQuery({
        queryKey: ["instructor-sessions", range.from.toISOString(), range.to.toISOString()],
        queryFn: async () => (await api.get<CourseSessionDto[]>("/organization/calendar", {
            params: { from: range.from.toISOString(), to: range.to.toISOString() },
        })).data,
    });

    const mine = sessions.filter((s) => s.InstructorId === user?.Id).sort((a, b) => a.StartsAt.localeCompare(b.StartsAt));

    return (
        <InstructorPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <CalendarClock className="w-6 h-6 text-primary" />
                        {t("instructor:sessions.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("instructor:sessions.subtitle")}</p>
                </div>
                <Button className="gap-2" onClick={() => { setEditingSession(null); setSchedulerOpen(true); }}>
                    <Plus className="w-4 h-4" /> {t("sessions.newSession")}
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, t("sessions.loadFailed"))}</CardContent></Card>
            ) : mine.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">{t("instructor:sessions.empty")}</CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {mine.map((s) => (
                        <Card key={s.Id} className="border-border/50">
                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm">{s.LessonTitle ?? t("common:deletedEntity")}</span>
                                        <Badge variant="outline" className={statusBadgeClass[s.Status]}>{t(`sessions.status.${s.Status.toLowerCase()}`)}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(s.StartsAt, { dateStyle: "medium", timeStyle: "short", timeZone: s.TimeZone })}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => { setEditingSession(s); setSchedulerOpen(true); }}>
                                    {t("instructor:sessions.manage")}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <SessionScheduler
                open={schedulerOpen}
                onOpenChange={(open) => { setSchedulerOpen(open); if (!open) setEditingSession(null); }}
                courses={courses}
                existing={editingSession}
                onSaved={() => refetch()}
                onCancelSession={async (session) => {
                    await api.post(`/courses/${session.CourseId}/sessions/${session.Id}/cancel`);
                    setSchedulerOpen(false);
                    refetch();
                }}
            />
        </InstructorPageLayout>
    );
};

export default InstructorSessions;
