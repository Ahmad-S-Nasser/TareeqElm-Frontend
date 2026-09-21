import { useState } from "react";
import { UniversityPageLayout } from "@/components/layout/UniversityPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, Plus, Edit2, Archive, CheckCircle2, Clock, Users, BookOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import api, { getApiError } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AcademicTerm {
    Id: string;
    Name: string;
    Type: "fall" | "spring" | "summer";
    Year: number;
    StartDate: string;
    EndDate: string;
    Status: "active" | "upcoming" | "archived";
}

const typeColors = {
    fall: "bg-amber-500/10 text-amber-600 border-amber-200",
    spring: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
    summer: "bg-sky-500/10 text-sky-600 border-sky-200",
};

const statusConfig = {
    active: { label: "Active", color: "bg-emerald-500", badge: "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" },
    upcoming: { label: "Upcoming", color: "bg-primary", badge: "text-primary border-primary/20 bg-primary/5" },
    archived: { label: "Archived", color: "bg-muted-foreground", badge: "text-muted-foreground border-border bg-muted" },
};

const UniversityAcademicTerms = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [newTerm, setNewTerm] = useState({ name: "", type: "fall", year: "2026", startDate: "", endDate: "" });
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: terms = [], isLoading, isError, error } = useQuery({
        queryKey: ["academic-terms"],
        queryFn: async () => {
            const { data } = await api.get<AcademicTerm[]>("/academic-terms");
            return [...data].sort((x, y) => new Date(y.StartDate).getTime() - new Date(x.StartDate).getTime());
        },
    });

    const createMutation = useMutation({
        mutationFn: async (term: { Name: string; Type: string; Year: number; StartDate: string; EndDate: string }) => {
            await api.post("/academic-terms", term);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["academic-terms"] });
            setIsOpen(false);
            setNewTerm({ name: "", type: "fall", year: "2026", startDate: "", endDate: "" });
            toast({ title: "Term Created" });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: "Error", description: getApiError(err, "Could not create term") }),
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            await api.put(`/academic-terms/${id}/status`, { Status: status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["academic-terms"] });
            toast({ title: "Term Updated" });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: "Error", description: getApiError(err, "Could not update term") }),
    });

    const handleCreate = () => {
        if (!newTerm.name || !newTerm.startDate || !newTerm.endDate) {
            toast({ variant: "destructive", title: "Missing fields" });
            return;
        }
        createMutation.mutate({
            Name: newTerm.name, Type: newTerm.type, Year: parseInt(newTerm.year),
            StartDate: newTerm.startDate, EndDate: newTerm.endDate,
        });
    };

    return (
        <UniversityPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        Academic Terms
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage semesters, assign courses, and track academic periods</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2"><Plus className="w-4 h-4" /> New Term</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Academic Term</DialogTitle>
                            <DialogDescription>Set up a new semester or term period.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Term Name</Label>
                                <Input placeholder="e.g. Fall 2026" value={newTerm.name} onChange={e => setNewTerm({ ...newTerm, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select value={newTerm.type} onValueChange={v => setNewTerm({ ...newTerm, type: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fall">Fall Semester</SelectItem>
                                            <SelectItem value="spring">Spring Semester</SelectItem>
                                            <SelectItem value="summer">Summer Term</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Year</Label>
                                    <Input type="number" value={newTerm.year} onChange={e => setNewTerm({ ...newTerm, year: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input type="date" value={newTerm.startDate} onChange={e => setNewTerm({ ...newTerm, startDate: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input type="date" value={newTerm.endDate} onChange={e => setNewTerm({ ...newTerm, endDate: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Term
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: "Active Terms", value: terms.filter((t) => t.Status === "active").length, icon: CheckCircle2, color: "text-emerald-500" },
                    { label: "Upcoming", value: terms.filter((t) => t.Status === "upcoming").length, icon: Clock, color: "text-primary" },
                    { label: "Archived", value: terms.filter((t) => t.Status === "archived").length, icon: Archive, color: "text-muted-foreground" },
                ].map(s => (
                    <Card key={s.label} className="border-border/50">
                        <CardContent className="p-5 flex items-center gap-4">
                            <s.icon className={cn("w-8 h-8", s.color)} />
                            <div>
                                <p className="text-2xl font-black">{s.value}</p>
                                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, "Could not load academic terms.")}</CardContent></Card>
            ) : terms.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">No academic terms yet. Create one to get started.</CardContent></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {terms.map((term) => {
                        const sc = statusConfig[term.Status as keyof typeof statusConfig] || statusConfig.upcoming;
                        const tc = typeColors[term.Type as keyof typeof typeColors] || typeColors.fall;
                        return (
                            <Card key={term.Id} className="border-border/50 hover:shadow-md transition-all">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className={cn("text-xs font-semibold", tc)}>
                                                {term.Type.charAt(0).toUpperCase() + term.Type.slice(1)}
                                            </Badge>
                                            <CardTitle className="text-base">{term.Name}</CardTitle>
                                        </div>
                                        <Badge variant="outline" className={cn("text-xs", sc.badge)}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full mr-1.5", sc.color)} />
                                            {sc.label}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(term.StartDate).toLocaleDateString()} — {new Date(term.EndDate).toLocaleDateString()}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="flex-1 gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</Button>
                                        {term.Status === "active" ? (
                                            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-muted-foreground" onClick={() => updateStatusMutation.mutate({ id: term.Id, status: "archived" })}>
                                                <Archive className="w-3.5 h-3.5" /> Archive
                                            </Button>
                                        ) : term.Status === "upcoming" ? (
                                            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-emerald-600" onClick={() => updateStatusMutation.mutate({ id: term.Id, status: "active" })}>
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Activate
                                            </Button>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </UniversityPageLayout>
    );
};

export default UniversityAcademicTerms;
