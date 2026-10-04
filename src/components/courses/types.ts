import type { PricingDto } from "@/hooks/useBilling";

export interface Course {
    id: string;
    title: string;
    description: string;
    progress: number;
    duration: string;
    /** Numeric duration; when set the card formats it per language instead of `duration`. */
    durationHours?: number;
    lessons: number;
    category: CourseCategory;
    level: CourseLevel;
    instructor: string;
    rating: number;
    trainersEnrolled: number;
    tags: string[];
    image?: string;
    isFeatured?: boolean;
    isNew?: boolean;
    lastAccessed?: Date;
    startDate?: string;
    endDate?: string;
    attachmentUrl?: string; // URL to PDF/File
    /** `CourseSummaryDto.AccessModel` — `Free | Subscription | AlaCarte`. Absent on locally-built cards. */
    accessModel?: string | null;
    /** `CourseSummaryDto.Pricing` — null on every free course, which is every course that predates monetization. */
    pricing?: PricingDto | null;
    /** The viewer holds an active entitlement for this course (bought it, or bought a track containing it). */
    owned?: boolean;
    /** At least one chapter of this course is sold separately. */
    hasChapterPricing?: boolean;
}

/**
 * Whether a course actually costs money.
 *
 * Mirrors the server's rule (`Course.IsPaid`): only an **à-la-carte** course with a non-free price is gated. A course
 * left on `Free`, or an à-la-carte course whose price was cleared, behaves exactly as it did before phase 5 — the
 * catalog and detail screens must not grow a price or a buy button for it.
 */
export const isPaidCourse = (
    accessModel: string | null | undefined,
    pricing: PricingDto | null | undefined
): boolean => accessModel === "AlaCarte" && !!pricing && !pricing.IsFree;

/** The platform's fixed course category taxonomy; keys are stored on `Course.Category` and shown via the `courses:category.*` i18n keys. */
export type CourseCategory =
    | "languages"
    | "science"
    | "mathematics"
    | "technology"
    | "business"
    | "arts-humanities"
    | "professional-development"
    | "test-prep"
    | "other";

export type CourseLevel = "beginner" | "intermediate" | "advanced";

/** English fallback labels; screens show the localized `courses:category.*` key instead of these values. */
export const categoryLabels: Record<CourseCategory, string> = {
    "languages": "Languages",
    "science": "Science",
    "mathematics": "Mathematics",
    "technology": "Technology & IT",
    "business": "Business",
    "arts-humanities": "Arts & Humanities",
    "professional-development": "Professional Development",
    "test-prep": "Test Prep & Certification",
    "other": "Other",
};

/** Normalizes a course's free-text `Category` (older data, or a value outside the taxonomy) to a known key. */
export const toCourseCategory = (category: string | null | undefined): CourseCategory => {
    const key = category?.toLowerCase().trim();
    return key && key in categoryLabels ? (key as CourseCategory) : "other";
};

export const levelLabels: Record<CourseLevel, string> = {
    "beginner": "Beginner",
    "intermediate": "Intermediate",
    "advanced": "Advanced",
};
