import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CallRoom } from "coon-meeting-sdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import api, { getApiError } from "@/lib/api";
import type { JoinTokenResponseDto } from "@/lib/courseSessionTime";

interface JoinSessionButtonProps {
    courseId: string;
    sessionId: string;
}

export const JoinSessionButton = ({ courseId, sessionId }: JoinSessionButtonProps) => {
    const { t } = useTranslation(["organization", "common"]);
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [call, setCall] = useState<JoinTokenResponseDto | null>(null);

    const handleJoin = async () => {
        setLoading(true);
        try {
            const { data } = await api.post<JoinTokenResponseDto>(`/courses/${courseId}/sessions/${sessionId}/join-token`);
            if (data.Provider === "ManualLink") {
                if (data.ManualMeetingLink) window.open(data.ManualMeetingLink, "_blank", "noopener,noreferrer");
            } else {
                setCall(data);
            }
        } catch (err) {
            toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("sessions.meeting.joinFailed")) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button size="sm" onClick={handleJoin} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" /> : <Video className="w-3.5 h-3.5 me-1.5" />}
                {t("sessions.meeting.join")}
            </Button>

            {call && call.Provider === "CoonMeeting" && call.Token && call.ApiBaseUrl && call.MeetingId && (
                <Dialog open onOpenChange={(open) => !open && setCall(null)}>
                    <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
                        <CallRoom
                            apiBaseUrl={call.ApiBaseUrl}
                            meetingId={call.MeetingId}
                            participantToken={call.Token}
                            participantName={user?.FullName ?? t("sessions.meeting.participant")}
                            onLeave={() => setCall(null)}
                            // This pass has no recording-storage story — Coon Meeting never stores a recording itself either,
                            // it just hands the finished Blob back here, so there is nowhere to persist it to yet.
                            onRecordingAvailable={() => { /* no-op: nothing to persist to yet */ }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};
