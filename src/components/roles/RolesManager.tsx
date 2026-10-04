import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, Loader2, Lock, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import api, { getApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    type PermissionInfo, type RoleInfo, PERMISSIONS_QUERY_KEY, ROLES_QUERY_KEY, permissionKey, systemRoleKey,
} from "./rbac";

interface Draft { name: string; description: string; permissions: Set<string> }
type DialogState = { mode: "create" } | { mode: "duplicate"; source: RoleInfo } | null;

const toDraft = (role: RoleInfo): Draft => ({
    name: role.Name,
    description: role.Description ?? "",
    permissions: new Set(role.Permissions),
});

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/** Role list + permission matrix. Needs roles.manage (Admin). */
export const RolesManager = () => {
    const { t } = useTranslation(["rbac", "roles", "common"]);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const catalogQuery = useQuery({
        queryKey: PERMISSIONS_QUERY_KEY,
        queryFn: async () => (await api.get<PermissionInfo[]>("/permissions")).data,
    });
    const rolesQuery = useQuery({
        queryKey: ROLES_QUERY_KEY,
        queryFn: async () => (await api.get<RoleInfo[]>("/roles")).data,
    });

    const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
    const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected = roles.find((r) => r.Id === selectedId) ?? roles[0] ?? null;

    const [draft, setDraft] = useState<Draft | null>(null);
    const [dialog, setDialog] = useState<DialogState>(null);
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [deleteOpen, setDeleteOpen] = useState(false);

    // Reset the editor whenever another role is selected or the server copy changes (after a save).
    const selectedStamp = selected ? `${selected.Id}|${selected.UpdatedAt}` : "";
    useEffect(() => {
        setDraft(selected ? toDraft(selected) : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the stamp on purpose
    }, [selectedStamp]);

    const roleName = (r: RoleInfo) => {
        const key = systemRoleKey(r);
        return key ? t(`roles:${key}.name`) : r.Name;
    };
    const roleDescription = (r: RoleInfo) => {
        const key = systemRoleKey(r);
        return key ? t(`roles:${key}.description`) : r.Description;
    };
    const permLabel = (p: PermissionInfo) => t(`rbac:permission.${permissionKey(p.Name)}`, { defaultValue: p.Description });

    const grouped = useMemo(() => {
        const map = new Map<string, PermissionInfo[]>();
        for (const p of catalog) map.set(p.Category, [...(map.get(p.Category) ?? []), p]);
        return [...map.entries()];
    }, [catalog]);

    const dirty = !!selected && !!draft && (
        !sameSet(draft.permissions, new Set(selected.Permissions)) ||
        (!selected.IsSystem && (draft.name.trim() !== selected.Name || draft.description.trim() !== (selected.Description ?? "")))
    );

    const orderedPermissions = (set: Set<string>) => catalog.map((p) => p.Name).filter((n) => set.has(n));

    const refresh = () => queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!selected || !draft) return null;
            const body = selected.IsSystem
                ? { Permissions: orderedPermissions(draft.permissions) }
                : { Name: draft.name.trim(), Description: draft.description.trim(), Permissions: orderedPermissions(draft.permissions) };
            return (await api.put<RoleInfo>(`/roles/${selected.Id}`, body)).data;
        },
        onSuccess: (saved) => {
            refresh();
            toast({ title: t("rbac:toast.saved", { name: saved ? roleName(saved) : "" }) });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("rbac:toast.saveFailed"), description: getApiError(err, t("rbac:toast.saveFailed")) }),
    });

    const createMutation = useMutation({
        mutationFn: async (state: NonNullable<DialogState>) => {
            const permissions = state.mode === "duplicate"
                ? state.source.Permissions.filter((n) => !catalog.find((p) => p.Name === n)?.AdminOnly)
                : [];
            return (await api.post<RoleInfo>("/roles", { Name: newName.trim(), Description: newDescription.trim(), Permissions: permissions })).data;
        },
        onSuccess: (created) => {
            refresh();
            setSelectedId(created.Id);
            setDialog(null);
            toast({ title: t("rbac:toast.created", { name: created.Name }) });
        },
        onError: (err: unknown) => toast({ variant: "destructive", title: t("rbac:toast.createFailed"), description: getApiError(err, t("rbac:toast.createFailed")) }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (role: RoleInfo) => { await api.delete(`/roles/${role.Id}`); return role; },
        onSuccess: (role) => {
            refresh();
            setSelectedId(null);
            setDeleteOpen(false);
            toast({ title: t("rbac:toast.deleted", { name: role.Name }) });
        },
        onError: (err: unknown) => {
            setDeleteOpen(false);
            toast({ variant: "destructive", title: t("rbac:toast.deleteFailed"), description: getApiError(err, t("rbac:toast.deleteFailed")) });
        },
    });

    const openDialog = (state: NonNullable<DialogState>) => {
        setNewName(state.mode === "duplicate" ? t("rbac:dialog.copyName", { name: roleName(state.source) }) : "");
        setNewDescription(state.mode === "duplicate" ? state.source.Description ?? "" : "");
        setDialog(state);
    };

    const submitDialog = () => {
        if (!dialog) return;
        if (newName.trim().length < 2) {
            toast({ variant: "destructive", title: t("rbac:dialog.nameRequired") });
            return;
        }
        createMutation.mutate(dialog);
    };

    const togglePermission = (name: string, on: boolean) =>
        setDraft((d) => {
            if (!d) return d;
            const next = new Set(d.permissions);
            if (on) next.add(name); else next.delete(name);
            return { ...d, permissions: next };
        });

    if (catalogQuery.isLoading || rolesQuery.isLoading) {
        return (
            <div className="flex justify-center py-24" role="status" aria-live="polite">
                <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
                <span className="sr-only">{t("common:states.loading")}</span>
            </div>
        );
    }

    if (catalogQuery.isError || rolesQuery.isError) {
        return (
            <Card className="border-destructive/30">
                <CardContent className="p-8 text-center space-y-3">
                    <p className="text-destructive">{getApiError(catalogQuery.error ?? rolesQuery.error, t("rbac:loadFailed"))}</p>
                    <Button variant="outline" onClick={() => { void catalogQuery.refetch(); void rolesQuery.refetch(); }}>{t("rbac:retry")}</Button>
                </CardContent>
            </Card>
        );
    }

    const locked = !!selected?.IsLocked;
    const enabledCount = draft ? catalog.filter((p) => draft.permissions.has(p.Name)).length : 0;
    const editableCatalogCount = catalog.length;

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-6 items-start">
                {/* Role list */}
                <Card className="border-border/50">
                    <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between px-2 pt-1">
                            <h2 className="text-sm font-bold">{t("rbac:rolesHeading")}</h2>
                            <Button size="sm" variant="outline" onClick={() => openDialog({ mode: "create" })}>
                                <Plus className="w-4 h-4 me-1.5" /> {t("rbac:newRole")}
                            </Button>
                        </div>
                        {roles.length === 0 && <p className="text-sm text-muted-foreground px-2 py-6 text-center">{t("rbac:noRoles")}</p>}
                        <ul className="space-y-1" aria-label={t("rbac:rolesHeading")}>
                            {roles.map((r) => (
                                <li key={r.Id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(r.Id)}
                                        aria-current={selected?.Id === r.Id ? "true" : undefined}
                                        className={cn(
                                            "w-full text-start rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50",
                                            selected?.Id === r.Id && "bg-primary/10 ring-1 ring-primary/30"
                                        )}
                                    >
                                        <span className="flex items-center gap-2">
                                            {r.IsLocked ? <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden /> : <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />}
                                            <span className="font-semibold text-sm truncate">{roleName(r)}</span>
                                        </span>
                                        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <UserRound className="w-3 h-3" aria-hidden />
                                            {t("rbac:userCount", { count: r.UserCount })}
                                            <Badge variant="outline" className="ms-auto text-[10px] px-1.5 py-0">
                                                {r.IsSystem ? t("rbac:badges.system") : t("rbac:badges.custom")}
                                            </Badge>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Editor */}
                {!selected || !draft ? (
                    <Card className="border-border/50"><CardContent className="p-10 text-center text-muted-foreground">{t("rbac:selectRole")}</CardContent></Card>
                ) : (
                    <Card className="border-border/50">
                        <CardContent className="p-5 space-y-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="text-xl font-black flex items-center gap-2">
                                        {roleName(selected)}
                                        {locked && <Badge variant="outline" className="border-amber-500/40 text-amber-600"><Lock className="w-3 h-3 me-1" />{t("rbac:badges.locked")}</Badge>}
                                    </h2>
                                    {roleDescription(selected) && <p className="text-sm text-muted-foreground mt-1">{roleDescription(selected)}</p>}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t("rbac:userCount", { count: selected.UserCount })} · {t("rbac:enabledSummary", { enabled: enabledCount, total: editableCatalogCount })}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openDialog({ mode: "duplicate", source: selected })}>
                                        <Copy className="w-4 h-4 me-1.5" /> {t("rbac:editor.duplicate")}
                                    </Button>
                                    {!selected.IsSystem && (
                                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={selected.UserCount > 0} onClick={() => setDeleteOpen(true)}>
                                            <Trash2 className="w-4 h-4 me-1.5" /> {t("rbac:editor.delete")}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {locked && <p className="text-sm rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2">{t("rbac:editor.lockedNote")}</p>}
                            {selected.IsSystem && !locked && <p className="text-sm rounded-lg bg-muted px-3 py-2 text-muted-foreground">{t("rbac:editor.systemNote")}</p>}
                            {!selected.IsSystem && selected.UserCount > 0 && <p className="text-xs text-muted-foreground">{t("rbac:editor.inUse")}</p>}

                            {!selected.IsSystem && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="role-name">{t("rbac:editor.name")}</Label>
                                        <Input id="role-name" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="role-desc">{t("rbac:editor.description")}</Label>
                                        <Textarea id="role-desc" rows={2} maxLength={300} placeholder={t("rbac:editor.descriptionPlaceholder")} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-5">
                                {grouped.map(([category, perms]) => (
                                    <section key={category} aria-label={t(`rbac:category.${category}`, { defaultValue: category })}>
                                        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                                            {t(`rbac:category.${category}`, { defaultValue: category })}
                                        </h3>
                                        <ul className="divide-y divide-border/40 rounded-xl border border-border/50">
                                            {perms.map((p) => {
                                                const checked = draft.permissions.has(p.Name);
                                                const disabled = locked || p.AdminOnly || saveMutation.isPending;
                                                const label = permLabel(p);
                                                return (
                                                    <li key={p.Name} className="flex items-center justify-between gap-3 px-4 py-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium">{label}</p>
                                                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                                                                <code dir="ltr" className="text-[11px]">{p.Name}</code>
                                                                {p.LearnerScoped && <Badge variant="secondary" className="text-[10px] px-1.5 py-0" title={t("rbac:editor.learnerHint")}>{t("rbac:badges.learner")}</Badge>}
                                                                {p.AdminOnly && <Badge variant="outline" className="text-[10px] px-1.5 py-0" title={t("rbac:editor.adminOnlyHint")}>{t("rbac:badges.adminOnly")}</Badge>}
                                                            </div>
                                                        </div>
                                                        <Switch
                                                            checked={checked}
                                                            disabled={disabled}
                                                            onCheckedChange={(on) => togglePermission(p.Name, on)}
                                                            aria-label={t("rbac:editor.toggleAria", { permission: label, role: roleName(selected) })}
                                                        />
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </section>
                                ))}
                            </div>

                            {!locked && (
                                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/50 pt-4">
                                    {dirty && <span className="text-xs text-muted-foreground me-auto">{t("rbac:editor.unsaved")}</span>}
                                    <Button variant="outline" disabled={!dirty || saveMutation.isPending} onClick={() => setDraft(toDraft(selected))}>{t("rbac:editor.discard")}</Button>
                                    <Button disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                                        {saveMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                                        {t("rbac:editor.save")}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Create / duplicate */}
            <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>
                            {dialog?.mode === "duplicate" ? t("rbac:dialog.duplicateTitle", { name: roleName(dialog.source) }) : t("rbac:dialog.createTitle")}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog?.mode === "duplicate" ? t("rbac:dialog.duplicateDescription") : t("rbac:dialog.createDescription")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="new-role-name">{t("rbac:editor.name")}</Label>
                            <Input id="new-role-name" maxLength={60} placeholder={t("rbac:dialog.namePlaceholder")} value={newName} onChange={(e) => setNewName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-role-desc">{t("rbac:editor.description")}</Label>
                            <Textarea id="new-role-desc" rows={2} maxLength={300} placeholder={t("rbac:editor.descriptionPlaceholder")} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={submitDialog} disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("rbac:dialog.create")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("rbac:dialog.deleteTitle", { name: selected ? roleName(selected) : "" })}</AlertDialogTitle>
                        <AlertDialogDescription>{t("rbac:dialog.deleteDescription")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(e) => { e.preventDefault(); if (selected) deleteMutation.mutate(selected); }}
                        >
                            {deleteMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t("rbac:editor.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default RolesManager;
