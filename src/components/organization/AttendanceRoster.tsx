import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api, { getApiError } from "@/lib/api";
import type { AttendanceRowDto } from "@/lib/courseSessionTime";

interface AttendanceRosterProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: string;
    sessionId: string;
}

const STATUSES: AttendanceRowDto["Status"][] = ["Present", "Absent", "Late", "Excused"];

const RosterRow = ({ courseId, sessionId, row }: { courseId: string; sessionId: string; row: AttendanceRowDto }) => {
    const { t } = useTranslation(["organization", "common"]);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const mark = useMutation({
        mutationFn: async (status: string) => {
            await api.post(`/courses/${courseId}/sessions/${sessionId}/attendance`, { trainerId: row.TrainerId, status });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session-attendance-roster", courseId, sessionId] }),
        onError: (err: unknown) => toast({
            variant: "destructive", title: t("common:states.error"),
            description: getApiError(err, t("sessions.attendance.markFailed")),
        }),
    });

    return (
        <div className="flex items-center justify-between gap-3 p-3 rounded-md border">
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{row.TrainerName ?? t("common:deletedUser")}</span>
                {row.Source && (
                    <Badge variant="outline" className="text-xs shrink-0">
                        {row.Source === "CoonMeetingWebhook" ? t("sessions.attendance.sourceAuto") : t("sessions.attendance.sourceManual")}
                    </Badge>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {mark.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <Select value={row.Status ?? ""} onValueChange={(v) => mark.mutate(v)}>
                    <SelectTrigger className="w-32"><SelectValue placeholder={t("sessions.attendance.unmarked")} /></SelectTrigger>
                    <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s!}>{t(`sessions.attendance.status.${s!.toLowerCase()}`)}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
};

export const AttendanceRoster = ({ open, onOpenChange, courseId, sessionId }: AttendanceRosterProps) => {
    const { t } = useTranslation(["organization", "common"]);

    const { data: roster = [], isLoading, isError, error } = useQuery({
        queryKey: ["session-attendance-roster", courseId, sessionId],
        enabled: open,
        queryFn: async () => (await api.get<AttendanceRowDto[]>(`/courses/${courseId}/sessions/${sessionId}/attendance`)).data,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t("sessions.attendance.title")}</DialogTitle>
                    <DialogDescription>{t("sessions.attendance.subtitle")}</DialogDescription>
                </DialogHeader>
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : isError ? (
                    <p className="text-center text-destructive py-8">{getApiError(error, t("sessions.attendance.loadFailed"))}</p>
                ) : roster.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{t("sessions.attendance.empty")}</p>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {roster.map((row) => <RosterRow key={row.TrainerId} courseId={courseId} sessionId={sessionId} row={row} />)}
                    </div>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.close")}</Button>
            </DialogContent>
        </Dialog>
    );
};
