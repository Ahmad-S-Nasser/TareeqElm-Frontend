import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import {
    BookOpen,
    Search,
    MoreHorizontal,
    Loader2,
    FileText,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourseDepartmentOptions, ALL_DEPARTMENTS } from "@/hooks/useDepartments";

interface Course {
    Id: string;
    Title: string;
    Category: string | null;
    InstructorName: string | null;
    EnrolledCount: number;
    Status: string;
}
interface CurriculumChapter {
    Id: string;
    Title: string;
    Lessons: { Id: string; Title: string }[];
}

const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case "published":
            return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
        case "draft":
            return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
        default:
            return "bg-muted text-muted-foreground hover:bg-muted/80";
    }
};

const OrganizationCourses = () => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber } = useFormatters();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [syllabusCourse, setSyllabusCourse] = useState<Course | null>(null);
    const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);
    const { data: departments = [] } = useCourseDepartmentOptions();

    // The department filter is applied by the server (GET /Courses?departmentId=).
    const departmentId = departmentFilter === ALL_DEPARTMENTS ? null : departmentFilter;
    const { data: courses = [], isLoading, isError, error } = useQuery({
        queryKey: departmentId ? ["organization-courses", { departmentId }] : ["organization-courses"],
        queryFn: async () => (await api.get<Course[]>("/Courses", {
            params: departmentId ? { pageSize: 100, departmentId } : { pageSize: 100 },
        })).data,
    });

    const { data: curriculum = [], isLoading: curriculumLoading } = useQuery({
        queryKey: ["course-curriculum", syllabusCourse?.Id],
        enabled: !!syllabusCourse,
        queryFn: async () => (await api.get<CurriculumChapter[]>(`/Courses/${syllabusCourse!.Id}/curriculum`)).data,
    });

    const filteredCourses = courses.filter(course =>
        course.Title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.InstructorName || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Organization"
                mobileSidebar={<OrganizationSidebarContent collapsed={false} />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
                "ms-0"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-slide-up">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                                <BookOpen className="w-8 h-8 text-primary" />
                                {t("courses.title")}
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                {t("courses.subtitle")}
                            </p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "100ms" }}>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder={t("courses.search")}
                                className="ps-9 bg-background/50 focus-visible:ring-primary"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {departments.length > 0 && (
                            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                <SelectTrigger className="w-full sm:w-48" aria-label={t("courses.filterDepartment")}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_DEPARTMENTS}>{t("courses.allDepartments")}</SelectItem>
                                    {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                        <Button variant="outline">
                            {t("courses.filter")}
                        </Button>
                    </div>

                    <div className="bg-card rounded-xl border border-border/50 shadow-soft overflow-hidden animate-slide-up" style={{ animationDelay: "200ms" }}>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead>{t("courses.table.title")}</TableHead>
                                    <TableHead>{t("courses.table.category")}</TableHead>
                                    <TableHead>{t("courses.table.instructor")}</TableHead>
                                    <TableHead>{t("common:labels.status")}</TableHead>
                                    <TableHead>{t("courses.table.trainers")}</TableHead>
                                    <TableHead className="text-end">{t("common:labels.actions")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></TableCell></TableRow>
                                )}
                                {isError && (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-destructive">{getApiError(error, t("courses.loadFailed"))}</TableCell></TableRow>
                                )}
                                {!isLoading && !isError && filteredCourses.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{t("courses.empty")}</TableCell></TableRow>
                                )}
                                {filteredCourses.map((course) => (
                                    <TableRow key={course.Id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                                                    <BookOpen className="w-4 h-4" />
                                                </div>
                                                {course.Title}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs font-normal">
                                                {course.Category || t("courses.uncategorized")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{course.InstructorName ?? t("courses.noInstructor")}</TableCell>
                                        <TableCell>
                                            <Badge className={cn("text-xs", getStatusColor(course.Status))} variant="secondary">
                                                {t(`courses.status.${course.Status}`, { defaultValue: course.Status })}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{formatNumber(course.EnrolledCount)}</TableCell>
                                        <TableCell className="text-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" aria-label={t("courses.actionsMenu")}>
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setSyllabusCourse(course)}>
                                                        <FileText className="w-4 h-4 me-2" /> {t("courses.viewSyllabus")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </main>

            {/* Syllabus Dialog */}
            <Dialog open={!!syllabusCourse} onOpenChange={(open) => !open && setSyllabusCourse(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t("courses.syllabus")}</DialogTitle>
                        <DialogDescription>{t("courses.syllabusSubtitle", { title: syllabusCourse?.Title, instructor: syllabusCourse?.InstructorName ?? t("courses.noInstructor") })}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-muted/40">
                                <p className="text-xs text-muted-foreground">{t("courses.table.category")}</p>
                                <p className="font-semibold text-sm">{syllabusCourse?.Category || t("courses.uncategorized")}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/40">
                                <p className="text-xs text-muted-foreground">{t("courses.enrolledTrainers")}</p>
                                <p className="font-semibold text-sm">{formatNumber(syllabusCourse?.EnrolledCount ?? 0)}</p>
                            </div>
                        </div>
                        <div className="border rounded-lg p-4 space-y-3">
                            <h4 className="font-semibold text-sm">{t("courses.outline")}</h4>
                            <div className="space-y-2 text-sm">
                                {curriculumLoading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                                {!curriculumLoading && curriculum.length === 0 && (
                                    <p className="text-muted-foreground">{t("courses.noCurriculum")}</p>
                                )}
                                {curriculum.map((chapter, i) => (
                                    <div key={chapter.Id} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                                        <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">{t("courses.chapter", { number: formatNumber(i + 1) })}</span>
                                        <span>{chapter.Title} <span className="text-xs text-muted-foreground">({t("courses.lessonsCount", { count: chapter.Lessons.length })})</span></span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OrganizationCourses;
