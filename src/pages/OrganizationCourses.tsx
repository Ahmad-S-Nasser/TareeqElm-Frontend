import { useState } from "react";
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
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [syllabusCourse, setSyllabusCourse] = useState<Course | null>(null);

    const { data: courses = [], isLoading, isError, error } = useQuery({
        queryKey: ["organization-courses"],
        queryFn: async () => (await api.get<Course[]>("/Courses", { params: { pageSize: 100 } })).data,
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
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
                "ml-0"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-slide-up">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                                <BookOpen className="w-8 h-8 text-primary" />
                                Course Catalog
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Oversee all courses offered across departments.
                            </p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-soft animate-slide-up" style={{ animationDelay: "100ms" }}>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search courses..."
                                className="pl-9 bg-background/50 focus-visible:ring-primary"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline">
                            Filter
                        </Button>
                    </div>

                    <div className="bg-card rounded-xl border border-border/50 shadow-soft overflow-hidden animate-slide-up" style={{ animationDelay: "200ms" }}>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead>Course Title</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Instructor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Trainers</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></TableCell></TableRow>
                                )}
                                {isError && (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-destructive">{getApiError(error, "Could not load courses.")}</TableCell></TableRow>
                                )}
                                {!isLoading && !isError && filteredCourses.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No courses found.</TableCell></TableRow>
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
                                                {course.Category || "Uncategorized"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{course.InstructorName || "-"}</TableCell>
                                        <TableCell>
                                            <Badge className={cn("text-xs capitalize", getStatusColor(course.Status))} variant="secondary">
                                                {course.Status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{course.EnrolledCount}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => setSyllabusCourse(course)}>
                                                        <FileText className="w-4 h-4 mr-2" /> View Syllabus
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
                        <DialogTitle>Course Syllabus</DialogTitle>
                        <DialogDescription>{syllabusCourse?.Title} — {syllabusCourse?.InstructorName}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-muted/40">
                                <p className="text-xs text-muted-foreground">Category</p>
                                <p className="font-semibold text-sm">{syllabusCourse?.Category || "Uncategorized"}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/40">
                                <p className="text-xs text-muted-foreground">Enrolled Trainers</p>
                                <p className="font-semibold text-sm">{syllabusCourse?.EnrolledCount}</p>
                            </div>
                        </div>
                        <div className="border rounded-lg p-4 space-y-3">
                            <h4 className="font-semibold text-sm">Course Outline</h4>
                            <div className="space-y-2 text-sm">
                                {curriculumLoading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                                {!curriculumLoading && curriculum.length === 0 && (
                                    <p className="text-muted-foreground">No curriculum has been added yet.</p>
                                )}
                                {curriculum.map((chapter, i) => (
                                    <div key={chapter.Id} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                                        <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">Chapter {i + 1}</span>
                                        <span>{chapter.Title} <span className="text-xs text-muted-foreground">({chapter.Lessons.length} lessons)</span></span>
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
