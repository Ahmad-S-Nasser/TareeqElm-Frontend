import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { getMasteryLevel, getMasteryColor, getMasteryTextColor } from "./types";

export function HeatmapLegend() {
    const { t } = useTranslation("learning");
    const { formatNumber, formatPercent } = useFormatters();
    const levels = [
        { min: 0, max: 0, level: "not-started" as const },
        { min: 1, max: 39, level: "struggling" as const },
        { min: 40, max: 59, level: "developing" as const },
        { min: 60, max: 79, level: "proficient" as const },
        { min: 80, max: 100, level: "mastered" as const },
    ];

    return (
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
            <span className="text-sm font-medium text-muted-foreground">{t("mastery.legend")}</span>
            {levels.map((item) => (
                <div key={item.level} className="flex items-center gap-2">
                    <div
                        className={`w-5 h-5 rounded ${getMasteryColor(item.level)}`}
                    />
                    <span className="text-xs text-muted-foreground">
                        {t(`mastery.levels.${item.level}`)} (<bdi>{item.min === item.max ? formatPercent(item.min) : `${formatNumber(item.min)}-${formatPercent(item.max)}`}</bdi>)
                    </span>
                </div>
            ))}
        </div>
    );
}
