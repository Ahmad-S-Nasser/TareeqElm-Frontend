import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building, Edit2, Loader2, Plus, Search } from "lucide-react";
import { AdminPageLayout } from "@/components/layout/AdminPageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
    ORGANIZATION_KINDS,
    useOrganizationsAdminQuery,
    useSaveOrganization,
    useSetOrganizationActive,
    type OrganizationAdminDto,
    type OrganizationKind,
} from "@/hooks/useOrganizationsAdmin";

const KIND_CLASSES: Record<OrganizationKind, string> = {
    Company: "border-border bg-muted text-foreground",
    Organization: "border-primary/30 bg-primary/10 text-primary",
    School: "border-success/30 bg-success/10 text-success",
};

const emptyForm = { name: "", slug: "", logoUrl: "", contactEmail: "", kind: "Company" as OrganizationKind, isActive: true, traineeCap: "", packageTier: "" };

/** Cross-tenant organization management (organizations.manage, Admin only): provision, edit, set the kind, suspend. */
const AdminOrganizations = () => {
    const { t } = useTranslation(["admin", "common"]);
    const { formatDate } = useFormatters();
    const { toast } = useToast();
    const [search, setSearch] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState<OrganizationAdminDto | null>(null);
    const [form, setForm] = useState(emptyForm);

    const { data: organizations = [], isLoading, isError, error } = useOrganizationsAdminQuery();
    const saveMutation = useSaveOrganization();
    const activeMutation = useSetOrganizationActive();

    const filtered = organizations.filter((o) => {
        const q = search.trim().toLowerCase();
        return !q || o.Name.toLowerCase().includes(q) || (o.Slug ?? "").toLowerCase().includes(q) || (o.ContactEmail ?? "").toLowerCase().includes(q);
    });

    const openCreate = () => { setEditing(null); setForm(emptyForm); setIsOpen(true); };
    const openEdit = (org: OrganizationAdminDto) => {
        setEditing(org);
        setForm({
            name: org.Name, slug: org.Slug ?? "", logoUrl: org.LogoUrl ?? "", contactEmail: org.ContactEmail ?? "",
            kind: org.Kind, isActive: org.IsActive,
            traineeCap: org.TraineeCap != null ? String(org.TraineeCap) : "", packageTier: org.PackageTier ?? "",
        });
        setIsOpen(true);
    };

    const setActive = (org: OrganizationAdminDto, isActive: boolean) =>
        activeMutation.mutate({ id: org.Id, isActive }, {
            onSuccess: () => toast({ title: t(isActive ? "organizations.activated" : "organizations.suspended") }),
            onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("organizations.activeFailed")) }),
        });

    const handleSubmit = () => {
        if (form.name.trim().length < 2) {
            toast({ variant: "destructive", title: t("organizations.nameRequired") });
            return;
        }
        const traineeCap = form.traineeCap.trim();
        if (traineeCap !== "" && (!/^\d+$/.test(traineeCap) || Number(traineeCap) < 0)) {
            toast({ variant: "destructive", title: t("organizations.traineeCapInvalid") });
            return;
        }
        const target = editing;
        saveMutation.mutate({
            id: target?.Id,
            input: {
                Name: form.name, Slug: form.slug, LogoUrl: form.logoUrl, ContactEmail: form.contactEmail, Kind: form.kind,
                TraineeCap: traineeCap === "" ? undefined : Number(traineeCap), PackageTier: form.packageTier,
            },
        }, {
            onSuccess: () => {
                setIsOpen(false);
                toast({ title: t(target ? "organizations.updated" : "organizations.created") });
                // IsActive has its own endpoint; only call it when the switch actually changed.
                if (target && form.isActive !== target.IsActive) setActive(target, form.isActive);
            },
            onError: (err: unknown) => toast({ variant: "destructive", title: t("common:states.error"), description: getApiError(err, t("organizations.saveFailed")) }),
        });
    };

    return (
        <AdminPageLayout>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Building className="w-7 h-7 text-primary" />
                        {t("organizations.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("organizations.subtitle")}</p>
                </div>
                <Button className="gap-2" onClick={openCreate}><Plus className="w-4 h-4" /> {t("organizations.add")}</Button>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder={t("organizations.search")} aria-label={t("organizations.search")} className="ps-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <Card className="border-border/50">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : isError ? (
                        <p className="p-12 text-center text-destructive">{getApiError(error, t("organizations.loadFailed"))}</p>
                    ) : filtered.length === 0 ? (
                        <p className="p-12 text-center text-muted-foreground">{t("organizations.empty")}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("organizations.columns.name")}</TableHead>
                                        <TableHead>{t("organizations.columns.kind")}</TableHead>
                                        <TableHead>{t("organizations.columns.seatCap")}</TableHead>
                                        <TableHead>{t("organizations.columns.contactEmail")}</TableHead>
                                        <TableHead>{t("organizations.columns.created")}</TableHead>
                                        <TableHead>{t("organizations.columns.active")}</TableHead>
                                        <TableHead className="text-end">{t("organizations.columns.actions")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((org) => (
                                        <TableRow key={org.Id} data-testid="organization-row">
                                            <TableCell>
                                                <div className="font-medium">{org.Name}</div>
                                                {org.Slug && <div className="text-xs text-muted-foreground" dir="ltr">{org.Slug}</div>}
                                                {org.IsLegacy && <Badge variant="outline" className="mt-1 text-xs">{t("organizations.legacy")}</Badge>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("font-medium", KIND_CLASSES[org.Kind] ?? KIND_CLASSES.Company)}>
                                                    {t(`organizations.kinds.${org.Kind}`, { defaultValue: org.Kind })}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {org.TraineeCap == null ? (
                                                    <span className="text-muted-foreground">{t("organizations.uncapped")}</span>
                                                ) : (
                                                    <span>
                                                        {org.TraineeCap}
                                                        {org.PackageTier && <span className="text-xs text-muted-foreground"> · {org.PackageTier}</span>}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell dir="ltr" className="text-start">{org.ContactEmail ?? "—"}</TableCell>
                                            <TableCell>{formatDate(org.CreatedAt)}</TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={org.IsActive}
                                                    // The legacy organization can never be suspended (the API answers 403).
                                                    disabled={(org.IsLegacy && org.IsActive) || activeMutation.isPending}
                                                    onCheckedChange={(checked) => setActive(org, checked)}
                                                    aria-label={t("organizations.activeToggle", { name: org.Name })}
                                                />
                                            </TableCell>
                                            <TableCell className="text-end">
                                                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(org)} aria-label={t("organizations.editOrg", { name: org.Name })}>
                                                    <Edit2 className="w-3.5 h-3.5" /> {t("common:actions.edit")}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t(editing ? "organizations.editTitle" : "organizations.createTitle")}</DialogTitle>
                        <DialogDescription>{t("organizations.formDescription")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="org-kind">{t("organizations.form.kind")}</Label>
                            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as OrganizationKind })}>
                                <SelectTrigger id="org-kind" aria-label={t("organizations.form.kind")}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ORGANIZATION_KINDS.map((k) => <SelectItem key={k} value={k}>{t(`organizations.kinds.${k}`)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{t("organizations.form.kindHint")}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-name">{t("organizations.form.name")}</Label>
                            <Input id="org-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="org-slug">{t("organizations.form.slug")}</Label>
                                <Input id="org-slug" dir="ltr" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="org-email">{t("organizations.form.contactEmail")}</Label>
                                <Input id="org-email" type="email" dir="ltr" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-logo">{t("organizations.form.logoUrl")}</Label>
                            <Input id="org-logo" dir="ltr" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
                        </div>
                        {editing && (
                            <div className="flex items-center justify-between gap-4">
                                <Label htmlFor="org-active">{t("organizations.form.isActive")}</Label>
                                <Switch
                                    id="org-active"
                                    checked={form.isActive}
                                    disabled={editing.IsLegacy && editing.IsActive}
                                    onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                                />
                            </div>
                        )}
                        {editing && (
                            <div className="space-y-2 rounded-md border border-border/50 p-3">
                                <p className="text-sm font-medium">{t("organizations.form.seatCapTitle")}</p>
                                <p className="text-xs text-muted-foreground">{t("organizations.form.seatCapHint")}</p>
                                <div className="grid grid-cols-2 gap-4 pt-1">
                                    <div className="space-y-2">
                                        <Label htmlFor="org-trainee-cap">{t("organizations.form.traineeCap")}</Label>
                                        <Input
                                            id="org-trainee-cap" type="number" min={0} dir="ltr"
                                            placeholder={t("organizations.form.traineeCapPlaceholder")}
                                            value={form.traineeCap} onChange={(e) => setForm({ ...form, traineeCap: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="org-package-tier">{t("organizations.form.packageTier")}</Label>
                                        <Input
                                            id="org-package-tier" dir="ltr"
                                            value={form.packageTier} onChange={(e) => setForm({ ...form, packageTier: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>{t("common:actions.cancel")}</Button>
                        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                            {saveMutation.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
                            {t(editing ? "organizations.save" : "organizations.create")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminPageLayout>
    );
};

export default AdminOrganizations;
