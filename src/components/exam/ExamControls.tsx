import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useFormatters } from "@/lib/format";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pause, Play, Send, Flag } from "lucide-react";

interface ExamControlsProps {
    isPaused: boolean;
    answeredCount: number;
    flaggedCount: number;
    totalQuestions: number;
    onPause: () => void;
    onResume: () => void;
    onSubmit: () => void;
    onReviewFlagged: () => void;
}

export function ExamControls({
    isPaused,
    answeredCount,
    flaggedCount,
    totalQuestions,
    onPause,
    onResume,
    onSubmit,
    onReviewFlagged,
}: ExamControlsProps) {
    const { t } = useTranslation("quizzes");
    const { formatNumber } = useFormatters();
    const unansweredCount = totalQuestions - answeredCount;

    return (
        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4 space-y-3">
            <h3 className="text-sm font-semibold mb-3">{t("exam.controls")}</h3>

            {/* Pause/Resume Button */}
            <Button
                variant="outline"
                className="w-full gap-2"
                onClick={isPaused ? onResume : onPause}
            >
                {isPaused ? (
                    <>
                        <Play className="w-4 h-4" />
                        {t("exam.resume")}
                    </>
                ) : (
                    <>
                        <Pause className="w-4 h-4" />
                        {t("exam.pause")}
                    </>
                )}
            </Button>

            {/* Review Flagged Button */}
            {flaggedCount > 0 && (
                <Button
                    variant="outline"
                    className="w-full gap-2 border-warning/50 text-warning hover:bg-warning/10"
                    onClick={onReviewFlagged}
                >
                    <Flag className="w-4 h-4" />
                    {t("exam.reviewFlagged", { count: formatNumber(flaggedCount) })}
                </Button>
            )}

            {/* Submit Button with Confirmation */}
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="gradient" className="w-full gap-2">
                        <Send className="w-4 h-4" />
                        {t("exam.submit")}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("exam.submitTitle")}</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                            <p>{t("exam.submitConfirm")}</p>
                            <div className="rounded-lg bg-muted p-3 space-y-1">
                                <p className="text-sm">
                                    <span className="font-medium text-success">{t("exam.answered")}:</span>{" "}
                                    <bdi>{formatNumber(answeredCount)} / {formatNumber(totalQuestions)}</bdi>
                                </p>
                                {unansweredCount > 0 && (
                                    <p className="text-sm text-warning">
                                        ⚠️ {t("exam.unansweredWarning", { count: unansweredCount })}
                                    </p>
                                )}
                                {flaggedCount > 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        📌 {t("exam.flaggedNote", { count: flaggedCount })}
                                    </p>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t("exam.cannotUndo")}
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("exam.continue")}</AlertDialogCancel>
                        <AlertDialogAction onClick={onSubmit} className="bg-primary">
                            {t("exam.submit")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
