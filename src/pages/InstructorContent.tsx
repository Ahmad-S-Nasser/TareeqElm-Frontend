import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { getApiError } from "@/lib/api";
import { InstructorSidebar, InstructorSidebarContent } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, FileText, Image as ImageIcon, Video, Presentation, Folder, Plus, Search, MoreVertical, Trash2, Download, Loader2, AlertCircle } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMyCoursesQuery } from "@/hooks/useCourses";
import {
    useContentLibraryQuery,
    useUploadContentItem,
    useDeleteContentItem,
    useDownloadContentItem,
    type ContentItem,
} from "@/hooks/useContentLibrary";

const CONTENT_TYPES = ["pdf", "video", "image", "presentation", "document"] as const;

const typeIcon: Record<string, React.ElementType> = {
    pdf: FileText, video: Video, image: ImageIcon, presentation: Presentation, document: FileText,
};
const typeColor: Record<string, string> = {
    pdf: "text-destructive", video: "text-red-500", image: "text-purple-500", presentation: "text-amber-500", document: "text-blue-500",
};

const InstructorContent = () => {
    const { t } = useTranslation("instructor");
    const { formatNumber, formatDate } = useFormatters();
    const { toast } = useToast();
    const { user } = useAuth();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [courseFilter, setCourseFilter] = useState<string>("all");

    // Debounce the free-text search so the server is not queried on every keystroke.
    useEffect(() => {
        const id = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(id);
    }, [searchInput]);

    const { data: courses = [] } = useMyCoursesQuery();
    const { data: items = [], isLoading, isError, error } = useContentLibraryQuery({
        search: search || undefined,
        courseId: courseFilter !== "all" ? courseFilter : undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
    });

    const uploadItem = useUploadContentItem();
    const deleteItem = useDeleteContentItem();
    const { download, downloadingId } = useDownloadContentItem();

    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadCourseId, setUploadCourseId] = useState<string>("");
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingDelete, setPendingDelete] = useState<ContentItem | null>(null);

    const resetUploadDialog = () => {
        setUploadFile(null);
        setUploadCourseId("");
        setUploadProgress(0);
        setUploadError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        if (!uploadCourseId) {
            setUploadError(t("content.courseRequired"));
            return;
        }
        setUploadError(null);
        setUploadProgress(0);
        try {
            await uploadItem.mutateAsync({
                file: uploadFile,
                courseId: uploadCourseId,
                onProgress: setUploadProgress,
            });
            toast({ title: t("content.uploadSuccess"), description: t("content.uploadSuccessDesc", { name: uploadFile.name }) });
            setUploadOpen(false);
            resetUploadDialog();
        } catch (err) {
            setUploadError(getApiError(err, t("content.uploadFailedDesc")));
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete) return;
        try {
            await deleteItem.mutateAsync(pendingDelete.Id);
            toast({ title: t("content.deleted") });
        } catch (err) {
            toast({ variant: "destructive", title: t("content.deleteFailed"), description: getApiError(err) });
        } finally {
            setPendingDelete(null);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return t("content.units.B", { value: formatNumber(bytes) });
        if (bytes < 1024 * 1024) return t("content.units.KB", { value: formatNumber(bytes / 1024, { maximumFractionDigits: 1 }) });
        return t("content.units.MB", { value: formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 }) });
    };

    return (
        <div className="min-h-screen bg-background">
            <InstructorSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Instructor"
                mobileSidebar={<InstructorSidebarContent />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
                "ms-0"
            )}>
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">{t("content.title")}</h1>
                            <p className="text-muted-foreground mt-1">
                                {t("content.subtitle")}
                            </p>
                        </div>
                        <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetUploadDialog(); }}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Upload className="w-4 h-4 me-2" /> {t("content.uploadNew")}
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>{t("content.uploadDialog.title")}</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="content-course">{t("content.uploadDialog.course")}</Label>
                                        <Select value={uploadCourseId} onValueChange={setUploadCourseId}>
                                            <SelectTrigger id="content-course"><SelectValue placeholder={t("content.uploadDialog.coursePlaceholder")} /></SelectTrigger>
                                            <SelectContent>
                                                {courses.map((c) => (
                                                    <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {courses.length === 0 && (
                                            <p className="text-xs text-muted-foreground">{t("content.uploadDialog.noCourses")}</p>
                                        )}
                                    </div>
                                    <div
                                        className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm font-medium">{uploadFile ? uploadFile.name : t("content.uploadDialog.selectFile")}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{t("content.uploadDialog.allowed")}</p>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.pptx,.docx,.xlsx,.txt,.md,.csv,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm"
                                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                                    />
                                    {uploadItem.isPending && (
                                        <div className="space-y-1">
                                            <Progress value={uploadProgress} />
                                            <p className="text-xs text-muted-foreground text-center">{t("content.uploadDialog.progress", { percent: formatNumber(uploadProgress) })}</p>
                                        </div>
                                    )}
                                    {uploadError && (
                                        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span>{uploadError}</span>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploadItem.isPending}>{t("content.cancel")}</Button>
                                    <Button onClick={handleUpload} disabled={!uploadFile || uploadItem.isPending}>
                                        {uploadItem.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Upload className="w-4 h-4 me-2" />}
                                        {t("content.uploadDialog.submit")}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Card className="min-h-[500px]">
                        <CardHeader className="pb-4 border-b space-y-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <CardTitle>{t("content.library")}</CardTitle>
                                <div className="relative w-full sm:w-72" dir="auto">
                                    <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={t("content.searchPlaceholder")}
                                        className="ps-8"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t("content.filters.allTypes")}</SelectItem>
                                        {CONTENT_TYPES.map((type) => (
                                            <SelectItem key={type} value={type}>{t(`content.types.${type}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={courseFilter} onValueChange={setCourseFilter}>
                                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t("content.filters.allCourses")}</SelectItem>
                                        {courses.map((c) => (
                                            <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                            ) : isError ? (
                                <div className="text-center py-16 text-destructive">{getApiError(error, t("content.loadFailed"))}</div>
                            ) : items.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground">
                                    <Folder className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                    {t("content.empty")}
                                </div>
                            ) : (
                                <ScrollArea className="h-[500px]">
                                    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-6">
                                        {items.map((item) => {
                                            const Icon = typeIcon[item.FileType] ?? FileText;
                                            const canDelete = !item.UploadedById || item.UploadedById === user?.Id;
                                            return (
                                                <div key={item.Id} className="group relative border rounded-lg p-4 hover:shadow-md transition-shadow bg-card aspect-square flex flex-col justify-between">
                                                    <div className="flex flex-col items-center justify-center flex-1 space-y-3">
                                                        <Icon className={cn("w-8 h-8", typeColor[item.FileType] ?? "text-muted-foreground")} />
                                                        <p className="font-medium text-sm text-center line-clamp-2 break-all">
                                                            {item.Name}
                                                        </p>
                                                        {item.CourseTitle && (
                                                            <p className="text-xs text-muted-foreground text-center line-clamp-1">{item.CourseTitle}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t mt-2">
                                                        <span>{formatSize(item.FileSizeBytes)}</span>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t("content.moreActions")}>
                                                                    <MoreVertical className="w-3 h-3" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => download(item)} disabled={downloadingId === item.Id}>
                                                                    <Download className="w-4 h-4 me-2" /> {t("content.download")}
                                                                </DropdownMenuItem>
                                                                {canDelete && (
                                                                    <DropdownMenuItem className="text-destructive" onClick={() => setPendingDelete(item)}>
                                                                        <Trash2 className="w-4 h-4 me-2" /> {t("content.delete")}
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <p className="absolute top-1 end-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {formatDate(item.CreatedAt)}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>

            <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("content.confirmDeleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete && t("content.confirmDeleteDesc", { name: pendingDelete.Name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("content.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {t("content.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default InstructorContent;
