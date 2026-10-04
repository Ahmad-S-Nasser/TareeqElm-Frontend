import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { School, Plus, Edit2, Trash2, Users, BookOpen, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useOrganizationProfile } from "@/hooks/useOrganization";
import { useAcademicYearsQuery } from "@/hooks/useAcademicYears";
import { useDeleteGrade, useGradesQuery, useSaveGrade, type Grade } from "@/hooks/useGrades";

/** The "no value" sentinel: a `Select` cannot hold an empty string as a value. */
const NONE = "none";
const ALL = "all";

interface Option { Id: string; Name: string }

const emptyForm = { name: "", academicYearId: NONE, homeroomInstructorId: NONE, capacity: "", memberTrainerIds: [] as string[], courseIds: [] as string[] };

/** A scrollable checkbox list for picking several ids. */
const MultiPick = ({ label, options, selected, onChange, empty }: {
    label: string; options: Option[]; selected: string[]; onChange: (ids: string[]) => void; empty: string;
}) => (
    <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{label}</legend>
        <div className="max-h-36 overflow-y-auto rounded-md border border-border/50 p-2 space-y-1.5">
            {options.length === 0 ? (
                <p className="text-xs text-muted-foreground">{empty}</p>
            ) : options.map((o) => (
                <label key={o.Id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                        checked={selected.includes(o.Id)}
                        onCheckedChange={(checked) => onChange(checked ? [...selected, o.Id] : selected.filter((id) => id !== o.Id))}
                    />
                    {o.Name}
                </label>
            ))}
        </div>
    </fieldset>
);

const OrganizationGrades = () => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber } = useFormatters();
    const { toast } = useToast();
    const { can } = usePermissions();
    const { profile, isSchool, isFetched } = useOrganizationProfile();
    const canManage = can(PERMISSIONS.academicStructureManage) && (isSchool || (isFetched && profile === null));

    const [yearFilter, setYearFilter] = useState(ALL);
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);

    const { data: grades = [], isLoading, isError, error } = useGradesQuery(yearFilter === ALL ? undefined : yearFilter);
    const { data: years = [] } = useAcademicYearsQuery();
    const saveMutation = useSaveGrade();
    const deleteMutation = useDeleteGrade();

    // Pickers are only needed while the form is open.
    const { data: instructors = [] } = useQuery({
        queryKey: ["organization-instructors"],
        queryFn: async () => (await api.get<{ Id: string; FullName: string }[]>("/Organization/instructors")).data,
        enabled: isOpen,
    });
    const { data: trainers = [] } = useQuery({
        queryKey: ["organization-trainers"],
        queryFn: async () => (await api.get<{ Id: string; FullName: string }[]>("/Organization/trainers")).data,
        enabled: isOpen,
    });
    const { data: courses = [] } = useQuery({
        queryKey: ["grade-course-options"],
        queryFn: async () => (await api.get<{ Id: string; Title: string }[]>("/Courses", { params: { page: 1, pageSize: 100 } })).data,
        enabled: isOpen,
    });

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setIsOpen(true); };
    const openEdit = (grade: Grade) => {
        setEditingId(grade.Id);
        setForm({
            name: grade.Name,
            academicYearId: grade.AcademicYearId ?? NONE,
            homeroomInstructorId: grade.HomeroomInstructorId ?? NONE,
            capacity: grade.Capacity == null ? "" : String(grade.Capacity),
            memberTrainerIds: grade.MemberTrainerIds,
            courseIds: grade.CourseIds,
        });
        setIsOpen(true);
    };

    const handleSubmit = () => {
        if (!form.name.trim()) {
            toast({ variant: "destructive", title: t("grades.nameRequired") });
            return;
        }
        const capacity = form.capacity.trim() === "" ? undefined : Number(form.capacity);
        if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) {
            toast({ variant: "destructive", title: t("grades.capacityInvalid") });
            return;
        }
        if (capacity !== undefined && form.memberTrainerIds.length > capacity) {
            toast({ variant: "destructive", title: t("grades.overCapacity") });
            return;
        }
        saveMutation.mutate({
            id: editingId ?? undefined,
            input: {
                Name: form.name.trim(),
                AcademicYearId: form.academicYearId === NONE ? undefined : form.academicYearId,
                HomeroomInstructorId: form.homeroomInstructorId === NONE ? undefined : form.homeroomInstructorId,
                Capacity: capacity,
                MemberTrainerIds: form.memberTrainerIds,
                CourseIds: form.courseIds,
            },
        }, {
            onSuccess: () => {
                setIsOpen(false);
                setForm(emptyForm);
                toast({ title: t(editingId ? "grades.updated" : "grades.created") });
            },
            onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("grades.saveFailed")) }),
        });
    };

    const handleDelete = (grade: Grade) => {
        if (!window.confirm(t("grades.confirmDelete", { name: grade.Name }))) return;
        deleteMutation.mutate(grade.Id, {
            onSuccess: () => toast({ title: t("grades.deleted") }),
            onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("grades.deleteFailed")) }),
        });
    };

    return (
        <OrganizationPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <School className="w-5 h-5 text-primary" />
                        </div>
                        {t("grades.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("grades.subtitle")}</p>
                </div>
                {canManage && (
                    <Button className="gap-2" onClick={openCreate}><Plus className="w-4 h-4" /> {t("grades.newGrade")}</Button>
                )}
            </div>

            {profile && !isSchool && (
                <Card className="border-warning/40 bg-warning/5"><CardContent className="p-4 text-sm">{t("academicStructure.notEnabled")}</CardContent></Card>
            )}

            <div className="max-w-xs">
                <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger aria-label={t("grades.filterByYear")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("grades.allYears")}</SelectItem>
                        {years.map((y) => <SelectItem key={y.Id} value={y.Id}>{y.Name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : isError ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-destructive">{getApiError(error, t("grades.loadFailed"))}</CardContent></Card>
            ) : grades.length === 0 ? (
                <Card className="border-border/50"><CardContent className="p-12 text-center text-muted-foreground">{t("grades.empty")}</CardContent></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grades.map((grade) => (
                        <Card key={grade.Id} className="border-border/50 hover:shadow-md transition-all" data-testid="grade-card">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-base">{grade.Name}</CardTitle>
                                    {grade.AcademicYearId && (
                                        <Badge variant="outline" className="text-xs">{grade.AcademicYearName ?? t("common:deletedEntity")}</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    {t("grades.homeroom", {
                                        name: grade.HomeroomInstructorId ? (grade.HomeroomInstructorName ?? t("common:deletedUser")) : t("grades.noHomeroom"),
                                    })}
                                </p>
                                <div className="flex gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5" />
                                        {grade.Capacity == null
                                            ? formatNumber(grade.MemberTrainerIds.length)
                                            : t("grades.occupancy", { members: formatNumber(grade.MemberTrainerIds.length), capacity: formatNumber(grade.Capacity) })}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <BookOpen className="w-3.5 h-3.5" />
                                        {t("grades.coursesCount", { count: grade.CourseIds.length })}
                                    </span>
                                </div>
                                {canManage && (
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(grade)}>
                                            <Edit2 className="w-3.5 h-3.5" /> {t("common:actions.edit")}
                                        </Button>
                                        <Button variant="outline" size="sm" className="gap-1.5 text-destructive" aria-label={t("common:actions.delete")} onClick={() => handleDelete(grade)}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t(editingId ? "grades.editTitle" : "grades.createTitle")}</DialogTitle>
                        <DialogDescription>{t("grades.createDescription")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="grade-name">{t("grades.name")}</Label>
                            <Input id="grade-name" placeholder={t("grades.namePlaceholder")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t("grades.academicYear")}</Label>
                                <Select value={form.academicYearId} onValueChange={v => setForm({ ...form, academicYearId: v })}>
                                    <SelectTrigger aria-label={t("grades.academicYear")}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE}>{t("grades.noYear")}</SelectItem>
                                        {years.map((y) => <SelectItem key={y.Id} value={y.Id}>{y.Name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="grade-capacity">{t("grades.capacity")}</Label>
                                <Input id="grade-capacity" type="number" min={1} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>{t("grades.homeroomInstructor")}</Label>
                            <Select value={form.homeroomInstructorId} onValueChange={v => setForm({ ...form, homeroomInstructorId: v })}>
                                <SelectTrigger aria-label={t("grades.homeroomInstructor")}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>{t("grades.noHomeroom")}</SelectItem>
                                    {instructors.map((i) => <SelectItem key={i.Id} value={i.Id}>{i.FullName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <MultiPick
                            label={t("grades.members")}
                            options={trainers.map((x) => ({ Id: x.Id, Name: x.FullName }))}
                            selected={form.memberTrainerIds}
                            onChange={(ids) => setForm({ ...form, memberTrainerIds: ids })}
                            empty={t("grades.noOptions")}
                        />
                        <MultiPick
                            label={t("grades.curriculum")}
                            options={courses.map((c) => ({ Id: c.Id, Name: c.Title }))}
                            selected={form.courseIds}
                            onChange={(ids) => setForm({ ...form, courseIds: ids })}
                            empty={t("grades.noOptions")}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                            {saveMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t(editingId ? "grades.saveGrade" : "grades.createGrade")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </OrganizationPageLayout>
    );
};

export default OrganizationGrades;
