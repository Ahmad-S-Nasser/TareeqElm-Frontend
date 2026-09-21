import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Megaphone, Plus, Users, BookOpen, Building2, Clock, Pin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Announcement {
    Id: string;
    Title: string;
    Body: string;
    Audience: string;
    AudienceDetail: string | null;
    Pinned: boolean;
    AuthorName: string;
    CreatedAt: string;
}

const audienceIcon: Record<string, React.ElementType> = { all: Users, trainers: Users, instructors: Users, department: Building2, course: BookOpen };
const audienceColor: Record<string, string> = {
    all: "text-primary border-primary/20 bg-primary/5",
    trainers: "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20",
    instructors: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20",
    department: "text-sky-600 border-sky-200 bg-sky-50 dark:bg-sky-950/20",
    course: "text-violet-600 border-violet-200 bg-violet-50 dark:bg-violet-950/20",
};

const OrganizationAnnouncements = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [form, setForm] = useState({ title: "", body: "", audience: "all", audienceDetail: "" });
    const { t } = useTranslation(["organization", "common"]);
    const { formatDate } = useFormatters();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: announcements = [], isLoading, isError, error } = useQuery({
        queryKey: ["organization-announcements"],
        queryFn: async () => (await api.get<Announcement[]>("/Announcements")).data,
    });

    const createMutation = useMutation({
        mutationFn: async (ann: { Title: string; Body: string; Audience: string; AudienceDetail?: string }) => {
            await api.post("/Announcements", ann);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["organization-announcements"] });
            setIsOpen(false);
            setForm({ title: "", body: "", audience: "all", audienceDetail: "" });
            toast({ title: t("announcements.published") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("announcements.publishFailed")) }),
    });

    const togglePinMutation = useMutation({
        mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
            await api.put(`/Announcements/${id}/pin`, { Pinned: !pinned });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization-announcements"] }),
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("announcements.updateFailed")) }),
    });

    const handleCreate = () => {
        if (!form.title || !form.body) { toast({ variant: "destructive", title: t("announcements.missingFields") }); return; }
        createMutation.mutate({
            Title: form.title, Body: form.body, Audience: form.audience,
            AudienceDetail: form.audienceDetail || undefined,
        });
    };

    return (
        <OrganizationPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Megaphone className="w-5 h-5 text-primary" />
                        </div>
                        {t("announcements.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("announcements.subtitle")}</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2"><Plus className="w-4 h-4" /> {t("announcements.new")}</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader><DialogTitle>{t("announcements.createTitle")}</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>{t("announcements.titleLabel")}</Label>
                                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t("announcements.titlePlaceholder")} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("announcements.message")}</Label>
                                <Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder={t("announcements.messagePlaceholder")} rows={4} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t("announcements.audience")}</Label>
                                    <Select value={form.audience} onValueChange={v => setForm({ ...form, audience: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">{t("announcements.audiences.all")}</SelectItem>
                                            <SelectItem value="trainers">{t("announcements.audiences.trainers")}</SelectItem>
                                            <SelectItem value="instructors">{t("announcements.audiences.instructors")}</SelectItem>
                                            <SelectItem value="department">{t("announcements.audiences.department")}</SelectItem>
                                            <SelectItem value="course">{t("announcements.audiences.course")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(form.audience === "department" || form.audience === "course") && (
                                    <div className="space-y-2">
                                        <Label>{form.audience === "department" ? t("announcements.departmentName") : t("announcements.courseName")}</Label>
                                        <Input value={form.audienceDetail} onChange={e => setForm({ ...form, audienceDetail: e.target.value })} placeholder={t("announcements.namePlaceholder")} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>{t("common:actions.cancel")}</Button>
                            <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                {t("announcements.publish")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, t("announcements.loadFailed"))}</CardContent></Card>
            ) : announcements.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">{t("announcements.empty")}</CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {announcements.map((ann) => {
                        const AudIcon = audienceIcon[ann.Audience] || Users;
                        return (
                            <Card key={ann.Id} className={cn("border-border/50 transition-all", ann.Pinned && "border-primary/30 bg-primary/[0.02]")}>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {ann.Pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                                                <p className="font-bold text-sm">{ann.Title}</p>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{ann.Body}</p>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <Badge variant="outline" className={cn("text-xs gap-1", audienceColor[ann.Audience] || "")}>
                                                    <AudIcon className="w-3 h-3" />
                                                    {ann.Audience === "all" ? t("announcements.everyone") :
                                                     ann.AudienceDetail ? t("announcements.audienceWithDetail", { audience: t(`announcements.audienceShort.${ann.Audience}`, { defaultValue: ann.Audience }), detail: ann.AudienceDetail }) :
                                                     t(`announcements.audienceShort.${ann.Audience}`, { defaultValue: ann.Audience })}
                                                </Badge>
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(ann.CreatedAt)}</span>
                                                <span>{t("announcements.by", { name: ann.AuthorName ?? t("common:deletedUser") })}</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="shrink-0" aria-label={ann.Pinned ? t("announcements.unpin") : t("announcements.pin")} title={ann.Pinned ? t("announcements.unpin") : t("announcements.pin")} onClick={() => togglePinMutation.mutate({ id: ann.Id, pinned: ann.Pinned })}>
                                            <Pin className={cn("w-4 h-4", ann.Pinned ? "text-primary fill-primary" : "text-muted-foreground")} />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </OrganizationPageLayout>
    );
};

export default OrganizationAnnouncements;
