import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Upload, Loader2, Save, FileText, Video as VideoIcon } from "lucide-react";
import { useCourseEditor, Chapter } from "@/hooks/useCourseEditor";
import { ChapterList } from "@/components/instructor/ChapterList";
import { InstructorSidebar } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useCourses } from "@/hooks/useCourses";
import { useEffect } from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Eye, EyeOff, Lock, Unlock, Trash2, Archive, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEnrolledTrainers } from "@/hooks/useEnrolledTrainers";
import { format } from "date-fns";
import { getApiError } from "@/lib/api";

const CourseEditor = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState("info");

    const [courseInfo, setCourseInfo] = useState({
        Title: "",
        Description: "",
        Category: "",
        Level: "beginner",
        MinApplicants: 0,
        ImageUrl: "",
        Status: "Draft" as "Draft" | "Published" | "Archived"
    });

    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loadingCourse, setLoadingCourse] = useState(true);

    const { updateCourse, getCourseById, deleteCourse } = useCourses();
    const { trainers: enrolledTrainers, loading: trainersLoading, error: trainersError } = useEnrolledTrainers(courseId);
    const { analyzeSyllabus, uploadMedia, saveCurriculum, fetchCurriculum, analyzing, analysisError, loading: savingCurriculum } = useCourseEditor();
    const { toast } = useToast();

    useEffect(() => {
        const loadData = async () => {
            if (!courseId) return;

            setLoadingCourse(true);
            try {
                const { course } = await getCourseById(courseId);
                if (course) {
                    setCourseInfo({
                        Title: course.Title || "",
                        Description: course.Description || "",
                        Category: course.Category || "",
                        Level: course.Level?.toLowerCase() || "beginner",
                        MinApplicants: 0,
                        ImageUrl: course.ImageUrl || "",
                        Status: course.Status || "Draft"
                    });
                }

                const curr = await fetchCurriculum(courseId);
                if (curr) {
                    setChapters(curr);
                }
            } catch (error) {
                console.error("Error loading course data:", error);
            } finally {
                setLoadingCourse(false);
            }
        };

        loadData();
    }, [courseId, getCourseById, fetchCurriculum]);

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const structure = await analyzeSyllabus(file);
        e.target.value = "";
        if (structure) {
            setChapters(structure);
            setActiveTab("curriculum");
        }
    };

    const handleSaveInfo = async () => {
        if (!courseId) return;
        await updateCourse(courseId, {
            Title: courseInfo.Title,
            Description: courseInfo.Description,
            Category: courseInfo.Category,
            Level: courseInfo.Level,
            Status: courseInfo.Status
        });
    };

    const handleSaveCurriculum = async () => {
        if (!courseId) return;
        const saved = await saveCurriculum(courseId, chapters);
        if (saved) setChapters(saved);
    };

    const handleArchiveCourse = async () => {
        if (!courseId) return;
        const { error } = await updateCourse(courseId, { Status: "Archived" });
        if (!error) setCourseInfo(prev => ({ ...prev, Status: "Archived" }));
        else toast({ variant: "destructive", title: "Archive failed", description: getApiError(error) });
    };

    const handleDeleteCourse = async () => {
        if (!courseId) return;
        if (!window.confirm("Permanently delete this course and all of its content?")) return;
        const { error } = await deleteCourse(courseId);
        if (error) {
            toast({ variant: "destructive", title: "Delete failed", description: getApiError(error, "The course could not be deleted.") });
            return;
        }
        navigate("/instructor/courses");
    };

    return (
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-8 px-6 transition-all duration-300",
                sidebarCollapsed ? "ml-20" : "ml-64"
            )}>
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" onClick={() => navigate("/instructor/courses")}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                            <h1 className="text-2xl font-bold">Edit Course</h1>
                        </div>
                        {loadingCourse && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="info">Course Info</TabsTrigger>
                            <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
                            <TabsTrigger value="trainers">Trainers</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>

                        <TabsContent value="info" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Basic Information</CardTitle>
                                    <CardDescription>Manage your course details and settings.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title">Course Title</Label>
                                        <Input
                                            id="title"
                                            value={courseInfo.Title}
                                            onChange={(e) => setCourseInfo({ ...courseInfo, Title: e.target.value })}
                                            placeholder="e.g. Master React"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea
                                            id="description"
                                            value={courseInfo.Description}
                                            onChange={(e) => setCourseInfo({ ...courseInfo, Description: e.target.value })}
                                            rows={4}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="category">Category</Label>
                                            <Input
                                                id="category"
                                                value={courseInfo.Category}
                                                onChange={(e) => setCourseInfo({ ...courseInfo, Category: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="level">Level</Label>
                                            <Select
                                                value={courseInfo.Level}
                                                onValueChange={(val) => setCourseInfo({ ...courseInfo, Level: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select level" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="beginner">Beginner</SelectItem>
                                                    <SelectItem value="intermediate">Intermediate</SelectItem>
                                                    <SelectItem value="advanced">Advanced</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="minApplicants">Minimum Applicants</Label>
                                        <Input
                                            id="minApplicants"
                                            type="number"
                                            min="0"
                                            value={courseInfo.MinApplicants}
                                            onChange={(e) => setCourseInfo({ ...courseInfo, MinApplicants: parseInt(e.target.value) || 0 })}
                                            placeholder="0"
                                            className="max-w-[200px]"
                                        />
                                        <p className="text-sm text-muted-foreground">Minimum number of trainers required to start the course.</p>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <Label className="mb-2 block">Syllabus Analysis</Label>
                                        <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
                                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                            {analyzing ? (
                                                <div className="flex items-center gap-2 text-primary">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Analyzing syllabus...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-sm font-medium">Upload Text Syllabus (.txt or .md)</p>
                                                    <p className="text-xs text-muted-foreground mb-4">A suggested outline is created from the topics; review it before saving</p>
                                                    <div className="relative">
                                                        <Input
                                                            type="file"
                                                            accept=".txt,.md"
                                                            className="max-w-xs cursor-pointer"
                                                            onChange={handlePdfUpload}
                                                        />
                                                    </div>
                                                    {analysisError && (
                                                        <p className="text-sm text-destructive mt-3">{analysisError}</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <Button onClick={handleSaveInfo}>
                                            <Save className="w-4 h-4 mr-2" />
                                            Save Changes
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="curriculum">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Course Curriculum</CardTitle>
                                    <CardDescription>Drag and drop chapters and lessons to reorder.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <ChapterList
                                        chapters={chapters}
                                        onUpdateChapters={setChapters}
                                        onUploadMedia={uploadMedia}
                                    />
                                    <div className="flex justify-end pt-4 border-t">
                                        <Button
                                            onClick={handleSaveCurriculum}
                                            disabled={savingCurriculum}
                                        >
                                            {savingCurriculum ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4 mr-2" />
                                            )}
                                            Save Curriculum
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="trainers">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Enrolled Trainers</CardTitle>
                                    <CardDescription>Manage and view trainers enrolled in this course.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Trainer</TableHead>
                                                <TableHead>Enrolled Date</TableHead>
                                                <TableHead>Progress</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {trainersLoading && (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin inline text-primary" /></TableCell></TableRow>
                                            )}
                                            {!trainersLoading && trainersError && (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-destructive">{getApiError(trainersError, "Failed to load trainers.")}</TableCell></TableRow>
                                            )}
                                            {!trainersLoading && !trainersError && enrolledTrainers.length === 0 && (
                                                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No trainers enrolled yet.</TableCell></TableRow>
                                            )}
                                            {enrolledTrainers.map((trainer) => (
                                                <TableRow key={trainer.TrainerId}>
                                                    <TableCell className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage src={trainer.AvatarUrl || undefined} />
                                                            <AvatarFallback>{trainer.FullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{trainer.FullName}</p>
                                                            <p className="text-xs text-muted-foreground">{trainer.Email}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{format(new Date(trainer.EnrolledAt), "MMM d, yyyy")}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 w-full max-w-[100px] bg-secondary rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary"
                                                                    style={{ width: `${trainer.ProgressPercentage}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{Math.round(trainer.ProgressPercentage)}%</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={trainer.CompletedAt ? "default" : "secondary"}>
                                                            {trainer.CompletedAt ? "Completed" : "Active"}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="settings" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Course Visibility</CardTitle>
                                            <CardDescription>Control how your course is viewed by others.</CardDescription>
                                        </div>
                                        <Badge variant={courseInfo.Status === "Published" ? "default" : "secondary"}>
                                            {courseInfo.Status}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                {courseInfo.Status === "Published" ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                <Label className="text-base">Publish Course</Label>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Make this course visible to trainers.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={courseInfo.Status === "Published"}
                                            onCheckedChange={(checked) => setCourseInfo({ ...courseInfo, Status: checked ? "Published" : "Draft" })}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-destructive/50">
                                <CardHeader>
                                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                                    <CardDescription>Irreversible actions for this course.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Warning</AlertTitle>
                                        <AlertDescription>
                                            Archiving a course will hide it from trainers but keep data. Deleting is permanent.
                                        </AlertDescription>
                                    </Alert>

                                    <div className="flex items-center justify-between pt-2">
                                        <div>
                                            <p className="font-medium">Archive Course</p>
                                            <p className="text-sm text-muted-foreground">Hide from public view.</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="text-warning hover:text-warning border-warning/50 hover:bg-warning/10"
                                            onClick={handleArchiveCourse}
                                        >
                                            <Archive className="w-4 h-4 mr-2" />
                                            Archive
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <div>
                                            <p className="font-medium text-destructive">Delete Course</p>
                                            <p className="text-sm text-muted-foreground">Permanently remove this course.</p>
                                        </div>
                                        <Button
                                            variant="destructive"
                                            onClick={handleDeleteCourse}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete Course
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main >
        </div >
    );
};

export default CourseEditor;
