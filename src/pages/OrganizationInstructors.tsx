import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Search,
    Plus,
    Users,
    Mail,
    Building2,
    BookOpen,
    MoreVertical,
    CheckCircle2,
    Loader2,
    UserCheck,
    UserX,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";

interface OrganizationInstructor {
    Id: string;
    FullName: string;
    Email: string;
    Department: string | null;
    DepartmentId: string | null;
    ActiveCourses: number | null;
    IsActive: boolean;
    AvatarUrl?: string | null;
}
interface DepartmentOption { Id: string; Name: string }
interface AssignedCourse { Id: string; Title: string; Status: string; EnrolledCount: number }

const ALL = "all";
const NO_DEPARTMENT = "none";

const OrganizationInstructors = () => {
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber } = useFormatters();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState(ALL);
    const [statusFilter, setStatusFilter] = useState(ALL);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newInstructor, setNewInstructor] = useState({ fullName: "", email: "", password: "", departmentId: NO_DEPARTMENT });
    const [profileInstructor, setProfileInstructor] = useState<OrganizationInstructor | null>(null);
    const [assignedInstructor, setAssignedInstructor] = useState<OrganizationInstructor | null>(null);

    const { data: instructors = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ["organization-instructors"],
        queryFn: async () => (await api.get<OrganizationInstructor[]>("/Organization/instructors")).data,
    });
    const { data: departments = [] } = useQuery({
        queryKey: ["organization-departments"],
        queryFn: async () => (await api.get<DepartmentOption[]>("/Departments")).data,
    });
    const { data: assignedCourses = [], isLoading: assignedLoading, isError: assignedError } = useQuery({
        queryKey: ["instructor-assigned-courses", assignedInstructor?.Id],
        enabled: !!assignedInstructor,
        queryFn: async () => (await api.get<AssignedCourse[]>("/Courses", { params: { instructorId: assignedInstructor!.Id, pageSize: 100 } })).data,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["organization-instructors"] });

    const createMutation = useMutation({
        mutationFn: async () => {
            await api.post("/admin/users", {
                FullName: newInstructor.fullName.trim(),
                Email: newInstructor.email.trim(),
                Password: newInstructor.password,
                Role: "Instructor",
                DepartmentId: newInstructor.departmentId === NO_DEPARTMENT ? undefined : newInstructor.departmentId,
            });
        },
        onSuccess: () => {
            invalidate();
            setIsAddOpen(false);
            setNewInstructor({ fullName: "", email: "", password: "", departmentId: NO_DEPARTMENT });
            toast({ title: t("instructors.addDialog.created") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("instructors.addDialog.createFailed"), description: getApiError(err, t("instructors.addDialog.createFailed")) }),
    });

    const toggleActiveMutation = useMutation({
        mutationFn: async (instructor: OrganizationInstructor) => {
            await api.put(`/admin/users/${instructor.Id}`, { IsActive: !instructor.IsActive });
        },
        onSuccess: () => { invalidate(); toast({ title: t("instructors.menu.statusUpdated") }); },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("instructors.menu.statusUpdateFailed"), description: getApiError(err, t("instructors.menu.statusUpdateFailed")) }),
    });

    const handleAdd = () => {
        if (!newInstructor.fullName.trim() || !newInstructor.email.trim()) {
            toast({ variant: "destructive", title: t("instructors.addDialog.missingFields") });
            return;
        }
        if (newInstructor.password.length < 8) {
            toast({ variant: "destructive", title: t("instructors.addDialog.passwordShort") });
            return;
        }
        createMutation.mutate();
    };

    const filteredInstructors = instructors.filter(inst =>
        (inst.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inst.Email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (inst.Department || "").toLowerCase().includes(searchQuery.toLowerCase())) &&
        (departmentFilter === ALL || inst.DepartmentId === departmentFilter) &&
        (statusFilter === ALL || inst.IsActive === (statusFilter === "active"))
    );

    return (
        <div className="min-h-screen bg-background text-foreground">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-12 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{t("instructors.title")}</h1>
                            <p className="text-muted-foreground mt-1">{t("instructors.subtitle")}</p>
                        </div>
                        <Can permission={PERMISSIONS.usersManage}>
                            <Button className="gradient-primary text-white border-0" onClick={() => setIsAddOpen(true)}>
                                <Plus className="w-4 h-4 me-2" />
                                {t("instructors.add")}
                            </Button>
                        </Can>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm transition-all hover:shadow-md">
                        <div className="relative flex-1">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder={t("instructors.search")}
                                className="ps-10 bg-background/50 border-none ring-1 ring-border/50 focus:ring-primary/30"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                <SelectTrigger className="w-full sm:w-44" aria-label={t("instructors.filterDepartments")}>
                                    <SelectValue placeholder={t("instructors.filterDepartments")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t("instructors.filterDepartments")}</SelectItem>
                                    {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-40" aria-label={t("instructors.filterStatus")}>
                                    <SelectValue placeholder={t("instructors.filterStatus")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>{t("instructors.filterStatus")}</SelectItem>
                                    <SelectItem value="active">{t("instructors.status.active")}</SelectItem>
                                    <SelectItem value="inactive">{t("instructors.status.inactive")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {isError && <div className="text-center py-6 text-destructive">{getApiError(error, t("instructors.loadFailed"))}</div>}

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredInstructors.map((instructor) => (
                                <Card key={instructor.Id} className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden border-b-4 border-b-primary/0 hover:border-b-primary">
                                    <CardContent className="p-0">
                                        <div className="p-6 pb-4">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="relative">
                                                    <Avatar className="w-16 h-16 border-2 border-primary/10 transition-transform group-hover:scale-105">
                                                        {instructor.AvatarUrl && <AvatarImage src={instructor.AvatarUrl} alt={instructor.FullName} />}
                                                        <AvatarFallback>{instructor.FullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className={cn(
                                                        "absolute -bottom-1 -end-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center",
                                                        instructor.IsActive ? "bg-emerald-500" : "bg-muted-foreground/60"
                                                    )}>
                                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                                    </div>
                                                </div>
                                                <Can permission={PERMISSIONS.usersManage}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" aria-label={t("instructors.actionsMenu", { name: instructor.FullName })}>
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                disabled={toggleActiveMutation.isPending}
                                                                onClick={() => toggleActiveMutation.mutate(instructor)}
                                                            >
                                                                {instructor.IsActive ? (
                                                                    <><UserX className="w-4 h-4 me-2" /> {t("instructors.menu.deactivate")}</>
                                                                ) : (
                                                                    <><UserCheck className="w-4 h-4 me-2" /> {t("instructors.menu.activate")}</>
                                                                )}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </Can>
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{instructor.FullName}</h3>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wider">
                                                    <Building2 className="w-3 h-3 text-primary" />
                                                    {instructor.Department ?? t("unassigned")}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="px-6 py-4 space-y-3 bg-muted/20 border-y border-border/40">
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <BookOpen className="w-4 h-4" />
                                                    <span>{t("instructors.activeCourses")}</span>
                                                </div>
                                                <span className="font-bold">{formatNumber(instructor.ActiveCourses || 0)}</span>
                                            </div>
                                        </div>

                                        <div className="p-4 space-y-2">
                                            <Button variant="ghost" className="w-full text-xs justify-start hover:bg-primary/5 text-muted-foreground hover:text-primary group/link">
                                                <Mail className="w-3.5 h-3.5 me-2 opacity-50 group-hover/link:opacity-100" />
                                                <bdi dir="ltr">{instructor.Email}</bdi>
                                            </Button>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setProfileInstructor(instructor)}>{t("instructors.profile")}</Button>
                                                <Button variant="secondary" size="sm" className="text-xs h-8" onClick={() => setAssignedInstructor(instructor)}>{t("instructors.assigned")}</Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {!loading && !isError && filteredInstructors.length === 0 && (
                        <div className="text-center py-24 bg-card/40 rounded-2xl border border-dashed border-border/50">
                            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-10" />
                            <h3 className="text-xl font-medium tracking-tight">{t("instructors.noneFound")}</h3>
                            <p className="text-muted-foreground max-w-md mx-auto">{t("instructors.noneHint")}</p>
                            <Button variant="outline" className="mt-6" onClick={() => setSearchQuery("")}>{t("common:actions.clear")}</Button>
                        </div>
                    )}
                </div>
            </main>

            {/* Add instructor */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>{t("instructors.addDialog.title")}</DialogTitle>
                        <DialogDescription>{t("instructors.addDialog.description")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="ni-name">{t("instructors.addDialog.fullName")}</Label>
                            <Input id="ni-name" placeholder={t("instructors.addDialog.fullNamePlaceholder")} value={newInstructor.fullName} onChange={(e) => setNewInstructor({ ...newInstructor, fullName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ni-email">{t("instructors.addDialog.email")}</Label>
                            <Input id="ni-email" type="email" placeholder={t("instructors.addDialog.emailPlaceholder")} value={newInstructor.email} onChange={(e) => setNewInstructor({ ...newInstructor, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ni-pass">{t("instructors.addDialog.password")}</Label>
                            <Input id="ni-pass" type="password" placeholder={t("instructors.addDialog.passwordPlaceholder")} value={newInstructor.password} onChange={(e) => setNewInstructor({ ...newInstructor, password: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>{t("instructors.addDialog.department")}</Label>
                            <Select value={newInstructor.departmentId} onValueChange={(v) => setNewInstructor({ ...newInstructor, departmentId: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_DEPARTMENT}>{t("instructors.addDialog.noDepartment")}</SelectItem>
                                    {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleAdd} disabled={createMutation.isPending} className="gradient-primary text-white border-0">
                            {createMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("instructors.addDialog.submit")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Profile */}
            <Dialog open={!!profileInstructor} onOpenChange={(open) => !open && setProfileInstructor(null)}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>{t("instructors.profileDialog.title")}</DialogTitle>
                        <DialogDescription>{profileInstructor?.FullName}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2 text-sm">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                            <span className="text-muted-foreground">{t("instructors.profileDialog.email")}</span>
                            <bdi dir="ltr" className="font-medium">{profileInstructor?.Email}</bdi>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                            <span className="text-muted-foreground">{t("instructors.profileDialog.department")}</span>
                            <span className="font-medium">{profileInstructor?.Department ?? t("unassigned")}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                            <span className="text-muted-foreground">{t("instructors.profileDialog.status")}</span>
                            <Badge variant="outline" className={cn("text-xs font-semibold", profileInstructor?.IsActive ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : "text-muted-foreground border-border bg-muted")}>
                                {profileInstructor?.IsActive ? t("instructors.status.active") : t("instructors.status.inactive")}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                            <span className="text-muted-foreground">{t("instructors.profileDialog.activeCourses")}</span>
                            <span className="font-medium">{formatNumber(profileInstructor?.ActiveCourses || 0)}</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Assigned courses */}
            <Dialog open={!!assignedInstructor} onOpenChange={(open) => !open && setAssignedInstructor(null)}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>{t("instructors.assignedDialog.title", { name: assignedInstructor?.FullName ?? "" })}</DialogTitle>
                        <DialogDescription>{assignedInstructor?.Email}</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        {assignedLoading && (
                            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                        )}
                        {assignedError && <p className="text-center text-destructive py-6">{t("instructors.assignedDialog.loadFailed")}</p>}
                        {!assignedLoading && !assignedError && assignedCourses.length === 0 && (
                            <p className="text-center text-muted-foreground py-10">{t("instructors.assignedDialog.empty")}</p>
                        )}
                        {!assignedLoading && !assignedError && assignedCourses.length > 0 && (
                            <ScrollArea className="max-h-80">
                                <ul className="divide-y divide-border/50">
                                    {assignedCourses.map((course) => (
                                        <li key={course.Id} className="flex items-center justify-between gap-3 py-2.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                                                <span className="font-medium truncate">{course.Title}</span>
                                            </div>
                                            <Badge variant="outline" className="text-xs shrink-0">{t(`courses.status.${course.Status}`, course.Status)}</Badge>
                                        </li>
                                    ))}
                                </ul>
                            </ScrollArea>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OrganizationInstructors;
