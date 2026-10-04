import { BookOpen, Clock, Star, Users, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/billing";
import { Course, isPaidCourse } from "./types";

interface CourseCardEnhancedProps {
    course: Course;
    variant?: "default" | "featured" | "compact";
    onClick?: () => void;
}

export function CourseCardEnhanced({
    course,
    variant = "default",
    onClick,
}: CourseCardEnhancedProps) {
    const { t } = useTranslation("courses");
    const { formatNumber, formatPercent } = useFormatters();
    // A free course keeps its pre-monetization look: no price, no badge, nothing extra on the card.
    const isPaid = isPaidCourse(course.accessModel, course.pricing);
    const getLevelColor = (level: string) => {
        switch (level) {
            case "beginner": return "bg-success/10 text-success border-success/20";
            case "intermediate": return "bg-warning/10 text-warning border-warning/20";
            case "advanced": return "bg-destructive/10 text-destructive border-destructive/20";
            default: return "bg-muted text-muted-foreground";
        }
    };

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative overflow-hidden rounded-2xl bg-card border border-border/50 shadow-soft transition-all duration-300 hover:shadow-elevated hover:-translate-y-1 cursor-pointer",
                variant === "featured" && "md:col-span-2 lg:col-span-2"
            )}
        >
            {/* Image/Gradient Header */}
            <div className={cn(
                "relative h-36 overflow-hidden",
                variant === "featured" && "h-48"
            )}>
                {course.image ? (
                    <img
                        src={course.image}
                        alt={course.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className={cn(
                        "w-full h-full",
                        course.category === "languages" && "gradient-primary",
                        course.category === "technology" && "gradient-accent",
                        course.category === "business" && "gradient-success",
                        course.category === "science" && "bg-gradient-to-br from-cyan-500 to-blue-600",
                        course.category === "mathematics" && "bg-gradient-to-br from-indigo-500 to-violet-600",
                        course.category === "arts-humanities" && "bg-gradient-to-br from-pink-500 to-rose-600",
                        course.category === "professional-development" && "bg-gradient-to-br from-amber-500 to-orange-600",
                        course.category === "test-prep" && "bg-gradient-to-br from-teal-500 to-emerald-600",
                        course.category === "other" && "bg-gradient-to-br from-slate-500 to-slate-600",
                    )} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />

                {/* Badges */}
                <div className="absolute top-3 start-3 flex gap-2">
                    {course.isNew && (
                        <Badge className="bg-success text-white border-0 gap-1">
                            <Sparkles className="w-3 h-3" />
                            {t("card.new")}
                        </Badge>
                    )}
                    {course.isFeatured && (
                        <Badge className="bg-primary text-white border-0">{t("card.featured")}</Badge>
                    )}
                </div>

                {/* Progress Badge */}
                {course.progress > 0 && (
                    <div className="absolute top-3 end-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full glass text-xs font-medium">
                        {t("card.percentComplete", { percent: formatPercent(course.progress) })}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-5">
                {/* Level & Rating */}
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className={cn("text-xs", getLevelColor(course.level))}>
                            {t(`level.${course.level}`, { defaultValue: course.level })}
                        </Badge>
                        {isPaid && (
                            <PriceTag
                                pricing={course.pricing}
                                owned={course.owned}
                                size="sm"
                                showFree={false}
                                hideSaleBadge
                                className="shrink-0"
                            />
                        )}
                    </div>
                    {course.rating > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                            <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                            <span className="font-medium">{formatNumber(course.rating)}</span>
                            <span className="text-muted-foreground">({formatNumber(course.trainersEnrolled)})</span>
                        </div>
                    )}
                </div>

                <h3 className="font-semibold text-lg text-foreground mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                    {course.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {course.description}
                </p>

                {/* Progress Bar */}
                {course.progress > 0 && (
                    <div className="mb-4">
                        <Progress value={course.progress} className="h-2" />
                    </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {course.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground">
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{t("lessonsCount", { count: course.lessons })}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{course.durationHours !== undefined ? t("hoursCount", { count: course.durationHours }) : course.duration}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>{formatNumber(course.trainersEnrolled)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
