import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Users, Plus, Search, Filter, Pencil, UserCheck, UserX, Building2, Shield, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { parseApiRole } from "@/lib/roles";

type UserRole = "Admin" | "Instructor" | "Organization" | "Trainer";
const ROLES: UserRole[] = ["Admin", "Instructor", "Organization", "Trainer"];
const PAGE_SIZE = 20;
const NO_DEPARTMENT = "none";

interface ManagedUser {
    Id: string;
    FullName: string;
    Email: string;
    Role: string;
    IsActive: boolean;
    DepartmentId: string | null;
    DepartmentName?: string | null;
    AvatarUrl: string | null;
    CreatedAt: string;
}
interface DepartmentOption { Id: string; Name: string }
interface UsersPage { items: ManagedUser[]; total: number }

const fetchUsers = async (params: Record<string, string | number | boolean | undefined>): Promise<UsersPage> => {
    const res = await api.get<ManagedUser[]>("/admin/users", { params });
    const total = Number(res.headers["x-total-count"] ?? res.data.length);
    return { items: res.data, total };
};

const AdminUsers = () => {
    const { t } = useTranslation(["admin", "common", "roles"]);
    const { formatNumber } = useFormatters();
    const roleLabel = (r: string) => { const ar = parseApiRole(r); return ar ? t(`roles:${ar}.name`) : t("common:labels.unknown"); };
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterRole, setFilterRole] = useState("all");
    const [page, setPage] = useState(1);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newUser, setNewUser] = useState({ fullName: "", email: "", password: "", role: "Trainer" as UserRole, departmentId: NO_DEPARTMENT });
    const [editing, setEditing] = useState<ManagedUser | null>(null);
    const [edit, setEdit] = useState({ role: "Trainer" as string, isActive: true, departmentId: NO_DEPARTMENT, newPassword: "" });
    const { toast } = useToast();
    const { user: me } = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const roleParam = filterRole === "all" ? undefined : filterRole;

    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ["admin-users", debouncedSearch, roleParam, page],
        queryFn: () => fetchUsers({ search: debouncedSearch || undefined, role: roleParam, page, pageSize: PAGE_SIZE }),
        placeholderData: keepPreviousData,
    });

    const { data: totalAll } = useQuery({
        queryKey: ["admin-users-count", "all"],
        queryFn: async () => (await fetchUsers({ page: 1, pageSize: 1 })).total,
    });
    const { data: totalActive } = useQuery({
        queryKey: ["admin-users-count", "active"],
        queryFn: async () => (await fetchUsers({ active: true, page: 1, pageSize: 1 })).total,
    });
    const { data: totalInactive } = useQuery({
        queryKey: ["admin-users-count", "inactive"],
        queryFn: async () => (await fetchUsers({ active: false, page: 1, pageSize: 1 })).total,
    });

    const { data: departments = [] } = useQuery({
        queryKey: ["departments"],
        queryFn: async () => (await api.get<DepartmentOption[]>("/Departments")).data,
    });

    const users = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    // Show the resolved department name, never the id.
    const deptName = (u: ManagedUser) => u.DepartmentName ?? (u.DepartmentId ? (departments.find((d) => d.Id === u.DepartmentId)?.Name ?? t("common:deletedDepartment")) : null);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        queryClient.invalidateQueries({ queryKey: ["admin-users-count"] });
    };

    const createMutation = useMutation({
        mutationFn: async () => {
            await api.post("/admin/users", {
                FullName: newUser.fullName.trim(),
                Email: newUser.email.trim(),
                Password: newUser.password,
                Role: newUser.role,
                DepartmentId: newUser.departmentId === NO_DEPARTMENT ? undefined : newUser.departmentId,
            });
        },
        onSuccess: () => {
            invalidate();
            setIsAddOpen(false);
            setNewUser({ fullName: "", email: "", password: "", role: "Trainer", departmentId: NO_DEPARTMENT });
            toast({ title: t("admin:users.toast.created"), description: t("admin:users.toast.createdDescription", { name: newUser.fullName.trim() }) });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("admin:users.toast.createFailed"), description: getApiError(err, t("admin:users.toast.createFailed")) }),
    });

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editing) return;
            const body: Record<string, unknown> = {
                Role: edit.role,
                IsActive: edit.isActive,
                DepartmentId: edit.departmentId === NO_DEPARTMENT ? "" : edit.departmentId,
            };
            if (edit.newPassword) body.NewPassword = edit.newPassword;
            await api.put(`/admin/users/${editing.Id}`, body);
        },
        onSuccess: () => {
            invalidate();
            setEditing(null);
            toast({ title: t("admin:users.toast.updated", { name: editing?.FullName ?? "" }) });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("admin:users.toast.updateFailed"), description: getApiError(err, t("admin:users.toast.updateFailed")) }),
    });

    const handleAddUser = () => {
        if (!newUser.fullName.trim() || !newUser.email.trim()) {
            toast({ variant: "destructive", title: t("admin:users.toast.missingFields"), description: t("admin:users.toast.missingFieldsDescription") });
            return;
        }
        if (newUser.password.length < 8) {
            toast({ variant: "destructive", title: t("admin:users.toast.passwordShort"), description: t("admin:users.toast.passwordShortDescription") });
            return;
        }
        createMutation.mutate();
    };

    const openEdit = (u: ManagedUser) => {
        setEditing(u);
        setEdit({ role: u.Role, isActive: u.IsActive, departmentId: u.DepartmentId ?? NO_DEPARTMENT, newPassword: "" });
    };

    const handleSaveEdit = () => {
        if (edit.newPassword && edit.newPassword.length < 8) {
            toast({ variant: "destructive", title: t("admin:users.toast.passwordShort"), description: t("admin:users.toast.passwordShortDescription") });
            return;
        }
        updateMutation.mutate();
    };

    const statusColor = (active: boolean) =>
        active ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : "text-muted-foreground border-border bg-muted";

    const isSelf = editing?.Id === me?.Id;

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black">{t("admin:users.title")}</h1>
                            <p className="text-muted-foreground text-sm mt-1">{t("admin:users.subtitle")}</p>
                        </div>
                        <Button className="bg-rose-500 hover:bg-rose-600 text-white border-0" onClick={() => setIsAddOpen(true)}>
                            <Plus className="w-4 h-4 me-2" /> {t("admin:users.add")}
                        </Button>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { key: "total", val: totalAll, icon: Users, color: "bg-primary/10 text-primary" },
                            { key: "active", val: totalActive, icon: UserCheck, color: "bg-emerald-500/10 text-emerald-500" },
                            { key: "inactive", val: totalInactive, icon: UserX, color: "bg-rose-500/10 text-rose-500" },
                        ].map((s) => (
                            <Card key={s.key} className="border-border/50">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.color)}>
                                        <s.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black">{s.val === undefined ? "-" : formatNumber(s.val)}</p>
                                        <p className="text-xs text-muted-foreground">{t(`admin:users.stats.${s.key}`)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input className="ps-9" placeholder={t("admin:users.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-52">
                                <Filter className="w-4 h-4 me-2 text-muted-foreground" />
                                <SelectValue placeholder={t("admin:users.allRoles")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t("admin:users.allRoles")}</SelectItem>
                                {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
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
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("admin:users.table.name")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("admin:users.table.department")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("admin:users.table.role")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("admin:users.table.status")}</th>
                                            <th className="px-5 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading && (
                                            <tr><td colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></td></tr>
                                        )}
                                        {isError && (
                                            <tr><td colSpan={5} className="text-center py-12 text-destructive">{getApiError(error, t("admin:users.loadFailed"))}</td></tr>
                                        )}
                                        {users.map((u) => (
                                            <tr key={u.Id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", isFetching && "opacity-70")}>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        {u.AvatarUrl ? (
                                                            <img src={u.AvatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xs shrink-0">
                                                                {u.FullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-semibold">{u.FullName}</p>
                                                            <p dir="ltr" className="text-xs text-muted-foreground text-start">{u.Email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 hidden md:table-cell">
                                                    <span className="flex items-center gap-1.5 text-muted-foreground">
                                                        <Building2 className="w-3.5 h-3.5" /> {deptName(u) ?? "-"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 hidden sm:table-cell">
                                                    <span className="flex items-center gap-1.5 text-muted-foreground">
                                                        <Shield className="w-3.5 h-3.5" /> {roleLabel(u.Role)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <Badge variant="outline" className={cn("text-xs font-semibold", statusColor(u.IsActive))}>
                                                        {u.IsActive ? t("admin:users.status.active") : t("admin:users.status.inactive")}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-3.5 text-end">
                                                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(u)} aria-label={t("admin:users.editAria", { name: u.FullName })}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!isLoading && !isError && users.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center py-12 text-muted-foreground">{t("admin:users.empty")}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {total > PAGE_SIZE && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">{t("admin:users.pageInfo", { page: formatNumber(page), pages: formatNumber(totalPages), count: total })}</p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t("common:actions.previous")}</Button>
                                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t("common:actions.next")}</Button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Add user */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>{t("admin:users.add_dialog.title")}</DialogTitle>
                        <DialogDescription>{t("admin:users.add_dialog.description")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="nu-name">{t("admin:users.fields.fullName")}</Label>
                            <Input id="nu-name" placeholder={t("admin:users.fields.fullNamePlaceholder")} value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nu-email">{t("admin:users.fields.email")}</Label>
                            <Input id="nu-email" type="email" placeholder={t("admin:users.fields.emailPlaceholder")} value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nu-pass">{t("admin:users.fields.initialPassword")}</Label>
                            <Input id="nu-pass" type="password" placeholder={t("admin:users.fields.passwordPlaceholder")} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t("admin:users.fields.role")}</Label>
                                <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v as UserRole })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("admin:users.fields.department")}</Label>
                                <Select value={newUser.departmentId} onValueChange={(v) => setNewUser({ ...newUser, departmentId: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_DEPARTMENT}>{t("admin:users.noDepartment")}</SelectItem>
                                        {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleAddUser} disabled={createMutation.isPending} className="bg-rose-500 hover:bg-rose-600 text-white border-0">
                            {createMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("admin:users.add")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit user */}
            <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>{t("admin:users.edit_dialog.title")}</DialogTitle>
                        <DialogDescription>{editing?.FullName} · <bdi dir="ltr">{editing?.Email}</bdi></DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{t("admin:users.fields.role")}</Label>
                                <Select value={edit.role} onValueChange={(v) => setEdit({ ...edit, role: v })} disabled={isSelf}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t("admin:users.fields.status")}</Label>
                                <Select value={edit.isActive ? "active" : "inactive"} onValueChange={(v) => setEdit({ ...edit, isActive: v === "active" })} disabled={isSelf}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">{t("admin:users.status.active")}</SelectItem>
                                        <SelectItem value="inactive">{t("admin:users.status.inactive")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {isSelf && <p className="text-xs text-muted-foreground">{t("admin:users.edit_dialog.selfNote")}</p>}
                        <div className="space-y-2">
                            <Label>{t("admin:users.fields.department")}</Label>
                            <Select value={edit.departmentId} onValueChange={(v) => setEdit({ ...edit, departmentId: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_DEPARTMENT}>{t("admin:users.noDepartment")}</SelectItem>
                                    {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="eu-pass">{t("admin:users.fields.resetPassword")}</Label>
                            <Input id="eu-pass" type="password" placeholder={t("admin:users.fields.resetPasswordPlaceholder")} value={edit.newPassword} onChange={(e) => setEdit({ ...edit, newPassword: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(null)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} className="bg-rose-500 hover:bg-rose-600 text-white border-0">
                            {updateMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("admin:users.edit_dialog.saveChanges")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminUsers;
