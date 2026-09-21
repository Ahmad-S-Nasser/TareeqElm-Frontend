import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { FolderOpen, Search, FileText, Video, Image, Presentation, Upload, Download, Eye, Clock, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ContentItem {
    Id: string;
    Name: string;
    FileType: string;
    Department: string | null;
    CourseName: string | null;
    FilePath: string;
    FileSizeBytes: number;
    UploadedByName: string;
    CreatedAt: string;
}
interface DepartmentSummary { Id: string; Name: string }

const apiOrigin = (import.meta.env.VITE_API_URL || "https://localhost:9889/api").replace(/\/api\/?$/, "");
const fileUrl = (path: string) => `${apiOrigin}${path.startsWith("/") ? "" : "/"}${path}`;
import { useToast } from "@/hooks/use-toast";

const typeIcon: Record<string, React.ElementType> = { pdf: FileText, video: Video, image: Image, presentation: Presentation, document: FileText };
const typeColor: Record<string, string> = {
    pdf: "text-destructive bg-destructive/10",
    video: "text-violet-500 bg-violet-500/10",
    image: "text-sky-500 bg-sky-500/10",
    presentation: "text-amber-500 bg-amber-500/10",
    document: "text-primary bg-primary/10",
};

const OrganizationContentLibrary = () => {
    const [search, setSearch] = useState("");
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadDept, setUploadDept] = useState("General");
    const [uploadCourse, setUploadCourse] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation(["organization", "common"]);
    const { formatDate, formatNumber } = useFormatters();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return t("library.size.bytes", { value: formatNumber(bytes) });
        const opts = { maximumFractionDigits: 1 };
        if (bytes < 1024 * 1024) return t("library.size.kb", { value: formatNumber(bytes / 1024, opts) });
        return t("library.size.mb", { value: formatNumber(bytes / (1024 * 1024), opts) });
    };
    const deptLabel = (name: string | null) => (!name || name === "General" ? t("library.general") : name);

    const { data: content = [], isLoading, isError, error } = useQuery({
        queryKey: ["content-library"],
        queryFn: async () => (await api.get<ContentItem[]>("/content-library")).data,
    });

    const { data: departmentList = [] } = useQuery({
        queryKey: ["departments"],
        queryFn: async () => (await api.get<DepartmentSummary[]>("/Departments")).data,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => { await api.delete(`/content-library/${id}`); },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["content-library"] });
            toast({ title: t("library.deleted") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("library.deleteFailed"), description: getApiError(err, t("library.deleteError")) }),
    });

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        let ok = 0;
        const failures: string[] = [];
        for (const file of Array.from(files)) {
            try {
                const form = new FormData();
                form.append("file", file);
                form.append("department", uploadDept);
                form.append("courseName", uploadCourse);
                await api.post("/content-library", form, { headers: { "Content-Type": "multipart/form-data" } });
                ok++;
            } catch (err) {
                failures.push(`${file.name}: ${getApiError(err, t("library.uploadFailedShort"))}`);
            }
        }
        queryClient.invalidateQueries({ queryKey: ["content-library"] });
        if (ok > 0) toast({ title: t("library.uploaded"), description: t("library.uploadedDesc", { count: ok }) });
        if (failures.length > 0) toast({ variant: "destructive", title: t("library.uploadFailed"), description: failures.join("\n") });
        if (failures.length === 0) setIsUploadOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setUploading(false);
    };

    const filtered = content.filter((c) =>
        c.Name.toLowerCase().includes(search.toLowerCase()) ||
        (c.Department || "").toLowerCase().includes(search.toLowerCase())
    );

    const departments = [...new Set(content.map((c) => c.Department || "General"))];

    return (
        <OrganizationPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <FolderOpen className="w-5 h-5 text-primary" />
                        </div>
                        {t("library.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("library.subtitle")}</p>
                </div>
                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2"><Upload className="w-4 h-4" /> {t("library.upload")}</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{t("library.uploadFiles")}</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>{t("library.department")}</Label>
                                <Select value={uploadDept} onValueChange={setUploadDept}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="General">{t("library.general")}</SelectItem>
                                        {departmentList.filter(d => d.Name !== "General").map(d => (
                                            <SelectItem key={d.Id} value={d.Name}>{d.Name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("library.courseOptional")}</Label>
                                <Input value={uploadCourse} onChange={e => setUploadCourse(e.target.value)} placeholder={t("library.coursePlaceholder")} />
                            </div>
                            <div
                                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm font-medium">{t("library.selectFiles")}</p>
                                <p className="text-xs text-muted-foreground mt-1">{t("library.allowed", { size: formatNumber(20) })}</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov"
                                onChange={e => handleUpload(e.target.files)}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>{t("common:actions.cancel")}</Button>
                            {uploading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> {t("library.uploading")}</div>}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                    { label: t("library.stats.files"), value: formatNumber(content.length) },
                    { label: t("library.stats.departments"), value: formatNumber(departments.length) },
                    { label: t("library.stats.size"), value: formatFileSize(content.reduce((sum, c) => sum + (c.FileSizeBytes || 0), 0)) },
                    { label: t("library.stats.types"), value: formatNumber([...new Set(content.map((c) => c.FileType))].length) },
                ].map(s => (
                    <Card key={s.label} className="border-border/50">
                        <CardContent className="p-4">
                            <p className="text-xl font-black">{s.value}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="relative max-w-md">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder={t("library.search")} className="ps-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, t("library.loadFailed"))}</CardContent></Card>
            ) : filtered.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">{t("library.empty")}</CardContent></Card>
            ) : (
                <Tabs defaultValue="all">
                    <TabsList>
                        <TabsTrigger value="all">{t("common:labels.all")}</TabsTrigger>
                        {departments.map(d => <TabsTrigger key={d} value={d}>{deptLabel(d)}</TabsTrigger>)}
                    </TabsList>
                    {["all", ...departments].map(tab => (
                        <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
                            {filtered.filter((c) => tab === "all" || (c.Department || "General") === tab).map((item) => {
                                const Icon = typeIcon[item.FileType] || FileText;
                                return (
                                    <Card key={item.Id} className="border-border/50 hover:shadow-md transition-all">
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", typeColor[item.FileType] || "text-primary bg-primary/10")}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm truncate">{item.Name}</p>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                                    <Badge variant="outline" className="text-xs">{deptLabel(item.Department)}</Badge>
                                                    {item.CourseName && <span>{item.CourseName}</span>}
                                                    <span>{t(`library.types.${item.FileType}`, { defaultValue: t("library.types.other") })} · {formatFileSize(item.FileSizeBytes)}</span>
                                                    <span>{t("library.uploadedBy", { name: item.UploadedByName ?? t("common:deletedUser") })}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(item.CreatedAt)}</span>
                                                                                                <Button variant="ghost" size="icon" asChild>
                                                    <a href={fileUrl(item.FilePath)} target="_blank" rel="noopener noreferrer" aria-label={t("library.view")} title={t("library.view")}><Eye className="w-4 h-4" /></a>
                                                </Button>
                                                <Button variant="ghost" size="icon" asChild>
                                                    <a href={fileUrl(item.FilePath)} download aria-label={t("common:actions.download")} title={t("common:actions.download")}><Download className="w-4 h-4" /></a>
                                                </Button>
                                                <Button variant="ghost" size="icon" disabled={deleteMutation.isPending} aria-label={t("common:actions.delete")} title={t("common:actions.delete")} onClick={() => { if (window.confirm(t("library.confirmDelete", { name: item.Name }))) deleteMutation.mutate(item.Id); }}>
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </TabsContent>
                    ))}
                </Tabs>
            )}
        </OrganizationPageLayout>
    );
};

export default OrganizationContentLibrary;
