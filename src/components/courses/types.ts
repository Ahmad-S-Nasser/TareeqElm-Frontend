export interface Course {
    id: string;
    title: string;
    description: string;
    progress: number;
    duration: string;
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
}

export type CourseCategory =
    | "certification"
    | "testing-techniques"
    | "automation"
    | "agile"
    | "tools"
    | "soft-skills";

export type CourseLevel = "beginner" | "intermediate" | "advanced";

export const categoryLabels: Record<CourseCategory, string> = {
    "certification": "Certification Prep",
    "testing-techniques": "Testing Techniques",
    "automation": "Test Automation",
    "agile": "Agile & DevOps",
    "tools": "Tools & Frameworks",
    "soft-skills": "Soft Skills",
};

export const levelLabels: Record<CourseLevel, string> = {
    "beginner": "Beginner",
    "intermediate": "Intermediate",
    "advanced": "Advanced",
};
