import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Handshake, Loader2, Search } from "lucide-react";
import { AdminSidebar, AdminSidebarContent } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/components/routing/Can";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  LEADS_PAGE_SIZE,
  LEAD_ORGANIZATION_TYPES,
  LEAD_STATUSES,
  useAdminLeadsQuery,
  useLeadQuery,
  useUpdateLeadStatus,
  type LeadDto,
  type LeadFilters,
  type LeadStatus,
} from "@/hooks/useLeads";

/** The "no filter" sentinel: a `Select` cannot hold an empty string as a value. */
const ANY = "any";

/** One colour per `LeadStatus`, with theme tokens (not raw palette colours) so both themes and RTL behave. */
const STATUS_CLASSES: Record<LeadStatus, string> = {
  New: "border-primary/30 bg-primary/10 text-primary",
  Contacted: "border-warning/30 bg-warning/10 text-warning",
  Qualified: "border-success/30 bg-success/10 text-success",
  Closed: "border-border bg-muted text-muted-foreground",
};

const LeadStatusBadge = ({ status }: { status: LeadStatus | string }) => {
  const { t } = useTranslation("admin");
  const known = status in STATUS_CLASSES;
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", known ? STATUS_CLASSES[status as LeadStatus] : "border-border bg-muted text-muted-foreground")}
      data-testid="lead-status-badge"
      data-status={status}
    >
      {known ? t(`leads.status.${status}`) : status}
    </Badge>
  );
};

/**
 * The lead detail panel — everything the visitor typed, plus the one thing an administrator may change.
 *
 * The row that opened it already carries every field, so `lead` is passed in as the immediate content and the
 * `GET /api/admin/leads/{id}` read refreshes it; the panel therefore never shows a spinner over data it already has.
 */
const LeadDetail = ({
  lead: listLead,
  onOpenChange,
}: {
  lead: LeadDto | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const { t } = useTranslation(["admin", "common"]);
  const { formatDateTime } = useFormatters();
  const { toast } = useToast();

  const { data: fresh, isError, error } = useLeadQuery(listLead?.Id);
  const lead = fresh ?? listLead;

  const [status, setStatus] = useState<LeadStatus>("New");
  const [note, setNote] = useState("");
  const updateStatus = useUpdateLeadStatus();

  // Switching to another lead must never carry the previous one's half-edited note across.
  useEffect(() => {
    setStatus(listLead?.Status ?? "New");
    setNote(listLead?.StatusNote ?? "");
  }, [listLead?.Id, listLead?.Status, listLead?.StatusNote]);

  const save = async () => {
    if (!lead) return;
    try {
      // Always sent, never omitted: the textarea *is* the note, so clearing it clears the note server-side.
      await updateStatus.mutateAsync({ id: lead.Id, status, statusNote: note.trim() });
      toast({ title: t("admin:leads.detail.saved") });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("admin:leads.detail.saveFailed"),
        description: getApiError(err),
      });
    }
  };

  const orgTypeLabel = (type: string) => t(`admin:leads.organizationType.${type}`, { defaultValue: type });

  return (
    <Sheet open={!!listLead} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="lead-detail">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {lead?.CompanyName ?? ""}
            {lead && <LeadStatusBadge status={lead.Status} />}
          </SheetTitle>
          <SheetDescription>{t("admin:leads.detail.description")}</SheetDescription>
        </SheetHeader>

        {lead ? (
          <div className="mt-6 space-y-6">
            {/* The row already carries every field, so a failed refresh degrades to "this may be stale", not a blank
                panel — the only thing actually missing is confirmation that nothing changed since the list was read. */}
            {isError && (
              <p className="text-sm text-destructive" role="alert" data-testid="lead-detail-error">
                {getApiError(error, t("admin:leads.detail.loadFailed"))}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t("admin:leads.table.contact")}</dt>
                <dd className="font-medium">{lead.ContactName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("admin:leads.table.email")}</dt>
                <dd className="font-medium break-all">
                  <a className="hover:underline" href={`mailto:${lead.Email}`} dir="ltr">
                    {lead.Email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("admin:leads.fields.phone")}</dt>
                <dd className="font-medium" dir="ltr">
                  {lead.Phone || <span className="text-muted-foreground">{t("admin:leads.notProvided")}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("admin:leads.table.organizationType")}</dt>
                <dd className="font-medium">{orgTypeLabel(lead.OrganizationType)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("admin:leads.fields.estimatedLearners")}</dt>
                <dd className="font-medium" data-testid="lead-estimated-learners">
                  {lead.EstimatedLearners || (
                    <span className="text-muted-foreground">{t("admin:leads.notProvided")}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("admin:leads.table.source")}</dt>
                <dd className="font-medium">{lead.SourcePage}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("admin:leads.table.submitted")}</dt>
                <dd className="font-medium">{formatDateTime(lead.CreatedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("admin:leads.fields.updatedAt")}</dt>
                <dd className="font-medium">{formatDateTime(lead.UpdatedAt)}</dd>
              </div>
            </dl>

            <Separator />

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t("admin:leads.fields.message")}</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground" data-testid="lead-message">
                {lead.Message || t("admin:leads.noMessage")}
              </p>
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{t("admin:leads.detail.updateStatus")}</h3>
              <div className="space-y-1.5">
                <Label htmlFor="lead-status">{t("admin:leads.fields.status")}</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as LeadStatus)}>
                  <SelectTrigger id="lead-status" aria-label={t("admin:leads.fields.status")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`admin:leads.status.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-status-note">{t("admin:leads.fields.statusNote")}</Label>
                <Textarea
                  id="lead-status-note"
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("admin:leads.fields.statusNoteHint")}</p>
              </div>
              <Button onClick={() => void save()} disabled={updateStatus.isPending}>
                {updateStatus.isPending ? t("admin:leads.detail.saving") : t("common:actions.save")}
              </Button>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

/**
 * The lead inbox itself. It lives in its own component so that `<Can>` decides whether it is ever *mounted* —
 * a visitor without `leads.manage` must not fire `GET /api/admin/leads` just to be shown a refusal.
 */
const LeadsInbox = () => {
  const { t } = useTranslation(["admin", "common"]);
  const { formatDate, formatNumber } = useFormatters();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ANY);
  const [organizationType, setOrganizationType] = useState(ANY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [openLead, setOpenLead] = useState<LeadDto | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: LeadFilters = {
    status: status === ANY ? undefined : status,
    organizationType: organizationType === ANY ? undefined : organizationType,
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: LEADS_PAGE_SIZE,
  };

  const { data, isLoading, isError, error, isFetching } = useAdminLeadsQuery(filters);
  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const hasFilters = status !== ANY || organizationType !== ANY || !!search || !!from || !!to;

  const resetPaged = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const reset = () => {
    setSearchInput("");
    setSearch("");
    setStatus(ANY);
    setOrganizationType(ANY);
    setFrom("");
    setTo("");
    setPage(1);
  };

  const orgTypeLabel = (type: string) => t(`admin:leads.organizationType.${type}`, { defaultValue: type });

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            className="ps-9"
            placeholder={t("admin:leads.searchPlaceholder")}
            aria-label={t("common:actions.search")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <Select value={status} onValueChange={resetPaged(setStatus)}>
          <SelectTrigger aria-label={t("admin:leads.fields.status")}>
            <SelectValue placeholder={t("admin:leads.filters.anyStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t("admin:leads.filters.anyStatus")}</SelectItem>
            {LEAD_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`admin:leads.status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={organizationType} onValueChange={resetPaged(setOrganizationType)}>
          <SelectTrigger aria-label={t("admin:leads.table.organizationType")}>
            <SelectValue placeholder={t("admin:leads.filters.anyOrganizationType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t("admin:leads.filters.anyOrganizationType")}</SelectItem>
            {LEAD_ORGANIZATION_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {orgTypeLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="leads-from" className="sr-only">
              {t("admin:leads.filters.from")}
            </Label>
            <Input
              id="leads-from"
              type="date"
              aria-label={t("admin:leads.filters.from")}
              value={from}
              onChange={(event) => resetPaged(setFrom)(event.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="leads-to" className="sr-only">
              {t("admin:leads.filters.to")}
            </Label>
            <Input
              id="leads-to"
              type="date"
              aria-label={t("admin:leads.filters.to")}
              value={to}
              onChange={(event) => resetPaged(setTo)(event.target.value)}
            />
          </div>
        </div>
      </div>

      {hasFilters && (
        <div>
          <Button variant="ghost" size="sm" onClick={reset}>
            {t("admin:leads.filters.reset")}
          </Button>
        </div>
      )}

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("admin:leads.table.company")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("admin:leads.table.contact")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("admin:leads.table.email")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("admin:leads.table.organizationType")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("admin:leads.table.status")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden xl:table-cell">{t("admin:leads.table.source")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("admin:leads.table.submitted")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary inline" aria-hidden="true" />
                      <span className="sr-only">{t("admin:leads.loading")}</span>
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-destructive" data-testid="leads-error">
                      {getApiError(error, t("admin:leads.loadFailed"))}
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !isError &&
                  leads.map((lead) => (
                    <tr
                      key={lead.Id}
                      className={cn(
                        "border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer",
                        isFetching && "opacity-70"
                      )}
                      data-testid={`lead-row-${lead.Id}`}
                      onClick={() => setOpenLead(lead)}
                    >
                      <td className="px-5 py-3.5 font-semibold">
                        <button
                          type="button"
                          className="text-start hover:underline"
                          aria-label={t("admin:leads.openDetails", { company: lead.CompanyName })}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenLead(lead);
                          }}
                        >
                          {lead.CompanyName}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">{lead.ContactName}</td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground" dir="ltr">
                        {lead.Email}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">{orgTypeLabel(lead.OrganizationType)}</td>
                      <td className="px-5 py-3.5">
                        <LeadStatusBadge status={lead.Status} />
                      </td>
                      <td className="px-5 py-3.5 hidden xl:table-cell text-muted-foreground">{lead.SourcePage}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground whitespace-nowrap">
                        {formatDate(lead.CreatedAt)}
                      </td>
                    </tr>
                  ))}
                {!isLoading && !isError && leads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12" data-testid="leads-empty">
                      <Handshake className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" aria-hidden="true" />
                      <p className="text-muted-foreground">{t("admin:leads.empty")}</p>
                      {hasFilters && <p className="text-xs text-muted-foreground mt-1">{t("admin:leads.emptyHint")}</p>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {total > LEADS_PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("admin:leads.pageInfo", {
              page: formatNumber(page),
              pages: formatNumber(totalPages),
              count: total,
            })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("common:actions.previous")}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t("common:actions.next")}
            </Button>
          </div>
        </div>
      )}

      <LeadDetail lead={openLead} onOpenChange={(open) => !open && setOpenLead(null)} />
    </>
  );
};

/**
 * The B2B lead inbox (`GET /api/admin/leads`, permission `leads.manage`).
 *
 * The administrative end of the marketing site's "bring TareeqElm to your organization" form: a filterable, paged
 * table of enquiries in the same shape as the orders and audit tables next door (debounced search, plain filter
 * selects, explicit loading/empty/error rows), with a side panel carrying the full message and the one write this
 * screen allows — moving a lead along New → Contacted → Qualified → Closed, with a note.
 *
 * A lead references nothing else in the product, so there are no ids to resolve and none are rendered: every column
 * is text the visitor typed, except the source page, which is the free-text tag the form sent with it.
 */
const AdminLeads = () => {
  const { t } = useTranslation(["admin", "common"]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar onCollapse={setSidebarCollapsed} />
      <Header sidebarCollapsed={sidebarCollapsed} userRole="Admin" mobileSidebar={<AdminSidebarContent collapsed={false} />} />

      <main className={cn("pt-20 pb-12 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64")}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <Handshake className="w-7 h-7 text-primary" aria-hidden="true" />
              {t("admin:leads.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t("admin:leads.subtitle")}</p>
          </div>

          <Can
            permission={PERMISSIONS.leadsManage}
            fallback={
              <Card className="border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground" data-testid="leads-forbidden">
                  {t("admin:leads.forbidden")}
                </CardContent>
              </Card>
            }
          >
            <LeadsInbox />
          </Can>
        </div>
      </main>
    </div>
  );
};

export default AdminLeads;
