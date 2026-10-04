import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addMinutes } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import api, { getApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { SessionScheduler } from "@/components/organization/SessionScheduler";
import { type CourseSessionDto } from "@/lib/courseSessionTime";

interface CourseSummary { Id: string; Title: string }

const locales = { en: undefined, ar: undefined };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date()), getDay, locales });

const OrganizationCalendar = () => {
    const { t, i18n } = useTranslation(["organization", "common"]);
    const { toast } = useToast();
    const [range, setRange] = useState<{ from: Date; to: Date }>(() => {
        const now = new Date();
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    });
    const [schedulerOpen, setSchedulerOpen] = useState(false);
    const [editingSession, setEditingSession] = useState<CourseSessionDto | null>(null);

    const { data: courses = [] } = useQuery({
        queryKey: ["organization-calendar-courses"],
        queryFn: async () => (await api.get<CourseSummary[]>("/Courses", { params: { pageSize: 100 } })).data,
    });

    const { data: sessions = [], isLoading, isError, error, refetch } = useQuery({
        queryKey: ["organization-calendar", range.from.toISOString(), range.to.toISOString()],
        queryFn: async () => (await api.get<CourseSessionDto[]>("/organization/calendar", {
            params: { from: range.from.toISOString(), to: range.to.toISOString() },
        })).data,
    });

    const events = useMemo(() => sessions.map((s) => ({
        id: s.Id,
        title: `${s.LessonTitle ?? t("common:deletedEntity")}${s.Status === "Cancelled" ? ` (${t("sessions.status.cancelled")})` : ""}`,
        start: new Date(s.StartsAt),
        end: addMinutes(new Date(s.StartsAt), s.DurationMinutes),
        resource: s,
    })), [sessions, t]);

    const handleRangeChange = (r: Date[] | { start: Date; end: Date }) => {
        if (Array.isArray(r)) {
            if (r.length === 0) return;
            setRange({ from: r[0], to: addMinutes(r[r.length - 1], 24 * 60) });
        } else {
            setRange({ from: r.start, to: r.end });
        }
    };

    const handleCancelSession = async (session: CourseSessionDto) => {
        if (!window.confirm(t("sessions.confirmCancelSession"))) return;
        try {
            await api.post(`/courses/${session.CourseId}/sessions/${session.Id}/cancel`);
            toast({ title: t("sessions.cancelled") });
            setSchedulerOpen(false);
            refetch();
        } catch (err) {
            toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("sessions.cancelFailed")) });
        }
    };

    return (
        <OrganizationPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <CalendarClock className="w-5 h-5 text-primary" />
                        </div>
                        {t("sessions.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("sessions.subtitle")}</p>
                </div>
                <Button className="gap-2" onClick={() => { setEditingSession(null); setSchedulerOpen(true); }}>
                    <Plus className="w-4 h-4" /> {t("sessions.newSession")}
                </Button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, t("sessions.loadFailed"))}</CardContent></Card>
            ) : (
                <Card className="border-border/50">
                    <CardContent className="p-4">
                        <div style={{ height: 720 }}>
                            <BigCalendar
                                localizer={localizer}
                                events={events}
                                startAccessor="start"
                                endAccessor="end"
                                rtl={i18n.dir() === "rtl"}
                                onRangeChange={handleRangeChange}
                                onSelectEvent={(event) => { setEditingSession(event.resource); setSchedulerOpen(true); }}
                                messages={{
                                    today: t("sessions.calendar.today"), previous: t("sessions.calendar.previous"), next: t("sessions.calendar.next"),
                                    month: t("sessions.calendar.month"), week: t("sessions.calendar.week"), day: t("sessions.calendar.day"),
                                    agenda: t("sessions.calendar.agenda"), date: t("sessions.calendar.date"), time: t("sessions.calendar.time"),
                                    event: t("sessions.calendar.event"), noEventsInRange: t("sessions.calendar.noEventsInRange"),
                                    showMore: (count: number) => t("sessions.calendar.showMore", { count }),
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            <SessionScheduler
                open={schedulerOpen}
                onOpenChange={(nextOpen) => { setSchedulerOpen(nextOpen); if (!nextOpen) setEditingSession(null); }}
                courses={courses}
                existing={editingSession}
                onSaved={() => refetch()}
                onCancelSession={handleCancelSession}
            />
        </OrganizationPageLayout>
    );
};

export default OrganizationCalendar;
