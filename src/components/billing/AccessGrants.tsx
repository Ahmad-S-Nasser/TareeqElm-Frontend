import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { KeyRound, Loader2, Plus, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/components/routing/Can";
import { PERMISSIONS } from "@/lib/permissions";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ENTITLEMENT_STATUSES, GRANTABLE_ITEM_TYPES, type PurchasableItemType } from "@/hooks/useBilling";
import {
  ADMIN_ENTITLEMENTS_PAGE_SIZE,
  useAdminEntitlementsQuery,
  useGrantEntitlement,
  useRevokeEntitlement,
  type EntitlementAdminDto,
} from "@/hooks/useAdminEntitlements";

const ALL = "all";

/** The course options the host page already fetched — passed in rather than requested twice. */
export interface CourseOption {
  Id: string;
  Title: string;
}

interface UserOption {
  Id: string;
  FullName: string;
  Email: string;
}

interface TrackOption {
  Id: string;
  Title: string;
}

interface ChapterOption {
  Id: string | null;
  Title: string;
}

const statusClass = (status: string) => {
  switch (status) {
    case "Active":
      return "border-success/30 bg-success/10 text-success";
    case "Revoked":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
};

export interface AccessGrantsProps {
  /** Course options the page already holds, reused for the item picker and the chapter's parent course. */
  courses: CourseOption[];
}

/**
 * The "Access" surface of the enrollment page: every entitlement on the platform
 * (`GET /api/admin/entitlements`, `entitlements.manage`), plus the two things an administrator can do to one.
 *
 *  - **Grant access** — hands a trainer what a purchase would have given them. The server refuses a grant without a
 *    reason (400 `entitlement.note_required`), so the form refuses it first and says why, rather than letting the
 *    round-trip fail.
 *  - **Revoke** — mirrors a refund: access goes, the enrollments it created are dropped, progress is kept. The reason
 *    is prompted for and stored on the grant.
 *
 * Every id is rendered as the name the server resolved for it; a deleted user or item falls back to the "deleted"
 * label rather than exposing an ObjectId.
 */
export const AccessGrants = ({ courses }: AccessGrantsProps) => {
  const { t } = useTranslation(["billing", "common"]);
  const { formatDate, formatNumber } = useFormatters();
  const { toast } = useToast();

  const [userFilter, setUserFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(1);

  const filters = {
    userId: userFilter === ALL ? undefined : userFilter,
    itemType: typeFilter === ALL ? undefined : typeFilter,
    status: statusFilter === ALL ? undefined : statusFilter,
    page,
    pageSize: ADMIN_ENTITLEMENTS_PAGE_SIZE,
  };

  const { data, isLoading, isError, error, isFetching } = useAdminEntitlementsQuery(filters);
  const grants = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_ENTITLEMENTS_PAGE_SIZE));

  // Trainers, for the filter and for the grant form's user picker.
  const { data: users = [] } = useQuery({
    queryKey: ["admin-access-users"],
    queryFn: async () =>
      (await api.get<UserOption[]>("/admin/users", { params: { role: "Trainer", pageSize: 100 } })).data,
  });

  // ---- grant form ---------------------------------------------------------
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantItemType, setGrantItemType] = useState<PurchasableItemType>("Course");
  const [grantCourseId, setGrantCourseId] = useState("");
  const [grantItemId, setGrantItemId] = useState("");
  const [grantExpiresAt, setGrantExpiresAt] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [grantError, setGrantError] = useState<string | null>(null);

  const grantEntitlement = useGrantEntitlement();
  const revokeEntitlement = useRevokeEntitlement();

  const { data: tracks = [] } = useQuery({
    queryKey: ["admin-access-tracks"],
    queryFn: async () => (await api.get<TrackOption[]>("/tracks", { params: { pageSize: 100 } })).data,
    enabled: grantOpen && grantItemType === "Track",
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["admin-access-chapters", grantCourseId],
    queryFn: async () => (await api.get<ChapterOption[]>(`/Courses/${grantCourseId}/curriculum`)).data,
    enabled: grantOpen && grantItemType === "Chapter" && !!grantCourseId,
  });

  // Switching the item kind invalidates whatever was picked for the previous kind.
  useEffect(() => {
    setGrantItemId("");
    setGrantCourseId("");
  }, [grantItemType]);

  const itemOptions = useMemo<CourseOption[]>(() => {
    if (grantItemType === "Course") return courses;
    if (grantItemType === "Track") return tracks.map((track) => ({ Id: track.Id, Title: track.Title }));
    return chapters
      .filter((chapter): chapter is { Id: string; Title: string } => !!chapter.Id)
      .map((chapter) => ({ Id: chapter.Id, Title: chapter.Title }));
  }, [grantItemType, courses, tracks, chapters]);

  const openGrant = () => {
    setGrantUserId("");
    setGrantItemType("Course");
    setGrantCourseId("");
    setGrantItemId("");
    setGrantExpiresAt("");
    setGrantNote("");
    setGrantError(null);
    setGrantOpen(true);
  };

  const submitGrant = async () => {
    if (!grantUserId) {
      setGrantError(t("entitlement.grant.userRequired"));
      return;
    }
    if (!grantItemId) {
      setGrantError(t("entitlement.grant.itemRequired"));
      return;
    }
    // The note is required by the API (400 entitlement.note_required); refuse it here so the message is immediate.
    if (grantNote.trim().length < 3) {
      setGrantError(t("entitlement.grant.noteRequired"));
      return;
    }
    setGrantError(null);
    try {
      const result = await grantEntitlement.mutateAsync({
        userId: grantUserId,
        itemType: grantItemType,
        itemId: grantItemId,
        expiresAt: grantExpiresAt || null,
        note: grantNote.trim(),
      });
      setGrantOpen(false);
      toast({
        title:
          result.EnrollmentsCreated > 0
            ? t("entitlement.grant.doneWithEnrollments", { count: result.EnrollmentsCreated })
            : t("entitlement.grant.done"),
      });
    } catch (err) {
      setGrantError(getApiError(err, t("entitlement.grant.failed")));
    }
  };

  // ---- revoke -------------------------------------------------------------
  const [pendingRevoke, setPendingRevoke] = useState<EntitlementAdminDto | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const submitRevoke = async () => {
    if (!pendingRevoke) return;
    const grant = pendingRevoke;
    try {
      await revokeEntitlement.mutateAsync({ id: grant.Id, reason: revokeReason });
      setPendingRevoke(null);
      setRevokeReason("");
      toast({ title: t("entitlement.revoke.done") });
    } catch (err) {
      toast({ variant: "destructive", title: t("entitlement.revoke.failed"), description: getApiError(err) });
    }
  };

  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6" data-testid="access-tab">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" aria-hidden="true" />
            {t("entitlement.title")}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{t("entitlement.subtitle")}</p>
        </div>
        <Can permission={PERMISSIONS.entitlementsManage}>
          <Button onClick={openGrant}>
            <Plus className="w-4 h-4 me-2" aria-hidden="true" />
            {t("entitlement.grant.action")}
          </Button>
        </Can>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select value={userFilter} onValueChange={changeFilter(setUserFilter)}>
          <SelectTrigger aria-label={t("entitlement.filterUser")}>
            <SelectValue placeholder={t("entitlement.allUsers")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("entitlement.allUsers")}</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.Id} value={user.Id}>
                {user.FullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={changeFilter(setTypeFilter)}>
          <SelectTrigger aria-label={t("entitlement.itemType")}>
            <SelectValue placeholder={t("entitlement.allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("entitlement.allTypes")}</SelectItem>
            {GRANTABLE_ITEM_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`common.itemType.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={changeFilter(setStatusFilter)}>
          <SelectTrigger aria-label={t("common.status")}>
            <SelectValue placeholder={t("common.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("common.allStatuses")}</SelectItem>
            {ENTITLEMENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`entitlement.status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("entitlement.user")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("entitlement.item")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("entitlement.source")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("common.status")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("entitlement.grantedAt")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">{t("entitlement.expiresAt")}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary inline" aria-hidden="true" />
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-destructive" data-testid="access-error">
                      {getApiError(error, t("entitlement.loadFailed"))}
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !isError &&
                  grants.map((grant) => (
                    <tr
                      key={grant.Id}
                      className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", isFetching && "opacity-70")}
                      data-testid={`access-row-${grant.Id}`}
                    >
                      <td className="px-5 py-3.5 font-semibold">{grant.UserName ?? t("common.unknownUser")}</td>
                      <td className="px-5 py-3.5">
                        <p>{grant.ItemName ?? t("common.unknownItem")}</p>
                        <p className="text-xs text-muted-foreground">
                          {t(`common.itemType.${grant.ItemType}`)}
                          {grant.CourseTitle ? ` · ${grant.CourseTitle}` : ""}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">
                        {t(`entitlement.sourceValue.${grant.Source}`)}
                        {grant.GrantedByName && (
                          <span className="block text-xs">
                            {t("entitlement.grantedBy")}: {grant.GrantedByName}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className={cn("text-xs font-semibold", statusClass(grant.Status))}>
                          {t(`entitlement.status.${grant.Status}`)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">
                        {formatDate(grant.GrantedAt)}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">
                        {grant.ExpiresAt ? formatDate(grant.ExpiresAt) : t("entitlement.neverExpires")}
                      </td>
                      <td className="px-5 py-3.5 text-end">
                        {grant.Status === "Active" && (
                          <Can permission={PERMISSIONS.entitlementsManage}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              aria-label={t("entitlement.revoke.action")}
                              onClick={() => {
                                setRevokeReason("");
                                setPendingRevoke(grant);
                              }}
                            >
                              <Undo2 className="w-4 h-4 me-1" aria-hidden="true" />
                              {t("entitlement.revoke.action")}
                            </Button>
                          </Can>
                        )}
                      </td>
                    </tr>
                  ))}
                {!isLoading && !isError && grants.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground" data-testid="access-empty">
                      {t("entitlement.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {total > ADMIN_ENTITLEMENTS_PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("entitlement.pageInfo", {
              page: formatNumber(page),
              pages: formatNumber(totalPages),
              count: formatNumber(total),
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

      {/* ------------------------------------------------------------- grant */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("entitlement.grant.title")}</DialogTitle>
            <DialogDescription>{t("entitlement.grant.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="grant-user">{t("entitlement.grant.user")}</Label>
              <Select value={grantUserId} onValueChange={setGrantUserId}>
                <SelectTrigger id="grant-user" aria-label={t("entitlement.grant.user")}>
                  <SelectValue placeholder={t("entitlement.grant.userPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.Id} value={user.Id}>
                      {user.FullName} · {user.Email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grant-item-type">{t("entitlement.grant.itemType")}</Label>
              <Select
                value={grantItemType}
                onValueChange={(value) => setGrantItemType(value as PurchasableItemType)}
              >
                <SelectTrigger id="grant-item-type" aria-label={t("entitlement.grant.itemType")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRANTABLE_ITEM_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`common.itemType.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {grantItemType === "Chapter" && (
              <div className="space-y-1.5">
                <Label htmlFor="grant-course">{t("entitlement.grant.course")}</Label>
                <Select
                  value={grantCourseId}
                  onValueChange={(value) => {
                    setGrantCourseId(value);
                    setGrantItemId("");
                  }}
                >
                  <SelectTrigger id="grant-course" aria-label={t("entitlement.grant.course")}>
                    <SelectValue placeholder={t("entitlement.grant.coursePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.Id} value={course.Id}>
                        {course.Title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="grant-item">{t("entitlement.grant.item")}</Label>
              <Select value={grantItemId} onValueChange={setGrantItemId}>
                <SelectTrigger id="grant-item" aria-label={t("entitlement.grant.item")}>
                  <SelectValue placeholder={t("entitlement.grant.itemPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {itemOptions.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">{t("entitlement.grant.noItems")}</div>
                  ) : (
                    itemOptions.map((option) => (
                      <SelectItem key={option.Id} value={option.Id}>
                        {option.Title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grant-expires">{t("entitlement.grant.expiresAt")}</Label>
              <Input
                id="grant-expires"
                type="date"
                value={grantExpiresAt}
                onChange={(event) => setGrantExpiresAt(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("entitlement.grant.expiresAtHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grant-note">{t("entitlement.grant.note")}</Label>
              <Textarea
                id="grant-note"
                rows={3}
                placeholder={t("entitlement.grant.notePlaceholder")}
                value={grantNote}
                onChange={(event) => {
                  setGrantNote(event.target.value);
                  setGrantError(null);
                }}
              />
            </div>

            {grantError && (
              <p className="text-sm text-destructive" role="alert" data-testid="grant-error">
                {grantError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void submitGrant()} disabled={grantEntitlement.isPending}>
              {t("entitlement.grant.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------ revoke */}
      <Dialog open={!!pendingRevoke} onOpenChange={(open) => !open && setPendingRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("entitlement.revoke.title")}</DialogTitle>
            <DialogDescription>{t("entitlement.revoke.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="revoke-reason">{t("entitlement.revoke.reason")}</Label>
            <Input
              id="revoke-reason"
              value={revokeReason}
              placeholder={t("entitlement.revoke.reasonPlaceholder")}
              onChange={(event) => setRevokeReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRevoke(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submitRevoke()}
              disabled={revokeEntitlement.isPending}
            >
              {t("entitlement.revoke.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccessGrants;
