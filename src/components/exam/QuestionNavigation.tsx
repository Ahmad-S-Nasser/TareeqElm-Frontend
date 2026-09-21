import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { Question, QuestionStatus } from "./types";
import { Flag, Check } from "lucide-react";

interface QuestionNavigationProps {
    questions: Question[];
    currentIndex: number;
    getQuestionStatus: (questionId: string, index: number) => QuestionStatus;
    onQuestionClick: (index: number) => void;
}

export function QuestionNavigation({
    questions,
    currentIndex,
    getQuestionStatus,
    onQuestionClick,
}: QuestionNavigationProps) {
    const { t } = useTranslation("quizzes");
    const { formatNumber } = useFormatters();
    const getStatusStyles = (status: QuestionStatus) => {
        switch (status) {
            case "current":
                return "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background shadow-glow-primary";
            case "answered":
                return "bg-success/20 text-success border-success/30 hover:bg-success/30";
            case "flagged":
                return "bg-warning/20 text-warning border-warning/30 hover:bg-warning/30";
            default:
                return "bg-muted/50 text-muted-foreground hover:bg-muted";
        }
    };

    const getStatusIcon = (status: QuestionStatus) => {
        if (status === "answered") {
            return <Check className="w-3 h-3 absolute -top-1 -end-1 bg-success text-white rounded-full p-0.5" />;
        }
        if (status === "flagged") {
            return <Flag className="w-3 h-3 absolute -top-1 -end-1 bg-warning text-white rounded-full p-0.5" />;
        }
        return null;
    };

    return (
        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {t("exam.navigator")}
            </h3>

            <div className="grid grid-cols-5 gap-2">
                {questions.map((question, index) => {
                    const status = getQuestionStatus(question.id, index);
                    return (
                        <button
                            key={question.id}
                            onClick={() => onQuestionClick(index)}
                            className={cn(
                                "relative w-10 h-10 rounded-xl border text-sm font-medium transition-all duration-200",
                                "hover:scale-105 active:scale-95",
                                getStatusStyles(status)
                            )}
                        >
                            {formatNumber(question.number)}
                            {getStatusIcon(status)}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-border/50">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-primary" />
                        <span className="text-muted-foreground">{t("exam.current")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-success/20 border border-success/30" />
                        <span className="text-muted-foreground">{t("exam.answered")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-warning/20 border border-warning/30" />
                        <span className="text-muted-foreground">{t("exam.flagged")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-muted/50" />
                        <span className="text-muted-foreground">{t("exam.unanswered")}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
