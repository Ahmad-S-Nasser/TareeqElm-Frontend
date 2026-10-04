import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarRange, Plus, Edit2, Trash2, Archive, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useOrganizationProfile } from "@/hooks/useOrganization";
import {
    ACADEMIC_YEAR_STATUSES,
    useAcademicYearsQuery,
    useDeleteAcademicYear,
    useSaveAcademicYear,
    type AcademicYear,
    type AcademicYearStatus,
} from "@/hooks/useAcademicYears";

const statusConfig: Record<AcademicYearStatus, { color: string; badge: string }> = {
    active: { color: "bg-emerald-500", badge: "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" },
    upcoming: { color: "bg-primary", badge: "text-primary border-primary/20 bg-primary/5" },
    archived: { color: "bg-muted-foreground", badge: "text-muted-foreground border-border bg-muted" },
};

const emptyForm = { name: "", startDate: "", endDate: "", status: "upcoming" as AcademicYearStatus };

/** "2026-09-01T00:00:00Z" -> "2026-09-01" for a date input. */
const toDateInput = (iso: string) => (iso ? iso.slice(0, 10) : "");

const OrganizationAcademicYears = () => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatDate, formatNumber } = useFormatters();
    const { toast } = useToast();
    const { can } = usePermissions();
    const { profile, isSchool, isFetched } = useOrganizationProfile();
    // A School tenant, or Admin (no tenant of its own: the API answers 204 and platform-level rows are allowed).
    const canManage = can(PERMISSIONS.academicStructureManage) && (isSchool || (isFetched && profile === null));

    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);

    const { data: years = [], isLoading, isError, error } = useAcademicYearsQuery();
    const saveMutation = useSaveAcademicYear();
    const deleteMutation = useDeleteAcademicYear();

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setIsOpen(true); };
    const openEdit = (year: AcademicYear) => {
        setEditingId(year.Id);
        setForm({ name: year.Name, startDate: toDateInput(year.StartDate), endDate: toDateInput(year.EndDate), status: year.Status });
        setIsOpen(true);
    };

    const save = (id: string | null, input: { Name: string; StartDate: string; EndDate: string; Status: AcademicYearStatus }, onDone?: () => void) =>
        saveMutation.mutate({ id: id ?? undefined, input }, {
            onSuccess: () => { onDone?.(); toast({ title: t(id ? "academicYears.updated" : "academicYears.created") }); },
            onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("academicYears.saveFailed")) }),
        });

    const handleSubmit = () => {
        if (!form.name.trim() || !form.startDate || !form.endDate) {
            toast({ variant: "destructive", title: t("academicYears.missingFields") });
            return;
        }
        if (form.endDate <= form.startDate) {
            toast({ variant: "destructive", title: t("academicYears.endBeforeStart") });
            return;
        }
        save(editingId, { Name: form.name.trim(), StartDate: form.startDate, EndDate: form.endDate, Status: form.status }, () => {
            setIsOpen(false);
            setForm(emptyForm);
        });
    };

    const setStatus = (year: AcademicYear, status: AcademicYearStatus) =>
        save(year.Id, { Name: year.Name, StartDate: year.StartDate, EndDate: year.EndDate, Status: status });

    const handleDelete = (year: AcademicYear) => {
        if (!window.confirm(t("academicYears.confirmDelete", { name: year.Name }))) return;
        deleteMutation.mutate(year.Id, {
            onSuccess: () => toast({ title: t("academicYears.deleted") }),
            onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("academicYears.deleteFailed")) }),
        });
    };

    return (
        <OrganizationPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <CalendarRange className="w-5 h-5 text-primary" />
                        </div>
                        {t("academicYears.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("academicYears.subtitle")}</p>
                </div>
                {canManage && (
                    <Button className="gap-2" onClick={openCreate}><Plus className="w-4 h-4" /> {t("academicYears.newYear")}</Button>
                )}
            </div>

            {profile && !isSchool && (
                <Card className="border-warning/40 bg-warning/5"><CardContent className="p-4 text-sm">{t("academicStructure.notEnabled")}</CardContent></Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: t("academicYears.stats.active"), value: formatNumber(years.filter((x) => x.Status === "active").length), icon: CheckCircle2, color: "text-emerald-500" },
                    { label: t("academicYears.stats.upcoming"), value: formatNumber(years.filter((x) => x.Status === "upcoming").length), icon: Clock, color: "text-primary" },
                    { label: t("academicYears.stats.archived"), value: formatNumber(years.filter((x) => x.Status === "archived").length), icon: Archive, color: "text-muted-foreground" },
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
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, t("academicYears.loadFailed"))}</CardContent></Card>
            ) : years.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">{t("academicYears.empty")}</CardContent></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {years.map((year) => {
                        const sc = statusConfig[year.Status] ?? statusConfig.upcoming;
                        return (
                            <Card key={year.Id} className="border-border/50 hover:shadow-md transition-all" data-testid="academic-year-card">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <CardTitle className="text-base">{year.Name}</CardTitle>
                                        <Badge variant="outline" className={cn("text-xs", sc.badge)}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full me-1.5", sc.color)} />
                                            {t(`academicYears.status.${year.Status}`, { defaultValue: year.Status })}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        {t("academicYears.dateRange", { start: formatDate(year.StartDate, { timeZone: "UTC" }), end: formatDate(year.EndDate, { timeZone: "UTC" }) })}
                                    </p>
                                    <div className="flex gap-4 text-xs text-muted-foreground">
                                        <span>{t("academicYears.termsCount", { count: year.TermsCount })}</span>
                                        <span>{t("academicYears.gradesCount", { count: year.GradesCount })}</span>
                                    </div>
                                    {canManage && (
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(year)}>
                                                <Edit2 className="w-3.5 h-3.5" /> {t("common:actions.edit")}
                                            </Button>
                                            {year.Status === "active" ? (
                                                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-muted-foreground" onClick={() => setStatus(year, "archived")}>
                                                    <Archive className="w-3.5 h-3.5" /> {t("academicYears.archive")}
                                                </Button>
                                            ) : year.Status === "upcoming" ? (
                                                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-emerald-600" onClick={() => setStatus(year, "active")}>
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> {t("academicYears.activate")}
                                                </Button>
                                            ) : null}
                                            <Button variant="outline" size="sm" className="gap-1.5 text-destructive" aria-label={t("common:actions.delete")} onClick={() => handleDelete(year)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t(editingId ? "academicYears.editTitle" : "academicYears.createTitle")}</DialogTitle>
                        <DialogDescription>{t("academicYears.createDescription")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="year-name">{t("academicYears.name")}</Label>
                            <Input id="year-name" placeholder={t("academicYears.namePlaceholder")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="year-start">{t("academicYears.startDate")}</Label>
                                <Input id="year-start" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year-end">{t("academicYears.endDate")}</Label>
                                <Input id="year-end" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="year-status">{t("academicYears.statusLabel")}</Label>
                            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as AcademicYearStatus })}>
                                <SelectTrigger id="year-status" aria-label={t("academicYears.statusLabel")}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ACADEMIC_YEAR_STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>{t(`academicYears.status.${s}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                            {saveMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t(editingId ? "academicYears.saveYear" : "academicYears.createYear")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OrganizationPageLayout>
    );
};

export default OrganizationAcademicYears;
