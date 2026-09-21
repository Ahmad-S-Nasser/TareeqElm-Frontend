import { useState } from "react";
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
            toast({ title: "Announcement Published" });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: "Error", description: getApiError(err, "Could not publish announcement") }),
    });

    const togglePinMutation = useMutation({
        mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
            await api.put(`/Announcements/${id}/pin`, { Pinned: !pinned });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organization-announcements"] }),
        onError: (err: unknown) => toast({ variant: "destructive", title: "Error", description: getApiError(err, "Could not update announcement") }),
    });

    const handleCreate = () => {
        if (!form.title || !form.body) { toast({ variant: "destructive", title: "Missing fields" }); return; }
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
                        Announcements
                    </h1>
                    <p className="text-muted-foreground mt-1">Broadcast announcements to trainers, instructors, and departments</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2"><Plus className="w-4 h-4" /> New Announcement</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Announcement title..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Message</Label>
                                <Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Write your announcement..." rows={4} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Audience</Label>
                                    <Select value={form.audience} onValueChange={v => setForm({ ...form, audience: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Users</SelectItem>
                                            <SelectItem value="trainers">All Trainers</SelectItem>
                                            <SelectItem value="instructors">All Instructors</SelectItem>
                                            <SelectItem value="department">Specific Department</SelectItem>
                                            <SelectItem value="course">Specific Course</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(form.audience === "department" || form.audience === "course") && (
                                    <div className="space-y-2">
                                        <Label>{form.audience === "department" ? "Department" : "Course"} Name</Label>
                                        <Input value={form.audienceDetail} onChange={e => setForm({ ...form, audienceDetail: e.target.value })} placeholder="Enter name..." />
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Publish
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, "Could not load announcements.")}</CardContent></Card>
            ) : announcements.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">No announcements yet. Create one to get started.</CardContent></Card>
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
                                                    {ann.Audience === "all" ? "Everyone" :
                                                     ann.AudienceDetail ? `${ann.Audience}: ${ann.AudienceDetail}` :
                                                     ann.Audience.charAt(0).toUpperCase() + ann.Audience.slice(1)}
                                                </Badge>
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(ann.CreatedAt).toLocaleDateString()}</span>
                                                <span>by {ann.AuthorName}</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => togglePinMutation.mutate({ id: ann.Id, pinned: ann.Pinned })}>
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
