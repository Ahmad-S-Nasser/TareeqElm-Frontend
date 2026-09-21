import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
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
import { useFormatters } from "@/lib/format";
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
    active: { color: "bg-emerald-500", badge: "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" },
    upcoming: { color: "bg-primary", badge: "text-primary border-primary/20 bg-primary/5" },
    archived: { color: "bg-muted-foreground", badge: "text-muted-foreground border-border bg-muted" },
};

const OrganizationAcademicTerms = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [newTerm, setNewTerm] = useState({ name: "", type: "fall", year: "2026", startDate: "", endDate: "" });
    const { t } = useTranslation(["organization", "common"]);
    const { formatDate, formatNumber } = useFormatters();
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
            toast({ title: t("terms.created") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("terms.createFailed")) }),
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            await api.put(`/academic-terms/${id}/status`, { Status: status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["academic-terms"] });
            toast({ title: t("terms.updated") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("terms.updateFailed")) }),
    });

    const handleCreate = () => {
        if (!newTerm.name || !newTerm.startDate || !newTerm.endDate) {
            toast({ variant: "destructive", title: t("terms.missingFields") });
            return;
        }
        createMutation.mutate({
            Name: newTerm.name, Type: newTerm.type, Year: parseInt(newTerm.year),
            StartDate: newTerm.startDate, EndDate: newTerm.endDate,
        });
    };

    return (
        <OrganizationPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        {t("terms.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("terms.subtitle")}</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2"><Plus className="w-4 h-4" /> {t("terms.newTerm")}</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t("terms.createTitle")}</DialogTitle>
                            <DialogDescription>{t("terms.createDescription")}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>{t("terms.termName")}</Label>
                                <Input placeholder={t("terms.termNamePlaceholder")} value={newTerm.name} onChange={e => setNewTerm({ ...newTerm, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t("terms.type")}</Label>
                                    <Select value={newTerm.type} onValueChange={v => setNewTerm({ ...newTerm, type: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fall">{t("terms.types.fall")}</SelectItem>
                                            <SelectItem value="spring">{t("terms.types.spring")}</SelectItem>
                                            <SelectItem value="summer">{t("terms.types.summer")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("terms.year")}</Label>
                                    <Input type="number" value={newTerm.year} onChange={e => setNewTerm({ ...newTerm, year: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t("terms.startDate")}</Label>
                                    <Input type="date" value={newTerm.startDate} onChange={e => setNewTerm({ ...newTerm, startDate: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("terms.endDate")}</Label>
                                    <Input type="date" value={newTerm.endDate} onChange={e => setNewTerm({ ...newTerm, endDate: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>{t("common:actions.cancel")}</Button>
                            <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                {t("terms.createTerm")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: t("terms.stats.active"), value: formatNumber(terms.filter((x) => x.Status === "active").length), icon: CheckCircle2, color: "text-emerald-500" },
                    { label: t("terms.stats.upcoming"), value: formatNumber(terms.filter((x) => x.Status === "upcoming").length), icon: Clock, color: "text-primary" },
                    { label: t("terms.stats.archived"), value: formatNumber(terms.filter((x) => x.Status === "archived").length), icon: Archive, color: "text-muted-foreground" },
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
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, t("terms.loadFailed"))}</CardContent></Card>
            ) : terms.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">{t("terms.empty")}</CardContent></Card>
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
                                                {t(`terms.types.${term.Type}`, { defaultValue: term.Type })}
                                            </Badge>
                                            <CardTitle className="text-base">{term.Name}</CardTitle>
                                        </div>
                                        <Badge variant="outline" className={cn("text-xs", sc.badge)}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full me-1.5", sc.color)} />
                                            {t(`terms.status.${term.Status}`, { defaultValue: t("terms.status.upcoming") })}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        {t("terms.dateRange", { start: formatDate(term.StartDate, { timeZone: "UTC" }), end: formatDate(term.EndDate, { timeZone: "UTC" }) })}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="flex-1 gap-1.5"><Edit2 className="w-3.5 h-3.5" /> {t("common:actions.edit")}</Button>
                                        {term.Status === "active" ? (
                                            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-muted-foreground" onClick={() => updateStatusMutation.mutate({ id: term.Id, status: "archived" })}>
                                                <Archive className="w-3.5 h-3.5" /> {t("terms.archive")}
                                            </Button>
                                        ) : term.Status === "upcoming" ? (
                                            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-emerald-600" onClick={() => updateStatusMutation.mutate({ id: term.Id, status: "active" })}>
                                                <CheckCircle2 className="w-3.5 h-3.5" /> {t("terms.activate")}
                                            </Button>
                                        ) : null}
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

export default OrganizationAcademicTerms;
