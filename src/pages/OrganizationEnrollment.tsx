import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { OrganizationPageLayout } from "@/components/layout/OrganizationPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserCheck, Search, Loader2, Plus, Check, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import {
    useEnrollmentsQuery, useBulkEnroll, useApproveEnrollment, useRejectEnrollment, useUnenrollTrainer,
    type EnrollmentRow, type BulkEnrollResult,
} from "@/hooks/useEnrollments";

const PAGE_SIZE = 20;
const ALL = "all";
const NO_SECTION = "none";

interface CourseOption { Id: string; Title: string }
interface SectionOption { Id: string; SectionLabel: string; CourseId: string; Capacity: number }
interface DepartmentOption { Id: string; Name: string }
interface TrainerOption { Id: string; FullName: string; Email: string; Department: string | null }

const STATUSES = ["Active", "Pending", "Waitlisted", "Dropped", "Rejected"] as const;
const ACTIVE_STATUSES = new Set(["Active", "Pending", "Waitlisted"]);

const statusColor = (status: string) => {
    switch (status) {
        case "Active": return "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20";
        case "Pending": return "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20";
        case "Waitlisted": return "text-primary border-primary/20 bg-primary/5";
        case "Rejected": return "text-destructive border-destructive/20 bg-destructive/5";
        default: return "text-muted-foreground border-border bg-muted";
    }
};

type BulkMode = "trainers" | "department";

const OrganizationEnrollment = () => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber, formatDate } = useFormatters();
    const { toast } = useToast();

    // ---- filters ----
    const [courseFilter, setCourseFilter] = useState(ALL);
    const [sectionFilter, setSectionFilter] = useState(ALL);
    const [departmentFilter, setDepartmentFilter] = useState(ALL);
    const [statusFilter, setStatusFilter] = useState(ALL);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    useEffect(() => {
        const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
        return () => clearTimeout(id);
    }, [searchInput]);

    const filters = {
        courseId: courseFilter !== ALL ? courseFilter : undefined,
        sectionId: sectionFilter !== ALL ? sectionFilter : undefined,
        departmentId: departmentFilter !== ALL ? departmentFilter : undefined,
        status: statusFilter !== ALL ? statusFilter : undefined,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
    };
    const { data, isLoading, isError, error, isFetching } = useEnrollmentsQuery(filters);
    const enrollments = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const { data: courses = [] } = useQuery({
        queryKey: ["enrollment-courses"],
        queryFn: async () => (await api.get<CourseOption[]>("/Courses", { params: { status: "Published", pageSize: 100 } })).data,
    });
    const { data: sections = [] } = useQuery({
        queryKey: ["course-sections"],
        queryFn: async () => (await api.get<SectionOption[]>("/Sections")).data,
    });
    const { data: departments = [] } = useQuery({
        queryKey: ["organization-departments"],
        queryFn: async () => (await api.get<DepartmentOption[]>("/Departments")).data,
    });
    const { data: trainers = [] } = useQuery({
        queryKey: ["organization-trainers"],
        queryFn: async () => (await api.get<TrainerOption[]>("/Organization/trainers")).data,
    });

    const sectionsForFilter = courseFilter !== ALL ? sections.filter((s) => s.CourseId === courseFilter) : sections;

    // ---- row actions ----
    const approveMutation = useApproveEnrollment();
    const rejectMutation = useRejectEnrollment();
    const unenrollMutation = useUnenrollTrainer();
    const [pendingUnenroll, setPendingUnenroll] = useState<EnrollmentRow | null>(null);

    const handleApprove = async (row: EnrollmentRow) => {
        try {
            await approveMutation.mutateAsync(row.Id);
            toast({ title: t("organization:enrollment.approved") });
        } catch (err) {
            toast({ variant: "destructive", title: t("organization:enrollment.approveFailed"), description: getApiError(err) });
        }
    };
    const handleReject = async (row: EnrollmentRow) => {
        try {
            await rejectMutation.mutateAsync(row.Id);
            toast({ title: t("organization:enrollment.rejected") });
        } catch (err) {
            toast({ variant: "destructive", title: t("organization:enrollment.rejectFailed"), description: getApiError(err) });
        }
    };
    const confirmUnenroll = async () => {
        if (!pendingUnenroll) return;
        try {
            await unenrollMutation.mutateAsync(pendingUnenroll.Id);
            toast({ title: t("organization:enrollment.unenrolled") });
        } catch (err) {
            toast({ variant: "destructive", title: t("organization:enrollment.unenrollFailed"), description: getApiError(err) });
        } finally {
            setPendingUnenroll(null);
        }
    };

    // ---- bulk enroll dialog ----
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkCourseId, setBulkCourseId] = useState("");
    const [bulkSectionId, setBulkSectionId] = useState(NO_SECTION);
    const [bulkMode, setBulkMode] = useState<BulkMode>("trainers");
    const [bulkTrainerSearch, setBulkTrainerSearch] = useState("");
    const [selectedTrainerIds, setSelectedTrainerIds] = useState<Set<string>>(new Set());
    const [bulkDepartmentId, setBulkDepartmentId] = useState("");
    const [bulkResult, setBulkResult] = useState<BulkEnrollResult | null>(null);
    const bulkEnroll = useBulkEnroll();

    const resetBulkDialog = () => {
        setBulkCourseId(""); setBulkSectionId(NO_SECTION); setBulkMode("trainers");
        setBulkTrainerSearch(""); setSelectedTrainerIds(new Set()); setBulkDepartmentId(""); setBulkResult(null);
    };

    const bulkSections = bulkCourseId ? sections.filter((s) => s.CourseId === bulkCourseId) : [];
    const filteredBulkTrainers = useMemo(() => {
        const term = bulkTrainerSearch.trim().toLowerCase();
        if (!term) return trainers;
        return trainers.filter((tr) => tr.FullName.toLowerCase().includes(term) || tr.Email.toLowerCase().includes(term));
    }, [trainers, bulkTrainerSearch]);

    const toggleTrainer = (id: string) => {
        setSelectedTrainerIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleBulkSubmit = async () => {
        if (!bulkCourseId) {
            toast({ variant: "destructive", title: t("organization:enrollment.bulk.courseRequired") });
            return;
        }
        if (bulkMode === "trainers" && selectedTrainerIds.size === 0) {
            toast({ variant: "destructive", title: t("organization:enrollment.bulk.targetsRequired") });
            return;
        }
        if (bulkMode === "department" && !bulkDepartmentId) {
            toast({ variant: "destructive", title: t("organization:enrollment.bulk.targetsRequired") });
            return;
        }
        try {
            const result = await bulkEnroll.mutateAsync({
                courseId: bulkCourseId,
                sectionId: bulkSectionId !== NO_SECTION ? bulkSectionId : undefined,
                trainerIds: bulkMode === "trainers" ? Array.from(selectedTrainerIds) : undefined,
                departmentId: bulkMode === "department" ? bulkDepartmentId : undefined,
            });
            setBulkResult(result);
        } catch (err) {
            toast({ variant: "destructive", title: t("organization:enrollment.bulk.submitFailed"), description: getApiError(err) });
        }
    };

    const closeBulkDialog = () => { setBulkOpen(false); resetBulkDialog(); };

    return (
        <OrganizationPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-primary" />
                        </div>
                        {t("organization:enrollment.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("organization:enrollment.subtitle")}</p>
                </div>
                <Can permission={PERMISSIONS.enrollmentsManage}>
                    <Button onClick={() => setBulkOpen(true)}>
                        <Plus className="w-4 h-4 me-2" /> {t("organization:enrollment.bulk.trigger")}
                    </Button>
                </Can>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="ps-9" placeholder={t("organization:enrollment.filters.search")} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                </div>
                <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setSectionFilter(ALL); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-52" aria-label={t("organization:enrollment.table.course")}><SelectValue placeholder={t("organization:enrollment.filters.allCourses")} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("organization:enrollment.filters.allCourses")}</SelectItem>
                        {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={sectionFilter} onValueChange={(v) => { setSectionFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-48" aria-label={t("organization:enrollment.table.section")}><SelectValue placeholder={t("organization:enrollment.filters.allSections")} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("organization:enrollment.filters.allSections")}</SelectItem>
                        {sectionsForFilter.map((s) => <SelectItem key={s.Id} value={s.Id}>{s.SectionLabel}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-48" aria-label={t("organization:enrollment.filters.departmentAria")}><SelectValue placeholder={t("organization:enrollment.filters.allDepartments")} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("organization:enrollment.filters.allDepartments")}</SelectItem>
                        {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-44" aria-label={t("organization:enrollment.table.status")}><SelectValue placeholder={t("organization:enrollment.filters.allStatuses")} /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("organization:enrollment.filters.allStatuses")}</SelectItem>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`organization:enrollment.status.${s}`)}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <Card className="border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("organization:enrollment.table.trainer")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("organization:enrollment.table.course")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("organization:enrollment.table.section")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("organization:enrollment.table.status")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("organization:enrollment.table.progress")}</th>
                                    <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("organization:enrollment.table.enrolledAt")}</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && (
                                    <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></td></tr>
                                )}
                                {isError && (
                                    <tr><td colSpan={7} className="text-center py-12 text-destructive">{getApiError(error, t("organization:enrollment.loadFailed"))}</td></tr>
                                )}
                                {!isLoading && !isError && enrollments.map((row) => (
                                    <tr key={row.Id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", isFetching && "opacity-70")}>
                                        <td className="px-5 py-3.5">
                                            <p className="font-semibold">{row.TrainerName ?? t("common:deletedUser")}</p>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p>{row.CourseTitle ?? t("common:deletedCourse")}</p>
                                            {row.InstructorName && <p className="text-xs text-muted-foreground">{row.InstructorName}</p>}
                                        </td>
                                        <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">
                                            {row.SectionId ? (row.SectionName ?? t("common:deletedEntity")) : t("organization:enrollment.noSection")}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <Badge variant="outline" className={cn("text-xs font-semibold", statusColor(row.Status))}>
                                                {t(`organization:enrollment.status.${row.Status}`, row.Status)}
                                            </Badge>
                                        </td>
                                        <td className="px-5 py-3.5 hidden lg:table-cell">
                                            <span dir="ltr" className="text-xs text-muted-foreground">{formatNumber(row.ProgressPercentage, { maximumFractionDigits: 0 })}%</span>
                                        </td>
                                        <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{formatDate(row.EnrolledAt)}</td>
                                        <td className="px-5 py-3.5 text-end">
                                            <Can permission={PERMISSIONS.enrollmentsManage}>
                                                <div className="flex justify-end gap-1">
                                                    {row.Status === "Pending" && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="w-8 h-8 text-emerald-600" aria-label={t("organization:enrollment.approve")} disabled={approveMutation.isPending} onClick={() => handleApprove(row)}>
                                                                <Check className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" aria-label={t("organization:enrollment.reject")} disabled={rejectMutation.isPending} onClick={() => handleReject(row)}>
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {ACTIVE_STATUSES.has(row.Status) && (
                                                        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" aria-label={t("organization:enrollment.unenroll")} onClick={() => setPendingUnenroll(row)}>
                                                            <LogOut className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </Can>
                                        </td>
                                    </tr>
                                ))}
                                {!isLoading && !isError && enrollments.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">{t("organization:enrollment.empty")}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t("organization:enrollment.pageInfo", { page: formatNumber(page), pages: formatNumber(totalPages), count: formatNumber(total) })}</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common:actions.previous")}</Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("common:actions.next")}</Button>
                    </div>
                </div>
            )}

            {/* Bulk enroll dialog */}
            <Dialog open={bulkOpen} onOpenChange={(open) => { if (!open) closeBulkDialog(); else setBulkOpen(true); }}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>{t("organization:enrollment.bulk.title")}</DialogTitle>
                        <DialogDescription>{t("organization:enrollment.bulk.description")}</DialogDescription>
                    </DialogHeader>

                    {bulkResult ? (
                        <div className="space-y-3 py-2">
                            <p className="font-semibold">{t("organization:enrollment.bulk.resultTitle")}</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <p>{t("organization:enrollment.bulk.resultOk", { count: bulkResult.OkCount })}</p>
                                <p>{t("organization:enrollment.bulk.resultWaitlisted", { count: bulkResult.WaitlistedCount })}</p>
                                <p>{t("organization:enrollment.bulk.resultConflict", { count: bulkResult.ConflictCount })}</p>
                                <p>{t("organization:enrollment.bulk.resultFull", { count: bulkResult.FullCount })}</p>
                            </div>
                            <ScrollArea className="max-h-48 border rounded-md">
                                <ul className="divide-y divide-border/50 text-sm">
                                    {bulkResult.Rows.map((row) => (
                                        <li key={row.TrainerId} className="px-3 py-2 flex items-center justify-between gap-2">
                                            <span>{row.TrainerName ?? t("common:deletedUser")}</span>
                                            <Badge variant="outline" className="text-xs">{t(`organization:enrollment.bulk.rowStatus.${row.Status}`)}</Badge>
                                        </li>
                                    ))}
                                </ul>
                            </ScrollArea>
                            <DialogFooter>
                                <Button onClick={closeBulkDialog}>{t("organization:enrollment.bulk.close")}</Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label>{t("organization:enrollment.bulk.course")}</Label>
                                    <Select value={bulkCourseId} onValueChange={(v) => { setBulkCourseId(v); setBulkSectionId(NO_SECTION); }}>
                                        <SelectTrigger aria-label={t("organization:enrollment.bulk.course")}><SelectValue placeholder={t("organization:enrollment.bulk.coursePlaceholder")} /></SelectTrigger>
                                        <SelectContent>
                                            {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("organization:enrollment.bulk.section")}</Label>
                                    <Select value={bulkSectionId} onValueChange={setBulkSectionId} disabled={!bulkCourseId}>
                                        <SelectTrigger aria-label={t("organization:enrollment.bulk.section")}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NO_SECTION}>{t("organization:enrollment.bulk.noSectionOption")}</SelectItem>
                                            {bulkSections.map((s) => <SelectItem key={s.Id} value={s.Id}>{s.SectionLabel}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex gap-2">
                                    <Button type="button" size="sm" variant={bulkMode === "trainers" ? "default" : "outline"} onClick={() => setBulkMode("trainers")}>
                                        {t("organization:enrollment.bulk.modeTrainers")}
                                    </Button>
                                    <Button type="button" size="sm" variant={bulkMode === "department" ? "default" : "outline"} onClick={() => setBulkMode("department")}>
                                        {t("organization:enrollment.bulk.modeDepartment")}
                                    </Button>
                                </div>

                                {bulkMode === "trainers" ? (
                                    <div className="space-y-2">
                                        <Label>{t("organization:enrollment.bulk.trainersLabel")} · {t("organization:enrollment.bulk.trainersSelected", { count: selectedTrainerIds.size })}</Label>
                                        <div className="relative">
                                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input className="ps-9" placeholder={t("organization:enrollment.bulk.trainersSearchPlaceholder")} value={bulkTrainerSearch} onChange={(e) => setBulkTrainerSearch(e.target.value)} />
                                        </div>
                                        <ScrollArea className="h-48 border rounded-md p-2">
                                            {filteredBulkTrainers.length === 0 ? (
                                                <p className="text-xs text-muted-foreground text-center py-6">{t("organization:enrollment.bulk.noTrainersFound")}</p>
                                            ) : (
                                                <ul className="space-y-1">
                                                    {filteredBulkTrainers.map((tr) => (
                                                        <li key={tr.Id}>
                                                            <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                                                                <Checkbox aria-label={tr.FullName} checked={selectedTrainerIds.has(tr.Id)} onCheckedChange={() => toggleTrainer(tr.Id)} />
                                                                <span className="text-sm">{tr.FullName}</span>
                                                                <span dir="ltr" className="text-xs text-muted-foreground ms-auto">{tr.Email}</span>
                                                            </label>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </ScrollArea>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label>{t("organization:enrollment.bulk.departmentLabel")}</Label>
                                        <Select value={bulkDepartmentId} onValueChange={setBulkDepartmentId}>
                                            <SelectTrigger aria-label={t("organization:enrollment.bulk.departmentLabel")}><SelectValue placeholder={t("organization:enrollment.bulk.departmentPlaceholder")} /></SelectTrigger>
                                            <SelectContent>
                                                {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={closeBulkDialog}>{t("common:actions.cancel")}</Button>
                                <Button onClick={handleBulkSubmit} disabled={bulkEnroll.isPending}>
                                    {bulkEnroll.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                    {t("organization:enrollment.bulk.submit")}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Unenroll confirmation */}
            <AlertDialog open={!!pendingUnenroll} onOpenChange={(open) => !open && setPendingUnenroll(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("organization:enrollment.confirmUnenrollTitle", { name: pendingUnenroll?.TrainerName ?? t("common:deletedUser") })}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("organization:enrollment.confirmUnenrollDescription", { name: pendingUnenroll?.TrainerName ?? t("common:deletedUser"), course: pendingUnenroll?.CourseTitle ?? t("common:deletedCourse") })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmUnenroll}>{t("organization:enrollment.unenroll")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </OrganizationPageLayout>
    );
};

export default OrganizationEnrollment;
