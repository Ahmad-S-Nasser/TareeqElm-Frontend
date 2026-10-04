import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { FileClock, Loader2, X } from "lucide-react";
import {
    AUDIT_ACTIONS, AUDIT_PAGE_SIZE, AUDIT_TARGET_TYPES, useAuditLogsQuery, type AuditLogEntry,
} from "@/hooks/useAuditLogs";
import { auditActionLabel } from "@/lib/activity";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { parseApiRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

const ANY = "any";

/**
 * The audit trail (`audit.view`) — the first screen ever to read the log every service has been writing since phase
 * 4.5. Deliberately a plain filterable table, not a forensics tool: it answers "who changed this, and when".
 *
 * The API filters actors by **id**, which is not something anyone should have to type, so the actor filter is set by
 * clicking a name in the table; what is displayed is always the resolved name the server sent.
 */
const AdminAuditLog = () => {
    const { t } = useTranslation(["admin", "common", "roles"]);
    const { formatDateTime, formatNumber } = useFormatters();

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [actor, setActor] = useState<{ id: string; name: string } | null>(null);
    const [action, setAction] = useState(ANY);
    const [targetType, setTargetType] = useState(ANY);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [page, setPage] = useState(1);

    const filters = useMemo(
        () => ({
            actor: actor?.id,
            action: action === ANY ? undefined : action,
            targetType: targetType === ANY ? undefined : targetType,
            from: from || undefined,
            to: to || undefined,
            page,
            pageSize: AUDIT_PAGE_SIZE,
        }),
        [actor, action, targetType, from, to, page]
    );

    const { data, isLoading, isError, error, isFetching } = useAuditLogsQuery(filters);
    const entries = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
    const hasFilters = !!actor || action !== ANY || targetType !== ANY || !!from || !!to;

    const reset = () => {
        setActor(null); setAction(ANY); setTargetType(ANY); setFrom(""); setTo(""); setPage(1);
    };

    /** Actions are shown as sentences ("created a coupon"), never as the raw dotted code. */
    const actionLabel = (code: string) => auditActionLabel(code, t);
    const targetLabel = (type: string) => t(`admin:audit.targets.${type}`, { defaultValue: type });
    const actorName = (entry: AuditLogEntry) => entry.ActorName ?? (entry.ActorId ? t("common:deletedUser") : t("admin:audit.system"));
    const roleName = (role: string | null) => {
        const appRole = parseApiRole(role ?? undefined);
        return appRole ? t(`roles:${appRole}.name`) : null;
    };

    return (
        <div className="min-h-screen bg-background">
            <AdminSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />
            <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
                <div className="max-w-7xl mx-auto space-y-6">

                    <div>
                        <h1 className="text-3xl font-black">{t("admin:audit.title")}</h1>
                        <p className="text-muted-foreground text-sm mt-1">{t("admin:audit.subtitle")}</p>
                    </div>

                    {/* Filters */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1">
                            <Label className="text-xs">{t("admin:audit.filters.action")}</Label>
                            <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
                                <SelectTrigger aria-label={t("admin:audit.filters.action")}><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-72">
                                    <SelectItem value={ANY}>{t("admin:audit.filters.anyAction")}</SelectItem>
                                    {AUDIT_ACTIONS.map((code) => (
                                        <SelectItem key={code} value={code}>{actionLabel(code)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">{t("admin:audit.filters.targetType")}</Label>
                            <Select value={targetType} onValueChange={(v) => { setTargetType(v); setPage(1); }}>
                                <SelectTrigger aria-label={t("admin:audit.filters.targetType")}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ANY}>{t("admin:audit.filters.anyTargetType")}</SelectItem>
                                    {AUDIT_TARGET_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>{targetLabel(type)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs" htmlFor="audit-from">{t("admin:audit.filters.from")}</Label>
                            <Input id="audit-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs" htmlFor="audit-to">{t("admin:audit.filters.to")}</Label>
                            <Input id="audit-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {actor ? (
                            <Badge variant="secondary" className="gap-1">
                                {t("admin:audit.filters.actor")}: {actor.name}
                                <button type="button" onClick={() => { setActor(null); setPage(1); }}
                                    aria-label={t("admin:audit.filters.clearActor")} className="ms-1">
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ) : (
                            <p className="text-xs text-muted-foreground">{t("admin:audit.filters.actorHint")}</p>
                        )}
                        {hasFilters && (
                            <Button variant="ghost" size="sm" onClick={reset}>{t("admin:audit.filters.reset")}</Button>
                        )}
                    </div>

                    {/* Table */}
                    <Card className="border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/50 bg-muted/30">
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("admin:audit.table.when")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("admin:audit.table.actor")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("admin:audit.table.action")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("admin:audit.table.target")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("admin:audit.table.detail")}</th>
                                            <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden xl:table-cell">{t("admin:audit.table.ip")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading && (
                                            <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary inline" /></td></tr>
                                        )}
                                        {isError && (
                                            <tr><td colSpan={6} className="text-center py-12 text-destructive">{getApiError(error, t("admin:audit.loadFailed"))}</td></tr>
                                        )}
                                        {entries.map((entry) => {
                                            const role = roleName(entry.ActorRole);
                                            return (
                                                <tr key={entry.Id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", isFetching && "opacity-70")}>
                                                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{formatDateTime(entry.At)}</td>
                                                    <td className="px-5 py-3">
                                                        {entry.ActorId ? (
                                                            <button type="button" className="font-semibold text-start hover:underline"
                                                                onClick={() => { setActor({ id: entry.ActorId as string, name: actorName(entry) }); setPage(1); }}>
                                                                {actorName(entry)}
                                                            </button>
                                                        ) : (
                                                            <span className="font-semibold">{actorName(entry)}</span>
                                                        )}
                                                        {role && <p className="text-xs text-muted-foreground">{role}</p>}
                                                    </td>
                                                    <td className="px-5 py-3">{actionLabel(entry.Action)}</td>
                                                    <td className="px-5 py-3 hidden md:table-cell">
                                                        <span className="text-muted-foreground">{targetLabel(entry.TargetType)}</span>
                                                        {entry.TargetName && <span className="ms-1">· {entry.TargetName}</span>}
                                                        {!entry.TargetName && !entry.TargetId && <span className="ms-1">{t("admin:audit.noTarget")}</span>}
                                                    </td>
                                                    <td className="px-5 py-3 hidden lg:table-cell text-muted-foreground max-w-xs truncate" title={entry.Detail ?? undefined}>
                                                        {entry.Detail || t("admin:audit.noDetail")}
                                                    </td>
                                                    <td className="px-5 py-3 hidden xl:table-cell text-muted-foreground" dir="ltr">{entry.Ip || "—"}</td>
                                                </tr>
                                            );
                                        })}
                                        {!isLoading && !isError && entries.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="text-center py-12">
                                                    <FileClock className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                                                    <p className="text-muted-foreground">{t("admin:audit.empty")}</p>
                                                    {hasFilters && <p className="text-xs text-muted-foreground mt-1">{t("admin:audit.emptyHint")}</p>}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {total > AUDIT_PAGE_SIZE && (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                {t("admin:audit.pageInfo", { page: formatNumber(page), pages: formatNumber(totalPages), count: total })}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common:actions.previous")}</Button>
                                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("common:actions.next")}</Button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminAuditLog;
