import { Question } from "./types";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

interface QuestionCardProps {
    question: Question;
    selectedAnswer: string | undefined;
    isFlagged: boolean;
    onSelectAnswer: (optionId: string) => void;
    onToggleFlag: () => void;
    onPrevious: () => void;
    onNext: () => void;
    isFirst: boolean;
    isLast: boolean;
    totalQuestions: number;
}

export function QuestionCard({
    question,
    selectedAnswer,
    isFlagged,
    onSelectAnswer,
    onToggleFlag,
    onPrevious,
    onNext,
    isFirst,
    isLast,
    totalQuestions,
}: QuestionCardProps) {
    const { t } = useTranslation(["quizzes", "common"]);
    const { formatNumber } = useFormatters();
    return (
        <div className="rounded-2xl bg-card border border-border/50 shadow-soft overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                        {t("exam.questionOf", { number: formatNumber(question.number), total: formatNumber(totalQuestions) })}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs">
                        {question.topic}
                    </span>
                </div>
                <Button
                    variant={isFlagged ? "default" : "outline"}
                    size="sm"
                    onClick={onToggleFlag}
                    className={cn(
                        "gap-2 transition-all",
                        isFlagged && "bg-warning hover:bg-warning/90 text-warning-foreground"
                    )}
                >
                    <Flag className="w-4 h-4" />
                    {isFlagged ? t("exam.flagged") : t("exam.flagForReview")}
                </Button>
            </div>

            {/* Question Text */}
            <div className="p-6">
                <p className="text-lg font-medium leading-relaxed mb-6">
                    {question.text}
                </p>

                {/* Options */}
                <RadioGroup
                    value={selectedAnswer}
                    onValueChange={onSelectAnswer}
                    className="space-y-3"
                >
                    {question.options.map((option) => (
                        <Label
                            key={option.id}
                            htmlFor={option.id}
                            className={cn(
                                "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                                "hover:bg-muted/50 hover:border-primary/30",
                                selectedAnswer === option.id
                                    ? "border-primary bg-primary/5 shadow-soft"
                                    : "border-border/50"
                            )}
                        >
                            <RadioGroupItem value={option.id} id={option.id} className="mt-0.5" />
                            <div className="flex items-start gap-3 flex-1">
                                <span
                                    className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                                        selectedAnswer === option.id
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    {option.label}
                                </span>
                                <span className="text-sm leading-relaxed pt-1">{option.text}</span>
                            </div>
                        </Label>
                    ))}
                </RadioGroup>
            </div>

            {/* Navigation Footer */}
            <div className="p-4 border-t border-border/50 bg-muted/30 flex items-center justify-between">
                <Button
                    variant="outline"
                    onClick={onPrevious}
                    disabled={isFirst}
                    className="gap-2"
                >
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                    {t("common:actions.previous")}
                </Button>
                <Button
                    variant={isLast ? "gradient" : "default"}
                    onClick={onNext}
                    className="gap-2"
                >
                    {isLast ? t("exam.reviewAnswers") : t("common:actions.next")}
                    {!isLast && <ChevronRight className="w-4 h-4 rtl:rotate-180" />}
                </Button>
            </div>
        </div>
    );
}
