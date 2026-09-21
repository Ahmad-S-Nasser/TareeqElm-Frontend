import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookOpen, Users, Search, Loader2 } from "lucide-react";
import api, { getApiError } from "@/lib/api";

interface CourseEnrollment {
    Id: string;
    Title: string;
    InstructorName: string | null;
    Status: string;
    EnrolledCount: number;
    LessonsCount: number;
}

const AdminEnrollments = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [search, setSearch] = useState("");

    const { data: courses = [], isLoading, isError, error } = useQuery({
        queryKey: ["admin-enrollments-courses"],
        queryFn: async () => (await api.get<CourseEnrollment[]>("/Courses", { params: { pageSize: 100 } })).data,
    });

    const filtered = courses.filter((c) =>
        c.Title.toLowerCase().includes(search.toLowerCase()) ||
        (c.InstructorName || "").toLowerCase().includes(search.toLowerCase())
    );
    const totalEnrolled = courses.reduce((sum, c) => sum + c.EnrolledCount, 0);

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ml-20" : "lg:ml-64")}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-black">Enrollment Management</h1>
                        <p className="text-muted-foreground text-sm mt-1">Enrollment counts per course. Trainers enroll themselves in published courses.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="border-border/50">
                            <CardContent className="p-4">
                                <p className="text-2xl font-black">{courses.length}</p>
                                <p className="text-xs text-muted-foreground">Courses</p>
                            </CardContent>
                        </Card>
                        <Card className="border-border/50">
                            <CardContent className="p-4">
                                <p className="text-2xl font-black">{totalEnrolled}</p>
                                <p className="text-xs text-muted-foreground">Total enrollments</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Search courses or instructors…" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : isError ? (
                        <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, "Could not load courses.")}</CardContent></Card>
                    ) : filtered.length === 0 ? (
                        <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">No courses found.</CardContent></Card>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map((course) => (
                                <Card key={course.Id} className="border-border/50 hover:border-rose-300/40 transition-colors">
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                                            <BookOpen className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{course.Title}</p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Users className="w-3 h-3" />{course.EnrolledCount} enrolled
                                                {course.InstructorName && <span className="ml-2">· {course.InstructorName}</span>}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="text-xs capitalize">{course.Status}</Badge>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">Direct assignment and open-enrollment controls are not available yet.</p>
                </div>
            </main>
        </div>
    );
};

export default AdminEnrollments;
