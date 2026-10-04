/**
 * Admin → Platform Courses (catalog v12 phase 3).
 *
 * Real authoring at last: list/create/edit/publish/archive/delete through the same `/api/Courses` endpoints the
 * instructor-facing screens use (the creating caller becomes `InstructorId`, so an Admin's own course naturally lands
 * as platform-owned — `CourseService.VisibleTo` already narrows `GET /Courses` to exactly that for an Admin caller,
 * no extra scoping needed here), plus the one thing only a platform course has: a license price an organization pays
 * once to add it to its own library.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { CourseOwnershipBadge, MoneyInput } from "@/components/billing";
import { BookOpen, Loader2, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    ADMIN_COURSES_PAGE_SIZE, useAdminCoursesQuery, useCreatePlatformCourse, useDeletePlatformCourse,
    useSetCourseLicensePrice, useUpdatePlatformCourse, type AdminCourse,
} from "@/hooks/useAdminCourses";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { usePlatformCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

const ALL = "all";

interface CourseForm {
    title: string;
    description: string;
    category: string;
    level: string;
}

const emptyForm: CourseForm = { title: "", description: "", category: "", level: "" };
const formOf = (course: AdminCourse): CourseForm => ({
    title: course.Title, description: course.Description ?? "", category: course.Category ?? "", level: course.Level ?? "",
});

const AdminCourses = () => {
    const { t } = useTranslation(["billing", "common"]);
    const { formatCurrency, formatNumber } = useFormatters();
    const { toast } = useToast();
    const { currency: platformCurrency } = usePlatformCurrency();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [status, setStatus] = useState(ALL);

    const [editing, setEditing] = useState<AdminCourse | null>(null);
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<CourseForm>(emptyForm);
    const [deleting, setDeleting] = useState<AdminCourse | null>(null);
    const [pricing, setPricing] = useState<AdminCourse | null>(null);
    const [licenseAmount, setLicenseAmount] = useState<number | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const filters = useMemo(
        () => ({ search: debouncedSearch || undefined, status: status === ALL ? undefined : status, pageSize: ADMIN_COURSES_PAGE_SIZE }),
        [debouncedSearch, status]
    );
    const { data: courses = [], isLoading, isError, error, isFetching } = useAdminCoursesQuery(filters);

    const createMutation = useCreatePlatformCourse();
    const updateMutation = useUpdatePlatformCourse();
    const deleteMutation = useDeletePlatformCourse();
    const licenseMutation = useSetCourseLicensePrice();

    const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
    const openEdit = (course: AdminCourse) => { setEditing(course); setForm(formOf(course)); setDialogOpen(true); };
    const openPricing = (course: AdminCourse) => { setPricing(course); setLicenseAmount(course.LicensePrice?.Amount ?? null); };

    const handleSave = () => {
        const title = form.title.trim();
        if (!title) { toast({ variant: "destructive", title: t("billing:platformCourses.titleRequired") }); return; }
        const body = {
            Title: title,
            Description: form.description.trim() || null,
            Category: form.category.trim() || null,
            Level: form.level.trim() || null,
        };
        const onError = (err: unknown) =>
            toast({ variant: "destructive", title: t("billing:platformCourses.saveFailed"), description: getApiError(err, t("billing:platformCourses.saveFailed")) });
        const onSuccess = () => { setDialogOpen(false); setEditing(null); toast({ title: t("billing:platformCourses.saved") }); };
        if (editing) updateMutation.mutate({ id: editing.Id, body }, { onSuccess, onError });
        else createMutation.mutate(body, { onSuccess, onError });
    };

    const handleStatusChange = (course: AdminCourse, next: "Published" | "Archived") =>
        updateMutation.mutate({ id: course.Id, body: { Status: next } }, {
            onError: (err: unknown) => toast({ variant: "destructive", title: t("billing:platformCourses.saveFailed"), description: getApiError(err) }),
        });

    const handleDelete = () => {
        if (!deleting) return;
        deleteMutation.mutate(deleting.Id, {
            onSuccess: () => { setDeleting(null); toast({ title: t("billing:platformCourses.deleted") }); },
            onError: (err: unknown) =>
                toast({ variant: "destructive", title: t("billing:platformCourses.deleteFailed"), description: getApiError(err, t("billing:platformCourses.deleteFailed")) }),
        });
    };

    const handleSavePricing = () => {
        if (!pricing || !licenseAmount || licenseAmount <= 0) {
            toast({ variant: "destructive", title: t("billing:platformCourses.licensePriceInvalid") });
            return;
        }
        licenseMutation.mutate(
            { id: pricing.Id, body: { IsFree: false, Amount: licenseAmount, Currency: pricing.LicensePrice?.Currency ?? platformCurrency } },
            {
                onSuccess: () => { setPricing(null); toast({ title: t("billing:platformCourses.licensePriceSaved") }); },
                onError: (err: unknown) =>
                    toast({ variant: "destructive", title: t("billing:platformCourses.licensePriceSaveFailed"), description: getApiError(err, t("billing:platformCourses.licensePriceSaveFailed")) }),
            }
        );
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black">{t("billing:platformCourses.title")}</h1>
                            <p className="text-muted-foreground text-sm mt-1">{t("billing:platformCourses.subtitle")}</p>
                        </div>
                        <Button onClick={openCreate}>
                            <Plus className="w-4 h-4 me-2" /> {t("billing:platformCourses.create")}
                        </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input className="ps-9" placeholder={t("common:actions.search")} value={search}
                                onChange={(e) => setSearch(e.target.value)} aria-label={t("common:actions.search")} />
                        </div>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-full sm:w-52" aria-label={t("billing:common.status")}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t("billing:common.allStatuses")}</SelectItem>
                                <SelectItem value="Draft">{t("courses:status.Draft")}</SelectItem>
                                <SelectItem value="Published">{t("courses:status.Published")}</SelectItem>
                                <SelectItem value="Archived">{t("courses:status.Archived")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Card className="border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/50 bg-muted/30">
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:platformCourses.titleField")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:common.status")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("billing:platformCourses.ownership")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("billing:platformCourses.licensePrice")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("billing:platformCourses.enrolledCount")}</th>
                                            <th className="px-5 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading && (
                                            <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></td></tr>
                                        )}
                                        {isError && (
                                            <tr><td colSpan={6} className="text-center py-12 text-destructive">{getApiError(error, t("billing:platformCourses.loadFailed"))}</td></tr>
                                        )}
                                        {courses.map((course) => (
                                            <tr key={course.Id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", isFetching && "opacity-70")}>
                                                <td className="px-5 py-3.5">
                                                    <p className="font-semibold">{course.Title}</p>
                                                    {course.Category && <p className="text-xs text-muted-foreground">{course.Category}</p>}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <Badge variant="outline" className="text-xs font-semibold">{t(`courses:status.${course.Status}`)}</Badge>
                                                </td>
                                                <td className="px-5 py-3.5 hidden md:table-cell">
                                                    <CourseOwnershipBadge organizationId={course.OrganizationId} organizationName={course.OrganizationName} />
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <Button variant="ghost" size="sm" className="h-auto px-2 py-1 font-semibold tabular-nums" onClick={() => openPricing(course)}>
                                                        {course.LicensePrice
                                                            ? formatCurrency(course.LicensePrice.Amount, course.LicensePrice.Currency)
                                                            : <span className="text-muted-foreground font-normal">{t("billing:platformCourses.notLicensable")}</span>}
                                                    </Button>
                                                </td>
                                                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground tabular-nums">{formatNumber(course.EnrolledCount)}</td>
                                                <td className="px-5 py-3.5 text-end whitespace-nowrap space-x-1 rtl:space-x-reverse">
                                                    {course.Status === "Draft" && (
                                                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(course, "Published")}>
                                                            {t("billing:platformCourses.publish")}
                                                        </Button>
                                                    )}
                                                    {course.Status === "Published" && (
                                                        <Button size="sm" variant="outline" onClick={() => handleStatusChange(course, "Archived")}>
                                                            {t("billing:platformCourses.archive")}
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(course)} aria-label={t("billing:platformCourses.edit")}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => setDeleting(course)} aria-label={t("billing:platformCourses.delete")}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isLoading && !isError && courses.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="text-center py-12">
                                                    <BookOpen className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                                                    <p className="text-muted-foreground">{t("billing:platformCourses.empty")}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">{t("billing:platformCourses.emptyHint")}</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Create / edit */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>{editing ? t("billing:platformCourses.edit") : t("billing:platformCourses.create")}</DialogTitle>
                        <DialogDescription>{t("billing:platformCourses.subtitle")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="course-title">{t("billing:platformCourses.titleField")}</Label>
                            <Input id="course-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="course-description">{t("billing:platformCourses.descriptionField")}</Label>
                            <Textarea id="course-description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="course-category">{t("billing:platformCourses.categoryField")}</Label>
                                <Input id="course-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="course-level">{t("billing:platformCourses.levelField")}</Label>
                                <Input id="course-level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("billing:common.cancel")}</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("billing:common.save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* License price */}
            <Dialog open={!!pricing} onOpenChange={(open) => !open && setPricing(null)}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Tag className="w-4 h-4" /> {t("billing:platformCourses.setLicensePrice")}</DialogTitle>
                        <DialogDescription>{t("billing:platformCourses.licensePriceHint")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="license-amount">{t("billing:platformCourses.licensePrice")}</Label>
                        <MoneyInput id="license-amount" value={licenseAmount} currency={pricing?.LicensePrice?.Currency ?? platformCurrency}
                            onChange={setLicenseAmount} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPricing(null)}>{t("billing:common.cancel")}</Button>
                        <Button onClick={handleSavePricing} disabled={licenseMutation.isPending}>
                            {licenseMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("billing:common.save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete */}
            <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("billing:platformCourses.deleteConfirm", { title: deleting?.Title ?? "" })}</AlertDialogTitle>
                        <AlertDialogDescription>{t("billing:platformCourses.deleteConfirmHint")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("billing:common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("billing:platformCourses.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default AdminCourses;
