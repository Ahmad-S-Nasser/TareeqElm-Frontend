import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Plus,
    Building2,
    Users,
    BookOpen,
    MoreVertical,
    Trash2,
    ChevronRight,
    Loader2,
    Link2
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useFormatters } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import { useAssignDepartment } from "@/hooks/useDepartments";

interface Department { Id: string; Name: string; Head: string | null; CoursesCount: number; TrainersCount: number; Performance: number; Trend: number }
/** The slices of GET /Courses and GET /Organization/trainers the assign dialog needs (same query keys as OrganizationCourses/OrganizationTrainers). */
interface AssignableCourse { Id: string; Title: string; DepartmentId?: string | null }
interface AssignableTrainer { Id: string; FullName: string; Email: string; DepartmentId: string | null }

interface CheckListItem { id: string; label: string; hint?: string | null; alreadyIn: boolean }

/** A searchable checkbox list; rows already in the department are shown ticked and locked (assigning only adds). */
const CheckList = ({ id, title, items, selected, onToggle, loading, alreadyLabel, emptyLabel, searchLabel }: {
    id: string; title: string; items: CheckListItem[]; selected: string[]; onToggle: (id: string) => void;
    loading: boolean; alreadyLabel: string; emptyLabel: string; searchLabel: string;
}) => {
    const [search, setSearch] = useState("");
    const term = search.trim().toLowerCase();
    const shown = term ? items.filter((i) => i.label.toLowerCase().includes(term)) : items;
    return (
        <div className="space-y-2" data-testid={id}>
            <Label htmlFor={`${id}-search`}>{title}</Label>
            <Input id={`${id}-search`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchLabel} />
            <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                {loading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                ) : shown.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">{emptyLabel}</p>
                ) : shown.map((item) => (
                    <label key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                        <Checkbox
                            checked={item.alreadyIn || selected.includes(item.id)}
                            disabled={item.alreadyIn}
                            onCheckedChange={() => onToggle(item.id)}
                            aria-label={item.label}
                        />
                        <span className="flex-1 min-w-0 truncate">{item.label}</span>
                        {item.alreadyIn ? (
                            <span className="text-xs text-muted-foreground shrink-0">{alreadyLabel}</span>
                        ) : item.hint ? (
                            <span className="text-xs text-muted-foreground shrink-0 truncate max-w-[40%]">{item.hint}</span>
                        ) : null}
                    </label>
                ))}
            </div>
        </div>
    );
};

const OrganizationDepartments = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newDept, setNewDept] = useState({ name: "", head: "" });
    const { t } = useTranslation(["organization", "common"]);
    const { formatNumber, formatPercent } = useFormatters();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: departments = [], isLoading: loading, isError, error } = useQuery({
        queryKey: ["organization-departments"],
        queryFn: async () => (await api.get<Department[]>("/Departments")).data,
    });

    // ---------- bulk assign (PUT /Departments/{id}/assign) ----------
    const [assignDept, setAssignDept] = useState<Department | null>(null);
    const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
    const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>([]);
    const assignMutation = useAssignDepartment();

    // Same keys and requests as OrganizationCourses / OrganizationTrainers, so each page warms the other's cache.
    const coursesQuery = useQuery({
        queryKey: ["organization-courses"],
        queryFn: async () => (await api.get<AssignableCourse[]>("/Courses", { params: { pageSize: 100 } })).data,
        enabled: !!assignDept,
    });
    const trainersQuery = useQuery({
        queryKey: ["organization-trainers"],
        queryFn: async () => (await api.get<AssignableTrainer[]>("/Organization/trainers")).data,
        enabled: !!assignDept,
    });

    const departmentNames = useMemo(() => new Map(departments.map((d) => [d.Id, d.Name])), [departments]);
    const otherDepartmentHint = (departmentId: string | null | undefined) =>
        departmentId ? t("departments.assign.currently", { name: departmentNames.get(departmentId) ?? t("notAssigned") }) : null;

    const courseItems: CheckListItem[] = (coursesQuery.data ?? []).map((c) => ({
        id: c.Id, label: c.Title, alreadyIn: !!assignDept && c.DepartmentId === assignDept.Id, hint: otherDepartmentHint(c.DepartmentId),
    }));
    const trainerItems: CheckListItem[] = (trainersQuery.data ?? []).map((tr) => ({
        id: tr.Id, label: tr.FullName, alreadyIn: !!assignDept && tr.DepartmentId === assignDept.Id, hint: otherDepartmentHint(tr.DepartmentId),
    }));

    const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
        setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const openAssign = (dept: Department) => {
        setSelectedCourseIds([]);
        setSelectedTrainerIds([]);
        setAssignDept(dept);
    };

    const handleAssign = () => {
        if (!assignDept) return;
        const name = assignDept.Name;
        assignMutation.mutate(
            { departmentId: assignDept.Id, assignment: { UserIds: selectedTrainerIds, CourseIds: selectedCourseIds } },
            {
                onSuccess: () => {
                    toast({ title: t("departments.assign.success", { name }) });
                    setAssignDept(null);
                },
                onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("departments.assign.failed")) }),
            }
        );
    };

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["organization-departments"] });
        queryClient.invalidateQueries({ queryKey: ["organization-stats"] });
        queryClient.invalidateQueries({ queryKey: ["departments"] });
    };

    const addMutation = useMutation({
        mutationFn: async (d: { Name: string; HeadOfDepartment?: string }) => { await api.post("/Departments", d); },
        onSuccess: () => {
            invalidate();
            setIsAddOpen(false);
            setNewDept({ name: "", head: "" });
            toast({ title: t("departments.created") });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("departments.createFailed")) }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => { await api.delete(`/Departments/${id}`); },
        onSuccess: () => { invalidate(); toast({ title: t("departments.deleted") }); },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("departments.deleteFailed")) }),
    });

    const handleAdd = () => {
        if (!newDept.name.trim()) {
            toast({ variant: "destructive", title: t("departments.nameRequired") });
            return;
        }
        addMutation.mutate({ Name: newDept.name.trim(), HeadOfDepartment: newDept.head.trim() || undefined });
    };

    const filteredDepartments = departments.filter(dept =>
        dept.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dept.Head?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background">
            <OrganizationSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} />

            <main className={cn(
                "pt-20 pb-12 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ms-20" : "lg:ms-64"
            )}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{t("departments.title")}</h1>
                            <p className="text-muted-foreground mt-1">{t("departments.subtitle")}</p>
                        </div>
                        <Button className="gradient-primary text-white border-0" onClick={() => setIsAddOpen(true)}>
                            <Plus className="w-4 h-4 me-2" />
                            {t("departments.add")}
                        </Button>
                    </div>

                    <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder={t("departments.search")}
                                className="ps-10 bg-background/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="shrink-0">
                            {t("departments.filters")}
                        </Button>
                    </div>

                    {isError && (
                        <div className="text-center py-6 text-destructive">{getApiError(error, t("departments.loadFailed"))}</div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredDepartments.map((dept) => (
                                <Card key={dept.Id} className="group hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden">
                                    <CardHeader className="pb-4 relative">
                                        <div className="flex items-start justify-between">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("departments.actionsMenu")}>
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openAssign(dept)}>
                                                        <Link2 className="w-4 h-4 me-2" /> {t("departments.assign.action")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm(t("departments.confirmDelete", { name: dept.Name }))) deleteMutation.mutate(dept.Id); }}>
                                                        <Trash2 className="w-4 h-4 me-2" /> {t("common:actions.delete")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <CardTitle className="text-xl">{dept.Name}</CardTitle>
                                        <CardDescription className="flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5" />
                                            {t("departments.head", { name: dept.Head ?? t("notAssigned") })}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{t("departments.courses")}</p>
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4 text-primary" />
                                                    <span className="font-bold">{formatNumber(dept.CoursesCount || 0)}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{t("departments.trainers")}</p>
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-accent" />
                                                    <span className="font-bold">{formatNumber(dept.TrainersCount || 0)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-medium">
                                                <span className="text-muted-foreground">{t("departments.performance")}</span>
                                                <span className="text-primary">{formatPercent(dept.Performance || 0)}</span>
                                            </div>
                                            <Progress value={dept.Performance || 0} className="h-1.5" />
                                        </div>

                                        <Button variant="outline" className="w-full" onClick={() => openAssign(dept)} aria-label={t("departments.assign.actionFor", { name: dept.Name })}>
                                            <Link2 className="w-4 h-4 me-2" />
                                            {t("departments.assign.action")}
                                        </Button>

                                        <Button variant="ghost" className="w-full group/btn hover:bg-primary/5 hover:text-primary border border-transparent hover:border-primary/20">
                                            {t("departments.viewDetails")}
                                            <ChevronRight className="w-4 h-4 ms-2 transition-transform rtl:rotate-180 group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {!loading && !isError && filteredDepartments.length === 0 && (
                        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border/50">
                            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                            <h3 className="text-lg font-medium">{t("departments.noneFound")}</h3>
                            <p className="text-muted-foreground">{t("departments.noneHint")}</p>
                        </div>
                    )}
                </div>
            </main>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{t("dashboard.addTitle")}</DialogTitle>
                        <DialogDescription>{t("dashboard.addDescription")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="dept-name">{t("dashboard.deptName")}</Label>
                            <Input id="dept-name" placeholder={t("dashboard.deptNamePlaceholder")} value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dept-head">{t("dashboard.headLabel")}</Label>
                            <Input id="dept-head" placeholder={t("dashboard.headPlaceholder")} value={newDept.head} onChange={(e) => setNewDept({ ...newDept, head: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleAdd} disabled={addMutation.isPending} className="gradient-primary text-white border-0">
                            {addMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("dashboard.addDepartment")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!assignDept} onOpenChange={(open) => !open && setAssignDept(null)}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>{t("departments.assign.title", { name: assignDept?.Name ?? "" })}</DialogTitle>
                        <DialogDescription>{t("departments.assign.description")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <CheckList
                            id="assign-courses"
                            title={t("departments.assign.courses")}
                            items={courseItems}
                            selected={selectedCourseIds}
                            onToggle={toggleIn(setSelectedCourseIds)}
                            loading={coursesQuery.isLoading}
                            alreadyLabel={t("departments.assign.alreadyIn")}
                            emptyLabel={t("departments.assign.noCourses")}
                            searchLabel={t("departments.assign.searchCourses")}
                        />
                        <CheckList
                            id="assign-trainers"
                            title={t("departments.assign.trainers")}
                            items={trainerItems}
                            selected={selectedTrainerIds}
                            onToggle={toggleIn(setSelectedTrainerIds)}
                            loading={trainersQuery.isLoading}
                            alreadyLabel={t("departments.assign.alreadyIn")}
                            emptyLabel={t("departments.assign.noTrainers")}
                            searchLabel={t("departments.assign.searchTrainers")}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignDept(null)}>{t("common:actions.cancel")}</Button>
                        <Button
                            onClick={handleAssign}
                            disabled={assignMutation.isPending || (selectedCourseIds.length === 0 && selectedTrainerIds.length === 0)}
                            className="gradient-primary text-white border-0"
                        >
                            {assignMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("departments.assign.submit", { count: selectedCourseIds.length + selectedTrainerIds.length })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OrganizationDepartments;