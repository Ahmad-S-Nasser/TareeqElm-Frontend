import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { InstructorSidebar } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useCourses, Course } from "@/hooks/useCourses";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  BookOpen,
  Users,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Archive,
  Send,
  Loader2,
} from "lucide-react";

const InstructorCourses = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteConfirmCourse, setDeleteConfirmCourse] = useState<Course | null>(null);
    const [newCourse, setNewCourse] = useState({
        Title: "",
        Description: "",
        Category: "",
        Level: "beginner",
    });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const { user, role } = useAuth();
  const { toast } = useToast();
  const { courses, loading, fetchInstructorCourses, createCourse, publishCourse, archiveCourse, deleteCourse } = useCourses();

    useEffect(() => {
        if (user && (role === 'instructor' || role === 'admin')) {
            fetchInstructorCourses();
        }
    }, [user, role, fetchInstructorCourses]);

    // Runs a course action, shows the failure reason if any, and reloads the list.
    const runAction = async (action: Promise<{ error: Error | null }>, failTitle: string) => {
        const { error } = await action;
        if (error) {
            toast({ title: failTitle, description: getApiError(error), variant: "destructive" });
        }
        fetchInstructorCourses();
    };

    const handleCreateCourse = async () => {
        setCreating(true);
        const { data, error } = await createCourse(newCourse);
        setCreating(false);

        if (data && !error) {
            setIsCreateDialogOpen(false);
            setNewCourse({ Title: "", Description: "", Category: "", Level: "beginner" });
            navigate(`/instructor/courses/${data.Id}`);
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase() || 'draft';
        const variants: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
            draft: { variant: "secondary", label: "Draft" },
            published: { variant: "default", label: "Published" },
            archived: { variant: "outline", label: "Archived" },
        };
        return variants[s] || variants.draft;
    };

    return (
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main
                className={cn(
                    "pt-20 pb-8 px-6 transition-all duration-300",
                    sidebarCollapsed ? "ml-20" : "ml-64"
                )}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold">My Courses</h1>
                            <p className="text-muted-foreground">
                                Create, manage, and publish your courses
                            </p>
                        </div>
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="gradient">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Course
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Create New Course</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="title">Course Title</Label>
                                        <Input
                                            id="title"
                                            value={newCourse.Title}
                                            onChange={(e) => setNewCourse({ ...newCourse, Title: e.target.value })}
                                            placeholder="e.g., ISTQB Foundation Level"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea
                                            id="description"
                                            value={newCourse.Description}
                                            onChange={(e) => setNewCourse({ ...newCourse, Description: e.target.value })}
                                            placeholder="What will trainers learn?"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="category">Category</Label>
                                            <Input
                                                id="category"
                                                value={newCourse.Category}
                                                onChange={(e) => setNewCourse({ ...newCourse, Category: e.target.value })}
                                                placeholder="e.g., Certification"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="level">Level</Label>
                                            <Select
                                                value={newCourse.Level}
                                                onValueChange={(value) => setNewCourse({ ...newCourse, Level: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="beginner">Beginner</SelectItem>
                                                    <SelectItem value="intermediate">Intermediate</SelectItem>
                                                    <SelectItem value="advanced">Advanced</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleCreateCourse}
                                        disabled={!newCourse.Title || creating}
                                        className="w-full"
                                    >
                                        {creating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            "Create Course"
                                        )}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Course Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : courses.length === 0 ? (
                        <Card className="py-12">
                            <CardContent className="flex flex-col items-center text-center">
                                <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Create your first course to get started
                                </p>
                                <Button onClick={() => setIsCreateDialogOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Course
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {courses.map((course) => {
                                const statusBadge = getStatusBadge(course.Status);
                                return (
                                    <Card key={course.Id} className="overflow-hidden hover:shadow-lg transition-shadow">
                                        <div className="h-32 bg-gradient-to-br from-primary/20 to-accent/20 relative">
                                            {course.ImageUrl && (
                                                <img
                                                    src={course.ImageUrl}
                                                    alt={course.Title}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                            <div className="absolute top-3 right-3">
                                                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                                            </div>
                                        </div>
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between">
                                                <CardTitle className="text-lg line-clamp-2">{course.Title}</CardTitle>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => navigate(`/instructor/courses/${course.Id}`)}>
                                                            <Edit className="w-4 h-4 mr-2" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => navigate(`/instructor/courses/${course.Id}/trainers`)}>
                                                            <Users className="w-4 h-4 mr-2" />
                                                            View Trainers
                                                        </DropdownMenuItem>
                                                        {course.Status?.toLowerCase() === "draft" && (
                                                            <DropdownMenuItem onClick={() => runAction(publishCourse(course.Id), "Publish failed")}>
                                                                <Send className="w-4 h-4 mr-2" />
                                                                Publish
                                                            </DropdownMenuItem>
                                                        )}
                                                        {course.Status?.toLowerCase() === "published" && (
                                                            <DropdownMenuItem onClick={() => runAction(archiveCourse(course.Id), "Archive failed")}>
                                                                <Archive className="w-4 h-4 mr-2" />
                                                                Archive
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            onClick={() => setDeleteConfirmCourse(course)}
                                                            className="text-destructive"
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                                                {course.Description || "No description"}
                                            </p>
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                    <Users className="w-4 h-4" />
                                                    <span>{course.EnrolledCount ?? course.EnrollmentCount ?? 0} trainers</span>
                                                </div>
                                                <Badge variant="outline" className="capitalize">
                                                    {course.Level}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteConfirmCourse} onOpenChange={() => setDeleteConfirmCourse(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Course?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{deleteConfirmCourse?.Title}" and all its content.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteConfirmCourse) {
                                    runAction(deleteCourse(deleteConfirmCourse.Id), "Delete failed");
                                    setDeleteConfirmCourse(null);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default InstructorCourses;
