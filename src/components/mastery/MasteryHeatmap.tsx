import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import {
    TrainerMastery,
    Topic,
    getMasteryLevel,
    getMasteryColor,
    getMasteryTextColor,
} from "./types";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, User } from "lucide-react";
import { HeatmapLegend } from "./HeatmapLegend";

interface MasteryHeatmapProps {
    trainers: TrainerMastery[];
    topics: Topic[];
    className?: string;
}

export function MasteryHeatmap({ trainers, topics, className }: MasteryHeatmapProps) {
    const { t } = useTranslation("learning");
    const { formatNumber, formatPercent, formatDate } = useFormatters();
    const getTrendIcon = (trend: "improving" | "stable" | "declining") => {
        switch (trend) {
            case "improving":
                return <TrendingUp className="w-3 h-3 text-success" />;
            case "declining":
                return <TrendingDown className="w-3 h-3 text-destructive" />;
            default:
                return <Minus className="w-3 h-3 text-muted-foreground" />;
        }
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Legend */}
            <HeatmapLegend />

            {/* Heatmap Grid */}
            <div className="rounded-2xl bg-card border border-border/50 shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        {/* Header Row - Topics */}
                        <thead>
                            <tr className="border-b border-border/50">
                                <th className="sticky start-0 bg-card z-10 px-4 py-3 text-start text-sm font-semibold min-w-[180px]">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        {t("mastery.trainer")}
                                    </div>
                                </th>
                                {topics.map((topic) => (
                                    <th
                                        key={topic.id}
                                        className="px-2 py-3 text-center text-xs font-medium text-muted-foreground min-w-[90px]"
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="truncate max-w-[80px]">{topic.name}</span>
                                            <span className="text-[10px] text-muted-foreground/60">
                                                {topic.category}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-center text-xs font-semibold bg-primary/5 min-w-[80px]">
                                    {t("mastery.overall")}
                                </th>
                            </tr>
                        </thead>

                        {/* Trainer Rows */}
                        <tbody>
                            {trainers.map((trainer, index) => (
                                <tr
                                    key={trainer.trainerId}
                                    className={cn(
                                        "border-b border-border/30 transition-colors hover:bg-muted/30",
                                        index % 2 === 0 && "bg-muted/10"
                                    )}
                                >
                                    {/* Trainer Name Cell */}
                                    <td className="sticky start-0 bg-card z-10 px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                                                {trainer.trainerName.split(" ").map((n) => n[0]).join("")}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{trainer.trainerName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {t("mastery.lastActive", { date: formatDate(trainer.lastActive) })}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Topic Score Cells */}
                                    {topics.map((topic) => {
                                        const score = trainer.topicScores[topic.id];
                                        const level = getMasteryLevel(score?.score);
                                        const colorClass = getMasteryColor(level);
                                        const textColorClass = getMasteryTextColor(level);

                                        return (
                                            <td key={topic.id} className="px-2 py-2 text-center">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            className={cn(
                                                                "mx-auto w-14 h-10 rounded-lg flex flex-col items-center justify-center cursor-default transition-transform hover:scale-105",
                                                                colorClass
                                                            )}
                                                        >
                                                            <span className={cn("text-sm font-bold", textColorClass)}>
                                                                {score ? formatNumber(score.score) : "-"}
                                                            </span>
                                                            {score && score.score > 0 && (
                                                                <div className="mt-0.5">{getTrendIcon(score.trend)}</div>
                                                            )}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="p-3 max-w-[200px]">
                                                        {score && score.score > 0 ? (
                                                            <div className="space-y-1">
                                                                <p className="font-semibold">{topic.name}</p>
                                                                <p className="text-xs">
                                                                    {t("mastery.score")} <span className="font-medium">{formatPercent(score.score)}</span>
                                                                </p>
                                                                <p className="text-xs">
                                                                    {t("mastery.progress", { correct: formatNumber(score.questionsCorrect), attempted: formatNumber(score.questionsAttempted) })}
                                                                </p>
                                                                <p className="text-xs flex items-center gap-1">
                                                                    {t("mastery.trend")} {getTrendIcon(score.trend)}{" "}
                                                                    <span>{t(`mastery.trends.${score.trend}`)}</span>
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs">{t("mastery.notStarted")}</p>
                                                        )}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </td>
                                        );
                                    })}

                                    {/* Overall Mastery Cell */}
                                    <td className="px-4 py-2 text-center bg-primary/5">
                                        <div
                                            className={cn(
                                                "mx-auto w-14 h-10 rounded-lg flex items-center justify-center font-bold",
                                                getMasteryColor(getMasteryLevel(trainer.overallMastery)),
                                                getMasteryTextColor(getMasteryLevel(trainer.overallMastery))
                                            )}
                                        >
                                            {formatPercent(trainer.overallMastery)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl bg-card border border-border/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t("mastery.totalTrainers")}</p>
                    <p className="text-2xl font-bold">{formatNumber(trainers.length)}</p>
                </div>
                <div className="rounded-xl bg-card border border-border/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t("mastery.avgMastery")}</p>
                    <p className="text-2xl font-bold">
                        {formatPercent(
                            trainers.reduce((sum, s) => sum + s.overallMastery, 0) / trainers.length
                        )}
                    </p>
                </div>
                <div className="rounded-xl bg-card border border-border/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t("mastery.struggling")}</p>
                    <p className="text-2xl font-bold text-destructive">
                        {formatNumber(trainers.filter((s) => s.overallMastery < 40).length)}
                    </p>
                </div>
                <div className="rounded-xl bg-card border border-border/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t("mastery.mastered")}</p>
                    <p className="text-2xl font-bold text-success">
                        {formatNumber(trainers.filter((s) => s.overallMastery >= 80).length)}
                    </p>
                </div>
            </div>
        </div>
    );
}
