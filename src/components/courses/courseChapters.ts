import { Course } from "@/hooks/useCourses";

export interface Chapter {
    Id: string;
    CourseId: string;
    Number: number;
    Title: string;
    Description: string;
    Duration: string;
    Lessons: Lesson[];
    IsCompleted: boolean;
    IsLocked: boolean;
}

export interface Lesson {
    Id: string;
    ChapterId: string;
    Number: number;
    Title: string;
    Type: LessonType;
    Duration: string;
    IsCompleted: boolean;
    IsLocked: boolean;
    Content?: string;
}

export type LessonType = "video" | "reading" | "quiz" | "exercise" | "flashcards";

// Extended course data with chapters
export interface CourseWithChapters extends Course {
    Chapters: Chapter[];
    Objectives: string[];
    Prerequisites: string[];
    Syllabus?: string; // Link to uploaded syllabus
    Enrolled?: boolean;
    Progress?: number;
    Rating?: number;
    TrainersEnrolled?: number;
    Instructor?: string;
    Duration: string;
    StartDate?: string;
    EndDate?: string;
    AttachmentUrl?: string;
}

export const courseChaptersData: Record<string, Chapter[]> = {
    "c1": [ // ISTQB Foundation Level
        {
            Id: "ch1-1",
            CourseId: "c1",
            Number: 1,
            Title: "Fundamentals of Testing",
            Description: "Learn what testing is, why it's necessary, and common testing objectives and terminology.",
            Duration: "3 hours",
            IsCompleted: true,
            IsLocked: false,
            Lessons: [
                { Id: "l1-1-1", ChapterId: "ch1-1", Number: 1, Title: "What is Testing?", Type: "video", Duration: "15 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-1-2", ChapterId: "ch1-1", Number: 2, Title: "Why is Testing Necessary?", Type: "reading", Duration: "20 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-1-3", ChapterId: "ch1-1", Number: 3, Title: "Seven Testing Principles", Type: "video", Duration: "25 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-1-4", ChapterId: "ch1-1", Number: 4, Title: "Test Process Fundamentals", Type: "reading", Duration: "30 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-1-5", ChapterId: "ch1-1", Number: 5, Title: "Psychology of Testing", Type: "video", Duration: "20 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-1-6", ChapterId: "ch1-1", Number: 6, Title: "Chapter 1 Quiz", Type: "quiz", Duration: "30 min", IsCompleted: true, IsLocked: false },
            ],
        },
        {
            Id: "ch1-2",
            CourseId: "c1",
            Number: 2,
            Title: "Testing Throughout the SDLC",
            Description: "Understand how testing integrates with different software development lifecycles.",
            Duration: "4 hours",
            IsCompleted: true,
            IsLocked: false,
            Lessons: [
                { Id: "l1-2-1", ChapterId: "ch1-2", Number: 1, Title: "Software Development Lifecycle Models", Type: "video", Duration: "30 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-2-2", ChapterId: "ch1-2", Number: 2, Title: "Test Levels", Type: "reading", Duration: "25 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-2-3", ChapterId: "ch1-2", Number: 3, Title: "Test Types", Type: "video", Duration: "35 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-2-4", ChapterId: "ch1-2", Number: 4, Title: "Maintenance Testing", Type: "reading", Duration: "20 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-2-5", ChapterId: "ch1-2", Number: 5, Title: "Chapter 2 Quiz", Type: "quiz", Duration: "30 min", IsCompleted: true, IsLocked: false },
            ],
        },
        {
            Id: "ch1-3",
            CourseId: "c1",
            Number: 3,
            Title: "Static Testing",
            Description: "Learn about reviews, walkthroughs, and static analysis techniques.",
            Duration: "3 hours",
            IsCompleted: false,
            IsLocked: false,
            Lessons: [
                { Id: "l1-3-1", ChapterId: "ch1-3", Number: 1, Title: "Static Testing Basics", Type: "video", Duration: "20 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-3-2", ChapterId: "ch1-3", Number: 2, Title: "Review Process", Type: "reading", Duration: "25 min", IsCompleted: true, IsLocked: false },
                { Id: "l1-3-3", ChapterId: "ch1-3", Number: 3, Title: "Review Types", Type: "video", Duration: "30 min", IsCompleted: false, IsLocked: false },
                { Id: "l1-3-4", ChapterId: "ch1-3", Number: 4, Title: "Static Analysis Tools", Type: "reading", Duration: "20 min", IsCompleted: false, IsLocked: false },
                { Id: "l1-3-5", ChapterId: "ch1-3", Number: 5, Title: "Chapter 3 Quiz", Type: "quiz", Duration: "25 min", IsCompleted: false, IsLocked: false },
            ],
        },
    ]
};

export function getCourseWithChapters(courseId: string, courses: Course[]): CourseWithChapters | null {
    const course = courses.find(c => c.Id === courseId);
    if (!course) return null;

    return {
        ...course,
        Chapters: courseChaptersData[courseId] || [],
        Objectives: getDefaultObjectives(courseId),
        Prerequisites: getDefaultPrerequisites(courseId),
        Duration: "10 hours", // Default for mock
    };
}

function getDefaultObjectives(courseId: string): string[] {
    const objectives: Record<string, string[]> = {
        "c1": [
            "Understand fundamental testing concepts and terminology",
            "Apply testing throughout the software development lifecycle",
            "Use static and dynamic testing techniques effectively",
        ],
    };
    return objectives[courseId] || ["Complete all course modules", "Pass the final assessment"];
}

function getDefaultPrerequisites(courseId: string): string[] {
    const prerequisites: Record<string, string[]> = {
        "c1": ["Basic understanding of software development", "No prior testing experience required"],
    };
    return prerequisites[courseId] || ["No prerequisites"];
}
