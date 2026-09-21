import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ExamTimerProps {
    formattedTime: string;
    percentageRemaining: number;
    urgencyLevel: "normal" | "warning" | "critical";
    isPaused: boolean;
}

export function ExamTimer({
    formattedTime,
    percentageRemaining,
    urgencyLevel,
    isPaused,
}: ExamTimerProps) {
    const { t } = useTranslation("quizzes");
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - percentageRemaining / 100);

    const getColors = () => {
        switch (urgencyLevel) {
            case "critical":
                return {
                    stroke: "stroke-destructive",
                    text: "text-destructive",
                    bg: "bg-destructive/10",
                    glow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]",
                };
            case "warning":
                return {
                    stroke: "stroke-warning",
                    text: "text-warning",
                    bg: "bg-warning/10",
                    glow: "shadow-[0_0_20px_rgba(234,179,8,0.4)]",
                };
            default:
                return {
                    stroke: "stroke-primary",
                    text: "text-primary",
                    bg: "bg-primary/10",
                    glow: "shadow-[0_0_20px_rgba(59,130,246,0.3)]",
                };
        }
    };

    const colors = getColors();

    return (
        <div
            className={cn(
                "relative flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300",
                colors.bg,
                colors.glow,
                urgencyLevel === "critical" && "animate-pulse"
            )}
        >
            <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    {/* Background circle */}
                    <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-muted/20"
                    />
                    {/* Progress circle */}
                    <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        strokeWidth="8"
                        strokeLinecap="round"
                        className={cn(colors.stroke, "transition-all duration-1000 ease-linear")}
                        style={{
                            strokeDasharray: circumference,
                            strokeDashoffset: strokeDashoffset,
                        }}
                    />
                </svg>
                {/* Time display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                        dir="ltr"
                        className={cn(
                            "text-2xl font-bold tabular-nums tracking-tight",
                            colors.text
                        )}
                    >
                        {formattedTime}
                    </span>
                    {isPaused && (
                        <span className="text-xs text-muted-foreground font-medium mt-1">
                            {t("exam.paused")}
                        </span>
                    )}
                </div>
            </div>
            <span className="text-xs text-muted-foreground mt-2 font-medium">
                {t("exam.timeRemaining")}
            </span>
        </div>
    );
}
