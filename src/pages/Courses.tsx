import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { CourseCardEnhanced, categoryLabels, levelLabels, CourseCategory, CourseLevel, Course } from "@/components/courses";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api, { getApiError } from "@/lib/api";
import { CourseSummary, useEnrollmentsQuery } from "@/hooks/useTrainerApi";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, AlertCircle } from "lucide-react";
import {
    BookOpen,
    Search,
    Filter,
    GraduationCap,
    TrendingUp,
    Clock,
    Sparkles
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FilterTab = "all" | "in-progress" | "completed" | "not-started";

const Courses = () => {
    const navigate = useNavigate();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<FilterTab>("all");
    const [selectedCategories, setSelectedCategories] = useState<CourseCategory[]>([]);
    const [selectedLevels, setSelectedLevels] = useState<CourseLevel[]>([]);

    const { user } = useAuth();

    const catalogQuery = useQuery({
        queryKey: ["courses-catalog"],
        queryFn: async () => (await api.get<CourseSummary[]>("/Courses", { params: { status: "Published" } })).data,
    });
    const enrollmentsQuery = useEnrollmentsQuery();

    const loading = catalogQuery.isLoading || (!!user && enrollmentsQuery.isLoading);
    const errorMessage = catalogQuery.error
        ? getApiError(catalogQuery.error, "Failed to load courses.")
        : null;

    const allCourses = useMemo<Course[]>(() => {
        const progressByCourse = new Map<string, number>(
            (enrollmentsQuery.data ?? []).map(e => [e.CourseId, Math.round(e.ProgressPercentage || 0)])
        );
        const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");
        return (catalogQuery.data ?? []).map(c => ({
            id: c.Id,
            title: c.Title,
            description: c.Description || "",
            progress: progressByCourse.get(c.Id) ?? 0,
            duration: `${c.DurationHours ?? 0} hours`,
            lessons: c.LessonsCount,
            category: (c.Category?.toLowerCase() ?? "certification") as CourseCategory,
            level: (c.Level?.toLowerCase() ?? "beginner") as CourseLevel,
            instructor: c.InstructorName || "Instructor",
            rating: 0,
            trainersEnrolled: c.EnrolledCount,
            tags: [],
            image: c.ImageUrl ? (c.ImageUrl.startsWith("/") ? `${apiOrigin}${c.ImageUrl}` : c.ImageUrl) : undefined,
            isFeatured: c.IsFeatured,
        }));
    }, [catalogQuery.data, enrollmentsQuery.data]);

    const filteredCourses = useMemo(() => {
        return allCourses.filter((course) => {
            // Search filter
            const matchesSearch =
                course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (course.tags && course.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));

            // Tab filter
            const matchesTab =
                activeTab === "all" ||
                (activeTab === "in-progress" && course.progress > 0 && course.progress < 100) ||
                (activeTab === "completed" && course.progress === 100) ||
                (activeTab === "not-started" && course.progress === 0);

            // Category filter
            const matchesCategory =
                selectedCategories.length === 0 ||
                selectedCategories.includes(course.category);

            // Level filter
            const matchesLevel =
                selectedLevels.length === 0 ||
                selectedLevels.includes(course.level);

            return matchesSearch && matchesTab && matchesCategory && matchesLevel;
        });
    }, [allCourses, searchQuery, activeTab, selectedCategories, selectedLevels]);

    const toggleCategory = (category: CourseCategory) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const toggleLevel = (level: CourseLevel) => {
        setSelectedLevels(prev =>
            prev.includes(level)
                ? prev.filter(l => l !== level)
                : [...prev, level]
        );
    };

    // Stats
    const stats = {
        total: allCourses.length,
        inProgress: allCourses.filter(c => c.progress > 0 && c.progress < 100).length,
        completed: allCourses.filter(c => c.progress === 100).length,
        totalHours: allCourses.reduce((sum, c) => sum + parseInt(c.duration || "0"), 0),
    };

    return (
        <div className="min-h-screen bg-background">
            <ApplicantSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Trainer"
                mobileSidebar={<ApplicantSidebarContent onItemClick={() => console.log('Mobile sidebar clicked')} />}
            />

            <main
                className={cn(
                    "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                    sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
                    "ml-0"
                )}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <section className="animate-slide-up">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-primary">
                                        <BookOpen className="w-5 h-5 text-primary-foreground" />
                                    </div>
                                    <h1 className="text-2xl font-bold">Courses</h1>
                                </div>
                                <p className="text-muted-foreground">
                                    Explore our comprehensive library of testing and QA courses
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Stats Cards */}
                    <section
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up"
                        style={{ animationDelay: "100ms" }}
                    >
                        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <GraduationCap className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                    <p className="text-xs text-muted-foreground">Total Courses</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-warning" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.inProgress}</p>
                                    <p className="text-xs text-muted-foreground">In Progress</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-success" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.completed}</p>
                                    <p className="text-xs text-muted-foreground">Completed</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-card border border-border/50 shadow-soft p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{stats.totalHours}h</p>
                                    <p className="text-xs text-muted-foreground">Total Content</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Filters */}
                    <section
                        className="flex flex-col md:flex-row gap-4 animate-slide-up"
                        style={{ animationDelay: "150ms" }}
                    >
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search courses..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
                            <TabsList>
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                                <TabsTrigger value="not-started">New</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {/* Filter Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Filter className="w-4 h-4" />
                                    Filters
                                    {(selectedCategories.length > 0 || selectedLevels.length > 0) && (
                                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                                            {selectedCategories.length + selectedLevels.length}
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Categories</DropdownMenuLabel>
                                {(Object.entries(categoryLabels) as [CourseCategory, string][]).map(([key, label]) => (
                                    <DropdownMenuCheckboxItem
                                        key={key}
                                        checked={selectedCategories.includes(key)}
                                        onCheckedChange={() => toggleCategory(key)}
                                    >
                                        {label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Level</DropdownMenuLabel>
                                {(Object.entries(levelLabels) as [CourseLevel, string][]).map(([key, label]) => (
                                    <DropdownMenuCheckboxItem
                                        key={key}
                                        checked={selectedLevels.includes(key)}
                                        onCheckedChange={() => toggleLevel(key)}
                                    >
                                        {label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </section>

                    {/* Course Grid */}
                    <section className="animate-slide-up" style={{ animationDelay: "200ms" }}>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                                <p className="text-muted-foreground">Loading courses...</p>
                            </div>
                        ) : errorMessage ? (
                            <div className="text-center py-16">
                                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
                                <h3 className="text-lg font-semibold mb-1">Could not load courses</h3>
                                <p className="text-muted-foreground mb-4">{errorMessage}</p>
                                <Button variant="outline" onClick={() => catalogQuery.refetch()}>Try again</Button>
                            </div>
                        ) : filteredCourses.length > 0 ? (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCourses.map((course) => (
                                    <CourseCardEnhanced
                                        key={course.id}
                                        course={course}
                                        variant={course.isFeatured ? "featured" : "default"}
                                        onClick={() => navigate(`/courses/${course.id}`)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                    <BookOpen className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">No courses found</h3>
                                <p className="text-muted-foreground mb-4">
                                    {allCourses.length === 0
                                        ? "There are no published courses yet. Check back soon."
                                        : "Try adjusting your search or filters"}
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setActiveTab("all");
                                        setSelectedCategories([]);
                                        setSelectedLevels([]);
                                    }}
                                >
                                    Clear all filters
                                </Button>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
};

export default Courses;
