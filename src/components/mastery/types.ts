export interface TrainerMastery {
    trainerId: string;
    trainerName: string;
    avatar?: string;
    topicScores: Record<string, TopicScore>;
    overallMastery: number;
    lastActive: Date;
}

export interface TopicScore {
    topicId: string;
    topicName: string;
    score: number; // 0-100
    questionsAttempted: number;
    questionsCorrect: number;
    trend: "improving" | "stable" | "declining";
    lastAttempt: Date;
}

export interface Topic {
    id: string;
    name: string;
    category: string;
    parentId?: string;
}

export type MasteryLevel =
    | "not-started"    // 0%
    | "struggling"     // 1-39%
    | "developing"     // 40-59%
    | "proficient"     // 60-79%
    | "mastered";      // 80-100%

export function getMasteryLevel(score: number | undefined): MasteryLevel {
    if (score === undefined || score === 0) return "not-started";
    if (score < 40) return "struggling";
    if (score < 60) return "developing";
    if (score < 80) return "proficient";
    return "mastered";
}

export function getMasteryColor(level: MasteryLevel): string {
    switch (level) {
        case "not-started": return "bg-muted/30";
        case "struggling": return "bg-red-500/70";
        case "developing": return "bg-amber-500/70";
        case "proficient": return "bg-emerald-400/70";
        case "mastered": return "bg-emerald-600";
    }
}

export function getMasteryTextColor(level: MasteryLevel): string {
    switch (level) {
        case "not-started": return "text-muted-foreground";
        case "struggling": return "text-white";
        case "developing": return "text-white";
        case "proficient": return "text-white";
        case "mastered": return "text-white";
    }
}
