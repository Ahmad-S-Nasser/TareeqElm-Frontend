import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api, { getApiError } from "@/lib/api";
import { type CourseSessionDto, TIME_ZONES, zonedInputToUtcIso, utcIsoToZonedInput } from "@/lib/courseSessionTime";
import { AttendanceRoster } from "@/components/organization/AttendanceRoster";

interface CurriculumLesson { Id: string; Title: string; DeliveryMode?: string }
interface CurriculumChapter { Id: string; Title: string; Lessons: CurriculumLesson[] }
interface BuildingSummary { Id: string; Name: string; RoomsCount: number }
interface RoomSummary { Id: string; BuildingId: string; Name: string }

interface SessionSchedulerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courses: { Id: string; Title: string }[];
    defaultCourseId?: string;
    existing?: CourseSessionDto | null;
    onSaved: () => void;
    onCancelSession?: (session: CourseSessionDto) => void;
}

const EMPTY_FORM = {
    courseId: "", lessonId: "", startsAt: "", durationMinutes: 60, timeZone: "UTC",
    roomId: "", locationNote: "", meetingProvider: "ManualLink" as "ManualLink" | "CoonMeeting", manualMeetingLink: "",
};

export const SessionScheduler = ({ open, onOpenChange, courses, defaultCourseId, existing, onSaved, onCancelSession }: SessionSchedulerProps) => {
    const { t } = useTranslation(["organization", "common"]);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(EMPTY_FORM);
    const [attendanceOpen, setAttendanceOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (existing) {
            setForm({
                courseId: existing.CourseId, lessonId: existing.LessonId,
                startsAt: utcIsoToZonedInput(existing.StartsAt, existing.TimeZone), durationMinutes: existing.DurationMinutes, timeZone: existing.TimeZone,
                roomId: existing.RoomId ?? "", locationNote: existing.LocationNote ?? "",
                meetingProvider: existing.MeetingProvider === "CoonMeeting" ? "CoonMeeting" : "ManualLink", manualMeetingLink: existing.ManualMeetingLink ?? "",
            });
        } else {
            setForm({ ...EMPTY_FORM, courseId: defaultCourseId ?? "" });
        }
    }, [open, existing, defaultCourseId]);

    const { data: curriculum = [] } = useQuery({
        queryKey: ["session-scheduler-curriculum", form.courseId],
        enabled: !!form.courseId,
        queryFn: async () => (await api.get<CurriculumChapter[]>(`/Courses/${form.courseId}/curriculum`)).data,
    });
    const schedulableLessons = curriculum.flatMap((c) =>
        c.Lessons.filter((l) => l.DeliveryMode && l.DeliveryMode !== "PreRecorded").map((l) => ({ ...l, chapterTitle: c.Title })));
    const selectedLesson = schedulableLessons.find((l) => l.Id === form.lessonId);
    const deliveryMode = selectedLesson?.DeliveryMode ?? existing?.DeliveryMode;

    const { data: rooms = [] } = useQuery({
        queryKey: ["session-scheduler-rooms"],
        enabled: deliveryMode === "Offline",
        queryFn: async () => {
            const buildings = (await api.get<BuildingSummary[]>("/facilities/buildings")).data;
            const perBuilding = await Promise.all(buildings.map((b) => api.get<RoomSummary[]>(`/facilities/buildings/${b.Id}/rooms`)));
            return buildings.flatMap((b, i) => perBuilding[i].data.map((r) => ({ ...r, buildingName: b.Name })));
        },
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            const body = {
                lessonId: form.lessonId, startsAt: zonedInputToUtcIso(form.startsAt, form.timeZone),
                durationMinutes: form.durationMinutes, timeZone: form.timeZone,
                roomId: deliveryMode === "Offline" ? form.roomId || null : null,
                locationNote: form.locationNote || null,
                meetingProvider: form.meetingProvider,
                manualMeetingLink: form.meetingProvider === "ManualLink" ? form.manualMeetingLink || null : null,
            };
            if (existing) await api.put(`/courses/${form.courseId}/sessions/${existing.Id}`, body);
            else await api.post(`/courses/${form.courseId}/sessions`, body);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["organization-calendar"] });
            toast({ title: existing ? t("sessions.updated") : t("sessions.created") });
            onSaved();
            onOpenChange(false);
        },
        onError: (err: unknown) => toast({
            variant: "destructive", title: t("common:states.error"),
            description: getApiError(err, existing ? t("sessions.updateFailed") : t("sessions.createFailed")),
        }),
    });

    const canSave = !!form.courseId && !!form.lessonId && !!form.startsAt && form.durationMinutes > 0 &&
        (deliveryMode !== "Offline" || !!form.roomId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{existing ? t("sessions.editSession") : t("sessions.newSession")}</DialogTitle>
                    <DialogDescription>{t("sessions.subtitle")}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label>{t("sessions.course")}</Label>
                        <Select value={form.courseId} onValueChange={(v) => setForm({ ...form, courseId: v, lessonId: "" })} disabled={!!existing}>
                            <SelectTrigger><SelectValue placeholder={t("sessions.selectCourse")} /></SelectTrigger>
                            <SelectContent>
                                {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>{t("sessions.lesson")}</Label>
                        <Select value={form.lessonId} onValueChange={(v) => setForm({ ...form, lessonId: v })} disabled={!form.courseId}>
                            <SelectTrigger><SelectValue placeholder={t("sessions.selectLesson")} /></SelectTrigger>
                            <SelectContent>
                                {schedulableLessons.map((l) => <SelectItem key={l.Id} value={l.Id}>{l.chapterTitle} — {l.Title}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {form.courseId && schedulableLessons.length === 0 && (
                            <p className="text-xs text-muted-foreground">{t("sessions.noSchedulableLessons")}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="session-starts-at">{t("sessions.startsAt")}</Label>
                            <Input id="session-starts-at" type="datetime-local" value={form.startsAt}
                                onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="session-duration">{t("sessions.durationMinutes")}</Label>
                            <Input id="session-duration" type="number" min={1} value={form.durationMinutes}
                                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>{t("sessions.timeZone")}</Label>
                        <Select value={form.timeZone} onValueChange={(v) => setForm({ ...form, timeZone: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {TIME_ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {deliveryMode === "Offline" && (
                        <div className="grid gap-2">
                            <Label>{t("sessions.room")}</Label>
                            <Select value={form.roomId} onValueChange={(v) => setForm({ ...form, roomId: v })}>
                                <SelectTrigger><SelectValue placeholder={t("sessions.selectRoom")} /></SelectTrigger>
                                <SelectContent>
                                    {rooms.map((r) => <SelectItem key={r.Id} value={r.Id}>{r.buildingName} / {r.Name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Input value={form.locationNote} onChange={(e) => setForm({ ...form, locationNote: e.target.value })}
                                placeholder={t("sessions.locationNotePlaceholder")} />
                        </div>
                    )}

                    {deliveryMode === "LiveOnline" && (
                        <div className="grid gap-2">
                            <Label>{t("sessions.meetingProvider")}</Label>
                            <Select value={form.meetingProvider} onValueChange={(v) => setForm({ ...form, meetingProvider: v as "ManualLink" | "CoonMeeting" })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ManualLink">{t("sessions.providerOptions.manualLink")}</SelectItem>
                                    <SelectItem value="CoonMeeting">{t("sessions.providerOptions.coonMeeting")}</SelectItem>
                                </SelectContent>
                            </Select>
                            {form.meetingProvider === "ManualLink" && (
                                <Input dir="ltr" value={form.manualMeetingLink} onChange={(e) => setForm({ ...form, manualMeetingLink: e.target.value })}
                                    placeholder={t("sessions.manualLinkPlaceholder")} />
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter className="sm:justify-between">
                    <div className="flex gap-2">
                        {existing && (
                            <Button variant="ghost" onClick={() => setAttendanceOpen(true)}>{t("sessions.viewAttendance")}</Button>
                        )}
                        {existing && existing.Status === "Scheduled" && onCancelSession && (
                            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onCancelSession(existing)}>
                                {t("sessions.cancelSession")}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
                            {saveMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {existing ? t("sessions.updateSession") : t("sessions.createSession")}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
            {existing && (
                <AttendanceRoster open={attendanceOpen} onOpenChange={setAttendanceOpen} courseId={existing.CourseId} sessionId={existing.Id} />
            )}
        </Dialog>
    );
};
