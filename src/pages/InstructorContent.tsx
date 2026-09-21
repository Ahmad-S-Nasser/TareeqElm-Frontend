import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { InstructorSidebar, InstructorSidebarContent } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Image as ImageIcon, Video, Folder, Plus, Search, MoreVertical, Trash2, Download } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const InstructorContent = () => {
    const { t } = useTranslation("instructor");
    const { formatNumber } = useFormatters();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Mock stored files
    const [files] = useState([
        { id: 1, name: "Advanced_React_Guide.pdf", type: "document", size: 2.4, unit: "MB", date: "2024-03-10" },
        { id: 2, name: "Intro_Thumbnail.png", type: "image", size: 1.1, unit: "MB", date: "2024-03-12" },
        { id: 3, name: "Lecture_1_Recording.mp4", type: "video", size: 450, unit: "MB", date: "2024-03-15" },
        { id: 4, name: "Quiz_Assets.zip", type: "archive", size: 15, unit: "MB", date: "2024-03-18" },
        { id: 5, name: "Course_Syllabus_v2.docx", type: "document", size: 156, unit: "KB", date: "2024-03-20" },
    ]);

    const getIcon = (type: string) => {
        switch (type) {
            case "document": return <FileText className="w-8 h-8 text-blue-500" />;
            case "image": return <ImageIcon className="w-8 h-8 text-purple-500" />;
            case "video": return <Video className="w-8 h-8 text-red-500" />;
            default: return <Folder className="w-8 h-8 text-yellow-500" />;
        }
    };

    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
                        <Button>
                            <Upload className="w-4 h-4 me-2" /> {t("content.uploadNew")}
                        </Button>
                    </div>

                    <Card className="min-h-[500px]">
                        <CardHeader className="pb-4 border-b">
                            <div className="flex items-center justify-between">
                                <CardTitle>{t("content.library")}</CardTitle>
                                <div className="relative w-72" dir="auto">
                                    <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={t("content.searchPlaceholder")}
                                        className="ps-8"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[500px]">
                                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-6">
                                    {/* Upload Placeholder */}
                                    <div className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer aspect-square">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                                            <Plus className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium">{t("content.uploadFile")}</p>
                                    </div>

                                    {/* File Items */}
                                    {filteredFiles.map((file) => (
                                        <div key={file.id} className="group relative border rounded-lg p-4 hover:shadow-md transition-shadow bg-card aspect-square flex flex-col justify-between">
                                            <div className="flex flex-col items-center justify-center flex-1 space-y-3">
                                                {getIcon(file.type)}
                                                <p className="font-medium text-sm text-center line-clamp-2 break-all">
                                                    {file.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t mt-2">
                                                <span>{t(`content.units.${file.unit}`, { value: formatNumber(file.size) })}</span>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t("content.moreActions")}>
                                                            <MoreVertical className="w-3 h-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem>
                                                            <Download className="w-4 h-4 me-2" /> {t("content.download")}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive">
                                                            <Trash2 className="w-4 h-4 me-2" /> {t("content.delete")}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default InstructorContent;
