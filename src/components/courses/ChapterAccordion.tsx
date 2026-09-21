import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { Chapter } from "./courseChapters";
import { LessonItem } from "./LessonItem";
import {
    ChevronDown,
    CheckCircle,
    Lock,
    Clock,
    BookOpen
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ChapterAccordionProps {
    chapter: Chapter;
    isOpen?: boolean;
    onToggle?: () => void;
    onLessonClick?: (lessonId: string) => void;
}

export function ChapterAccordion({
    chapter,
    isOpen = false,
    onToggle,
    onLessonClick
}: ChapterAccordionProps) {
    const { t } = useTranslation("courses");
    const { formatNumber } = useFormatters();
    const completedLessons = chapter.Lessons.filter(l => l.IsCompleted).length;
    const totalLessons = chapter.Lessons.length;
    const progressPercent = (completedLessons / totalLessons) * 100;

    return (
        <div className={cn(
            "rounded-2xl border border-border/50 overflow-hidden transition-all",
            isOpen ? "bg-card shadow-soft" : "bg-card/50 hover:bg-card",
            chapter.IsLocked && "opacity-60"
        )}>
            {/* Chapter Header */}
            <button
                onClick={onToggle}
                disabled={chapter.IsLocked}
                className="w-full flex items-center gap-4 p-5 text-start"
            >
                {/* Chapter Number */}
                <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0",
                    chapter.IsCompleted
                        ? "bg-success text-white"
                        : chapter.IsLocked
                            ? "bg-muted text-muted-foreground"
                            : "gradient-primary text-white"
                )}>
                    {chapter.IsCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                    ) : chapter.IsLocked ? (
                        <Lock className="w-5 h-5" />
                    ) : (
                        formatNumber(chapter.Number)
                    )}
                </div>

                {/* Chapter Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg truncate">
                            {chapter.Title}
                        </h3>
                        {chapter.IsCompleted && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-success/10 text-success font-medium">
                                {t("chapter.completed")}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                        {chapter.Description}
                    </p>

                    {/* Meta & Progress */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                {t("lessonsCount", { count: totalLessons })}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {chapter.Duration}
                            </span>
                        </div>
                        {!chapter.IsLocked && (
                            <div className="flex items-center gap-2 flex-1 max-w-[150px]">
                                <Progress value={progressPercent} className="h-1.5" />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    <bdi>{formatNumber(completedLessons)}/{formatNumber(totalLessons)}</bdi>
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Expand Icon */}
                <ChevronDown className={cn(
                    "w-5 h-5 text-muted-foreground transition-transform shrink-0",
                    isOpen && "rotate-180"
                )} />
            </button>

            {/* Lessons List */}
            {isOpen && !chapter.IsLocked && (
                <div className="border-t border-border/50 p-2 bg-muted/20">
                    <div className="space-y-1">
                        {chapter.Lessons.map((lesson) => (
                            <LessonItem
                                key={lesson.Id}
                                lesson={lesson}
                                onClick={() => onLessonClick?.(lesson.Id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
