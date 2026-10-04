import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccessGrants } from "@/components/billing/AccessGrants";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookOpen, Users, Search, Loader2, Check, X, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import {
    useEnrollmentsQuery, useApproveEnrollment, useRejectEnrollment, useUnenrollTrainer,
    type EnrollmentRow,
} from "@/hooks/useEnrollments";

const PAGE_SIZE = 20;
const ALL = "all";
const STATUSES = ["Active", "Pending", "Waitlisted", "Dropped", "Rejected"] as const;
const ACTIVE_STATUSES = new Set(["Active", "Pending", "Waitlisted"]);

interface CourseOption { Id: string; Title: string; EnrolledCount: number }

const statusColor = (status: string) => {
    switch (status) {
        case "Active": return "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20";
        case "Pending": return "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20";
        case "Waitlisted": return "text-primary border-primary/20 bg-primary/5";
        case "Rejected": return "text-destructive border-destructive/20 bg-destructive/5";
        default: return "text-muted-foreground border-border bg-muted";
    }
};

const AdminEnrollments = () => {
    const { t } = useTranslation(["admin", "organization", "common"]);
    const { formatNumber, formatDate } = useFormatters();
    const { toast } = useToast();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const [courseFilter, setCourseFilter] = useState(ALL);
    const [statusFilter, setStatusFilter] = useState(ALL);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    useEffect(() => {
        const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
        return () => clearTimeout(id);
    }, [searchInput]);

    const { data: courses = [] } = useQuery({
        queryKey: ["admin-enrollments-courses"],
        queryFn: async () => (await api.get<CourseOption[]>("/Courses", { params: { pageSize: 100 } })).data,
    });
    const totalEnrolled = courses.reduce((sum, c) => sum + c.EnrolledCount, 0);

    const filters = {
        courseId: courseFilter !== ALL ? courseFilter : undefined,
        status: statusFilter !== ALL ? statusFilter : undefined,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
    };
    const { data, isLoading, isError, error, isFetching } = useEnrollmentsQuery(filters);
    const enrollments = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-black">{t("admin:enrollments.title")}</h1>
                        <p className="text-muted-foreground text-sm mt-1">{t("admin:enrollments.subtitle")}</p>
                    </div>

                    {/* Two surfaces over the same people: how they got into a course (Enrollments) and what they are
                        allowed to open (Access, entitlements.manage). The enrollment tab is unchanged. */}
                    <Tabs defaultValue="enrollments" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="enrollments">{t("admin:enrollments.tabs.enrollments")}</TabsTrigger>
                        <TabsTrigger value="access">{t("admin:enrollments.tabs.access")}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="enrollments" className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="border-border/50">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-2xl font-black">{formatNumber(courses.length)}</p>
                                    <p className="text-xs text-muted-foreground">{t("admin:enrollments.coursesCount")}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-border/50">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><Users className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-2xl font-black">{formatNumber(totalEnrolled)}</p>
                                    <p className="text-xs text-muted-foreground">{t("admin:enrollments.totalEnrollments")}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input className="ps-9" placeholder={t("admin:enrollments.searchPlaceholder")} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                        </div>
                        <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-56" aria-label={t("organization:enrollment.table.course")}><SelectValue placeholder={t("admin:enrollments.allCourses")} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t("admin:enrollments.allCourses")}</SelectItem>
                                {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-48" aria-label={t("organization:enrollment.table.status")}><SelectValue placeholder={t("admin:enrollments.allStatuses")} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t("admin:enrollments.allStatuses")}</SelectItem>
                                {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`organization:enrollment.status.${s}`)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

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
                                            <tr><td colSpan={7} className="text-center py-12 text-destructive">{getApiError(error, t("admin:enrollments.loadFailed"))}</td></tr>
                                        )}
                                        {!isLoading && !isError && enrollments.map((row) => (
                                            <tr key={row.Id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", isFetching && "opacity-70")}>
                                                <td className="px-5 py-3.5 font-semibold">{row.TrainerName ?? t("common:deletedUser")}</td>
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
                                            <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">{t("admin:enrollments.empty")}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {total > PAGE_SIZE && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">{t("admin:enrollments.pageInfo", { page: formatNumber(page), pages: formatNumber(totalPages), count: formatNumber(total) })}</p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common:actions.previous")}</Button>
                                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("common:actions.next")}</Button>
                            </div>
                        </div>
                    )}
                    </TabsContent>

                    <TabsContent value="access">
                        <AccessGrants courses={courses} />
                    </TabsContent>
                    </Tabs>
                </div>
            </main>

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
        </div>
    );
};

export default AdminEnrollments;
