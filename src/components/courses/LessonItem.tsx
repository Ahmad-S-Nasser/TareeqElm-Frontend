import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { Lesson, LessonType } from "./courseChapters";
import {
    PlayCircle,
    FileText,
    HelpCircle,
    PenTool,
    Layers,
    CheckCircle,
    Lock,
    Clock
} from "lucide-react";

interface LessonItemProps {
    lesson: Lesson;
    onClick?: () => void;
}

export function LessonItem({ lesson, onClick }: LessonItemProps) {
    const { t } = useTranslation("courses");
    const { formatNumber } = useFormatters();
    const getTypeIcon = (type: LessonType) => {
        switch (type) {
            case "video": return PlayCircle;
            case "reading": return FileText;
            case "quiz": return HelpCircle;
            case "exercise": return PenTool;
            case "flashcards": return Layers;
            default: return FileText;
        }
    };

    const getTypeLabel = (type: LessonType) => {
        return t(`lessonType.${type}`, { defaultValue: type });
    };

    const getTypeColor = (type: LessonType) => {
        switch (type) {
            case "video": return "text-primary bg-primary/10";
            case "reading": return "text-success bg-success/10";
            case "quiz": return "text-warning bg-warning/10";
            case "exercise": return "text-accent bg-accent/10";
            case "flashcards": return "text-pink-500 bg-pink-500/10";
            default: return "text-muted-foreground bg-muted";
        }
    };

    const Icon = getTypeIcon(lesson.Type);

    return (
        <button
            onClick={onClick}
            disabled={lesson.IsLocked}
            className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-all text-start",
                "hover:bg-muted/50 group",
                lesson.IsLocked && "opacity-50 cursor-not-allowed",
                lesson.IsCompleted && "bg-success/5"
            )}
        >
            {/* Lesson Number & Status */}
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                lesson.IsCompleted
                    ? "bg-success text-white"
                    : lesson.IsLocked
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
            )}>
                {lesson.IsCompleted ? (
                    <CheckCircle className="w-4 h-4" />
                ) : lesson.IsLocked ? (
                    <Lock className="w-4 h-4" />
                ) : (
                    formatNumber(lesson.Number)
                )}
            </div>

            {/* Lesson Info */}
            <div className="flex-1 min-w-0">
                <h4 className={cn(
                    "font-medium text-sm truncate group-hover:text-primary transition-colors",
                    lesson.IsCompleted && "text-muted-foreground"
                )}>
                    {lesson.Title}
                </h4>
                <div className="flex items-center gap-3 mt-1">
                    <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
                        getTypeColor(lesson.Type)
                    )}>
                        <Icon className="w-3 h-3" />
                        {getTypeLabel(lesson.Type)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {lesson.Duration}
                    </span>
                </div>
            </div>

            {/* Play/View Icon */}
            {!lesson.IsLocked && !lesson.IsCompleted && (
                <PlayCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            )}
        </button>
    );
}
