import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Chapter, Lesson, LessonType, LegacyLessonType, normalizeLessonType, lessonTypeLabel } from "@/hooks/useCourseEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, GripVertical, Video, FileText, CheckSquare, ClipboardList, MousePointerClick, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Accepts both API values ('Video', 'Reading', ...) and older lowercase ones.
const LessonTypeIcon = ({ type }: { type: LessonType | LegacyLessonType }) => {
    switch (normalizeLessonType(type)) {
        case 'Video': return <Video className="w-4 h-4 text-blue-500" />;
        case 'Quiz': return <CheckSquare className="w-4 h-4 text-green-500" />;
        case 'Assignment': return <ClipboardList className="w-4 h-4 text-purple-500" />;
        case 'Interactive': return <MousePointerClick className="w-4 h-4 text-pink-500" />;
        default: return <FileText className="w-4 h-4 text-orange-500" />;
    }
};

interface ChapterListProps {
    chapters: Chapter[];
    onUpdateChapters: (chapters: Chapter[]) => void;
    onUploadMedia: (file: File, path: string) => Promise<string | null>;
}

export const ChapterList = ({ chapters, onUpdateChapters, onUploadMedia }: ChapterListProps) => {
    const { t } = useTranslation("instructor");
    const [newChapterTitle, setNewChapterTitle] = useState("");
    const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);

    // Lesson Form State
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const [isAddLessonOpen, setIsAddLessonOpen] = useState(false);
    const [newLesson, setNewLesson] = useState<{ title: string, type: LessonType, content: string, videoUrl: string }>({
        title: "",
        type: "Video",
        content: "",
        videoUrl: ""
    });
    const [uploadingVideo, setUploadingVideo] = useState(false);

    const handleAddChapter = () => {
        if (!newChapterTitle) return;
        const newChapter: Chapter = {
            Id: crypto.randomUUID(),
            Title: newChapterTitle,
            Lessons: []
        };
        onUpdateChapters([...chapters, newChapter]);
        setNewChapterTitle("");
        setIsAddChapterOpen(false);
    };

    const handleDeleteChapter = (id: string) => {
        onUpdateChapters(chapters.filter(c => c.Id !== id));
    };

    const handleAddLesson = () => {
        if (!activeChapterId || !newLesson.title) return;

        const updatedChapters = chapters.map(ch => {
            if (ch.Id === activeChapterId) {
                return {
                    ...ch,
                    Lessons: [...ch.Lessons, {
                        Id: crypto.randomUUID(),
                        Title: newLesson.title,
                        LessonType: newLesson.type,
                        Content: newLesson.content,
                        VideoUrl: newLesson.videoUrl
                    }]
                };
            }
            return ch;
        });

        onUpdateChapters(updatedChapters);
        setNewLesson({ title: "", type: "Video", content: "", videoUrl: "" });
        setIsAddLessonOpen(false);
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingVideo(true);
        const url = await onUploadMedia(file, 'lessons');
        if (url) {
            setNewLesson(prev => ({ ...prev, videoUrl: url }));
        }
        setUploadingVideo(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">{t("chapters.title")}</h3>
                <Dialog open={isAddChapterOpen} onOpenChange={setIsAddChapterOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Plus className="w-4 h-4 me-2" />
                            {t("chapters.addChapter")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t("chapters.addNewChapter")}</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-4 py-4">
                            <Label>{t("chapters.chapterTitle")}</Label>
                            <Input
                                value={newChapterTitle}
                                onChange={e => setNewChapterTitle(e.target.value)}
                                placeholder={t("chapters.chapterPlaceholder")}
                            />
                            <Button onClick={handleAddChapter}>{t("chapters.addChapter")}</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-4">
                {chapters.map((chapter) => (
                    <AccordionItem key={chapter.Id} value={chapter.Id} className="border rounded-lg px-4">
                        <div className="flex items-center py-4">
                            <GripVertical className="w-4 h-4 text-muted-foreground me-2 cursor-move" />
                            <AccordionTrigger className="hover:no-underline py-0 flex-1">
                                <span className="font-medium text-start">{chapter.Title}</span>
                                <span className="ms-2 text-xs text-muted-foreground">{t("chapters.lessonsInline", { count: chapter.Lessons.length })}</span>
                            </AccordionTrigger>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("chapters.deleteChapter")}
                                className="ms-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => { e.stopPropagation(); handleDeleteChapter(chapter.Id); }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                        <AccordionContent className="pt-0 pb-4">
                            <div className="space-y-2 ps-6">
                                {chapter.Lessons.map(lesson => (
                                    <div key={lesson.Id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                        <div className="flex items-center gap-3">
                                            <LessonTypeIcon type={lesson.LessonType} />
                                            <span className="text-sm">{lesson.Title}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t("chapters.editLesson")}>
                                            <Edit2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}

                                <Dialog open={isAddLessonOpen} onOpenChange={(open) => {
                                    if (open) setActiveChapterId(chapter.Id);
                                    setIsAddLessonOpen(open);
                                }}>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="w-full mt-2 border border-dashed">
                                            <Plus className="w-3 h-3 me-2" />
                                            {t("chapters.addLesson")}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>{t("chapters.addLessonTo", { chapter: chapter.Title })}</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid gap-2">
                                                <Label>{t("chapters.lessonTitle")}</Label>
                                                <Input
                                                    value={newLesson.title}
                                                    onChange={e => setNewLesson({ ...newLesson, title: e.target.value })}
                                                    placeholder={t("chapters.lessonPlaceholder")}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label>{t("chapters.type")}</Label>
                                                <Select
                                                    value={newLesson.type}
                                                    onValueChange={(val) => setNewLesson({ ...newLesson, type: normalizeLessonType(val) })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Video">{lessonTypeLabel(t, "Video")}</SelectItem>
                                                        <SelectItem value="Reading">{lessonTypeLabel(t, "Reading")}</SelectItem>
                                                        <SelectItem value="Quiz">{lessonTypeLabel(t, "Quiz")}</SelectItem>
                                                        <SelectItem value="Assignment">{lessonTypeLabel(t, "Assignment")}</SelectItem>
                                                        <SelectItem value="Interactive">{lessonTypeLabel(t, "Interactive")}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {newLesson.type === 'Video' && (
                                                <div className="grid gap-2">
                                                    <Label>{t("chapters.videoSource")}</Label>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" className="relative" disabled={uploadingVideo}>
                                                            <Upload className="w-4 h-4 me-2" />
                                                            {uploadingVideo ? t("chapters.uploading") : t("chapters.uploadVideo")}
                                                            <input
                                                                type="file"
                                                                accept="video/*"
                                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                                onChange={handleVideoUpload}
                                                                disabled={uploadingVideo}
                                                            />
                                                        </Button>
                                                        <Input
                                                            value={newLesson.videoUrl}
                                                            onChange={e => setNewLesson({ ...newLesson, videoUrl: e.target.value })}
                                                            placeholder={t("chapters.videoUrlPlaceholder")}
                                                            className="flex-1"
                                                            dir="ltr"
                                                        />
                                                    </div>
                                                    {newLesson.videoUrl && (
                                                        <p className="text-xs text-muted-foreground truncate">{t("chapters.selected", { url: newLesson.videoUrl })}</p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="grid gap-2">
                                                <Label>{t("chapters.content")}</Label>
                                                <textarea
                                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    value={newLesson.content}
                                                    onChange={e => setNewLesson({ ...newLesson, content: e.target.value })}
                                                    placeholder={t("chapters.contentPlaceholder")}
                                                />
                                            </div>

                                            <Button onClick={handleAddLesson} disabled={!newLesson.title}>{t("chapters.addLesson")}</Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>

            {chapters.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                    <p className="text-muted-foreground mb-4">{t("chapters.empty")}</p>
                    <Button variant="outline" onClick={() => setIsAddChapterOpen(true)}>
                        <Plus className="w-4 h-4 me-2" />
                        {t("chapters.addFirst")}
                    </Button>
                </div>
            )}
        </div>
    );
};
