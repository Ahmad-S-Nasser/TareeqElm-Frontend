/**
 * Catalog & pricing (phase 5, waves F1c + F3a) — the Organization/Admin surface that decides what a course, a chapter
 * and a whole learning track cost. Two tabs: "Courses & pricing" (F1c) and "Tracks" (F3a).
 *
 * **Pricing authority belongs to Organization/Admin, never to the instructor.** `pricing.manage` is an Organization
 * default (Admin holds every permission automatically) and there is deliberately no "set your own price" control on any
 * instructor-facing screen. Every write here sits behind `<Can permission={...}>`; without it the page is a read-only
 * price list with an explanatory banner.
 *
 * **The two tabs are gated by two different permissions, and they are not interchangeable.** Course/chapter prices and
 * a *track's price* need `pricing.manage`; building a track — creating it, editing it, changing its status, reordering
 * its courses, deleting it — needs `tracks.manage`. That split is the backend's: `TracksController` carries
 * `[HasPermission(Permissions.TracksManage)]` on every action *except* `SetPricing`, which carries
 * `[HasPermission(Permissions.PricingManage)]`. Both are Organization defaults, but a custom role may hold one without
 * the other, so each control asks for its own permission rather than sharing one gate.
 *
 * The body lives in its own component (rather than in the page) so the same tabs can be mounted under the Admin shell
 * (`AdminCatalogPricing`) as well as the Organization one (`OrganizationCatalogPricing`), the way `RolesManager` is
 * shared between `AdminRoles`/`OrganizationRoles`.
 *
 * No money is computed on the client: amounts are typed into `MoneyInput` (which rounds to the currency's scale exactly
 * like the backend's `MoneyMath.Round`) and everything displayed comes back from the server as a `PricingDto`.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BookOpen,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Route,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/components/routing/Can";
import { MoneyInput } from "@/components/billing/MoneyInput";
import { PriceTag } from "@/components/billing/PriceTag";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { usePlatformCurrency } from "@/lib/money";
import { PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import {
  TRACK_STATUSES,
  type ChapterPricingWriteDto,
  type PricingWriteDto,
  type TrackStatus,
} from "@/hooks/useBilling";
import {
  useCatalogCoursesQuery,
  useCourseChaptersQuery,
  useSetChapterPricing,
  useSetCoursePricing,
  type PricedChapter,
  type PricedCourse,
} from "@/hooks/usePricing";
import {
  isTrackInUseError,
  TRACKS_PAGE_SIZE,
  useCreateTrack,
  useDeleteTrack,
  useSetTrackCourses,
  useSetTrackPricing,
  useTrackQuery,
  useTracksQuery,
  useUpdateTrack,
  type TrackPricingWrite,
  type TrackSummary,
  type TrackWrite,
} from "@/hooks/useTracks";
import { CertificateConfigForm } from "@/components/certificates/CertificateConfigForm";
import { isCertificateConfigValid, useSetTrackCertificateConfig, type CertificateConfig } from "@/hooks/useCertificates";
import { useQuizListQuery } from "@/hooks/useQuizzes";

const COURSE_STATUSES = ["Published", "Draft", "Archived"] as const;

/** `<input type="datetime-local">` wants a local wall-clock string; the API wants UTC ISO-8601. */
const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const toIso = (local: string): string | null => {
  if (!local.trim()) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

// ---------------------------------------------------------------------------
// Course price dialog
// ---------------------------------------------------------------------------

interface CoursePriceDialogProps {
  course: PricedCourse | null;
  platformCurrency: string;
  onClose: () => void;
}

const CoursePriceDialog = ({ course, platformCurrency, onClose }: CoursePriceDialogProps) => {
  const { t } = useTranslation(["billing", "common"]);
  const { toast } = useToast();
  const setPricing = useSetCoursePricing();

  const [paid, setPaid] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [compareAt, setCompareAt] = useState<number | null>(null);
  const [saleAmount, setSaleAmount] = useState<number | null>(null);
  const [saleStartsAt, setSaleStartsAt] = useState("");
  const [saleEndsAt, setSaleEndsAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // The price's own currency always wins; only a brand-new price falls back to the platform default.
  const currency = course?.Pricing?.Currency || platformCurrency;

  useEffect(() => {
    if (!course) return;
    const pricing = course.Pricing;
    setPaid(course.AccessModel === "AlaCarte" && !!pricing && !pricing.IsFree);
    setAmount(pricing && !pricing.IsFree ? pricing.Amount : null);
    setCompareAt(pricing?.CompareAtAmount ?? null);
    setSaleAmount(pricing?.SaleAmount ?? null);
    setSaleStartsAt(toLocalInput(pricing?.SaleStartsAt));
    setSaleEndsAt(toLocalInput(pricing?.SaleEndsAt));
    setFormError(null);
  }, [course]);

  const handleSave = async () => {
    if (!course) return;
    setFormError(null);

    let body: PricingWriteDto;
    if (!paid) {
      body = { IsFree: true, Amount: 0, AccessModel: "Free" };
    } else {
      if (amount === null || amount <= 0) {
        setFormError(t("billing:pricing.amountRequired"));
        return;
      }
      if (saleAmount !== null && saleAmount >= amount) {
        setFormError(t("billing:pricing.saleBelowAmount"));
        return;
      }
      const starts = toIso(saleStartsAt);
      const ends = toIso(saleEndsAt);
      if (starts && ends && new Date(starts) >= new Date(ends)) {
        setFormError(t("billing:pricing.saleWindowInvalid"));
        return;
      }
      body = {
        IsFree: false,
        Amount: amount,
        CompareAtAmount: compareAt,
        SaleAmount: saleAmount,
        SaleStartsAt: starts,
        SaleEndsAt: ends,
        Currency: currency,
        AccessModel: "AlaCarte",
      };
    }

    try {
      await setPricing.mutateAsync({ courseId: course.Id, body });
      toast({ title: t("billing:pricing.saved") });
      onClose();
    } catch (error) {
      setFormError(getApiError(error, t("billing:pricing.saveFailed")));
    }
  };

  return (
    <Dialog open={!!course} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("billing:pricing.editTitle", { title: course?.Title ?? "" })}</DialogTitle>
          <DialogDescription>{t("billing:pricing.accessModelHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="course-paid">{t("billing:pricing.accessModel")}</Label>
              <p className="text-xs text-muted-foreground">
                {paid ? t("billing:pricing.accessModelValue.AlaCarte") : t("billing:pricing.accessModelValue.Free")}
              </p>
            </div>
            <Switch
              id="course-paid"
              checked={paid}
              onCheckedChange={setPaid}
              aria-label={t("billing:pricing.accessModel")}
            />
          </div>

          {paid ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="course-amount">{t("billing:pricing.amount")}</Label>
                <MoneyInput id="course-amount" value={amount} onChange={setAmount} currency={currency} max={1000000} />
                <p className="text-xs text-muted-foreground">
                  {t("billing:pricing.currencyHint", { currency })}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="course-compare-at">{t("billing:pricing.compareAtAmount")}</Label>
                <MoneyInput
                  id="course-compare-at"
                  value={compareAt}
                  onChange={setCompareAt}
                  currency={currency}
                  max={1000000}
                />
                <p className="text-xs text-muted-foreground">{t("billing:pricing.compareAtHint")}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="course-sale-amount">{t("billing:pricing.saleAmount")}</Label>
                <MoneyInput
                  id="course-sale-amount"
                  value={saleAmount}
                  onChange={setSaleAmount}
                  currency={currency}
                  max={1000000}
                />
                <p className="text-xs text-muted-foreground">{t("billing:pricing.saleWindowHint")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="course-sale-starts">{t("billing:pricing.saleStartsAt")}</Label>
                  <Input
                    id="course-sale-starts"
                    type="datetime-local"
                    value={saleStartsAt}
                    onChange={(e) => setSaleStartsAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="course-sale-ends">{t("billing:pricing.saleEndsAt")}</Label>
                  <Input
                    id="course-sale-ends"
                    type="datetime-local"
                    value={saleEndsAt}
                    onChange={(e) => setSaleEndsAt(e.target.value)}
                  />
                </div>
              </div>

              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {t("billing:pricing.grandfatherNotice")}
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {t("billing:pricing.isFree")}
            </p>
          )}

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={setPricing.isPending}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={setPricing.isPending}>
            {setPricing.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("billing:pricing.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Chapter pricing drawer
// ---------------------------------------------------------------------------

interface ChapterDraft {
  sold: boolean;
  amount: number | null;
  saleAmount: number | null;
  isPreview: boolean;
}

const draftFrom = (chapter: PricedChapter): ChapterDraft => ({
  sold: !!chapter.Pricing && !chapter.Pricing.IsFree,
  amount: chapter.Pricing && !chapter.Pricing.IsFree ? chapter.Pricing.Amount : null,
  saleAmount: chapter.Pricing?.SaleAmount ?? null,
  isPreview: chapter.IsPreview,
});

const ChapterPricingRow = ({
  courseId,
  chapter,
  currency,
}: {
  courseId: string;
  chapter: PricedChapter;
  currency: string;
}) => {
  const { t } = useTranslation(["billing", "common"]);
  const { formatNumber } = useFormatters();
  const { toast } = useToast();
  const setChapterPricing = useSetChapterPricing();
  const [draft, setDraft] = useState<ChapterDraft>(() => draftFrom(chapter));
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => setDraft(draftFrom(chapter)), [chapter]);

  const chapterId = chapter.Id ?? "";

  const handleSave = async () => {
    setRowError(null);
    if (draft.sold && (draft.amount === null || draft.amount <= 0)) {
      setRowError(t("billing:pricing.amountRequired"));
      return;
    }
    if (draft.sold && draft.saleAmount !== null && draft.amount !== null && draft.saleAmount >= draft.amount) {
      setRowError(t("billing:pricing.saleBelowAmount"));
      return;
    }
    const body: ChapterPricingWriteDto = draft.sold
      ? { IsFree: false, Amount: draft.amount ?? 0, SaleAmount: draft.saleAmount, IsPreview: draft.isPreview }
      : { IsFree: true, Amount: 0, SaleAmount: null, IsPreview: draft.isPreview };

    try {
      await setChapterPricing.mutateAsync({ courseId, chapterId, body });
      toast({ title: t("billing:pricing.chapterSaved") });
    } catch (error) {
      setRowError(getApiError(error, t("billing:pricing.saveFailed")));
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-4" data-testid={`chapter-pricing-${chapterId}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{chapter.Title}</p>
          <p className="text-xs text-muted-foreground">
            {t("billing:pricing.table.lessons")}: {formatNumber(chapter.Lessons.length)}
          </p>
        </div>
        <PriceTag pricing={chapter.Pricing} currency={currency} size="sm" showFree={false} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`sold-${chapterId}`} className="text-sm font-normal">
          {t("billing:pricing.soldSeparately")}
        </Label>
        <Switch
          id={`sold-${chapterId}`}
          checked={draft.sold}
          onCheckedChange={(sold) => setDraft((d) => ({ ...d, sold }))}
          aria-label={t("billing:pricing.soldSeparately")}
        />
      </div>

      {draft.sold && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`amount-${chapterId}`}>{t("billing:pricing.amount")}</Label>
            <MoneyInput
              id={`amount-${chapterId}`}
              value={draft.amount}
              onChange={(amount) => setDraft((d) => ({ ...d, amount }))}
              currency={currency}
              max={1000000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`sale-${chapterId}`}>{t("billing:pricing.saleAmount")}</Label>
            <MoneyInput
              id={`sale-${chapterId}`}
              value={draft.saleAmount}
              onChange={(saleAmount) => setDraft((d) => ({ ...d, saleAmount }))}
              currency={currency}
              max={1000000}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor={`preview-${chapterId}`} className="text-sm font-normal">
            {t("billing:pricing.isPreview")}
          </Label>
          <p className="text-xs text-muted-foreground">{t("billing:pricing.isPreviewHint")}</p>
        </div>
        <Switch
          id={`preview-${chapterId}`}
          checked={draft.isPreview}
          onCheckedChange={(isPreview) => setDraft((d) => ({ ...d, isPreview }))}
          aria-label={t("billing:pricing.isPreview")}
        />
      </div>

      {rowError && (
        <p role="alert" className="text-sm text-destructive">
          {rowError}
        </p>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={setChapterPricing.isPending}>
          {setChapterPricing.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("billing:pricing.save")}
        </Button>
      </div>
    </div>
  );
};

const ChapterPricingSheet = ({
  course,
  platformCurrency,
  onClose,
}: {
  course: PricedCourse | null;
  platformCurrency: string;
  onClose: () => void;
}) => {
  const { t } = useTranslation(["billing", "common"]);
  const { data: chapters = [], isLoading, isError, error } = useCourseChaptersQuery(course?.Id ?? null);
  const currency = course?.Pricing?.Currency || platformCurrency;

  return (
    <Sheet open={!!course} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("billing:pricing.chaptersTitle", { title: course?.Title ?? "" })}</SheetTitle>
          <SheetDescription>{t("billing:pricing.chaptersSubtitle")}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}
          {isError && (
            <p className="text-sm text-destructive">{getApiError(error, t("billing:pricing.chaptersLoadFailed"))}</p>
          )}
          {!isLoading && !isError && chapters.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("billing:pricing.noChapters")}</p>
          )}
          {!isLoading &&
            !isError &&
            chapters
              .filter((chapter) => !!chapter.Id)
              .map((chapter) => (
                <ChapterPricingRow
                  key={chapter.Id}
                  courseId={course!.Id}
                  chapter={chapter}
                  currency={currency}
                />
              ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ---------------------------------------------------------------------------
// Tab 1 — courses & their chapter prices (wave F1c, behaviour unchanged by F3a)
// ---------------------------------------------------------------------------

const CoursesPricingTab = () => {
  const { t } = useTranslation(["billing", "common"]);
  const { formatNumber } = useFormatters();
  const { can } = usePermissions();
  const { currency: platformCurrency } = usePlatformCurrency();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priceCourse, setPriceCourse] = useState<PricedCourse | null>(null);
  const [chapterCourse, setChapterCourse] = useState<PricedCourse | null>(null);

  const filters = useMemo(() => ({ status: status === "all" ? undefined : status }), [status]);
  const { data: courses = [], isLoading, isError, error } = useCatalogCoursesQuery(filters);

  const canManage = can(PERMISSIONS.pricingManage);
  const term = search.trim().toLowerCase();
  const visible = term
    ? courses.filter(
        (course) =>
          course.Title.toLowerCase().includes(term) ||
          (course.InstructorName ?? "").toLowerCase().includes(term)
      )
    : courses;

  // Keep the open dialogs bound to the freshest server copy, so a saved price is reflected without reopening.
  const priceCourseLive = priceCourse ? (courses.find((c) => c.Id === priceCourse.Id) ?? priceCourse) : null;
  const chapterCourseLive = chapterCourse ? (courses.find((c) => c.Id === chapterCourse.Id) ?? chapterCourse) : null;

  return (
    <div className="space-y-6">
      {!canManage && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{t("billing:pricing.readOnly")}</p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-soft sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("billing:pricing.searchPlaceholder")}
            aria-label={t("billing:pricing.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48" aria-label={t("billing:pricing.statusFilter")}>
            <SelectValue placeholder={t("billing:pricing.allCourses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("billing:pricing.allCourses")}</SelectItem>
            {COURSE_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`billing:pricing.courseStatus.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>{t("billing:pricing.table.course")}</TableHead>
              <TableHead>{t("billing:pricing.table.instructor")}</TableHead>
              <TableHead>{t("billing:pricing.table.access")}</TableHead>
              <TableHead>{t("billing:pricing.table.price")}</TableHead>
              <TableHead>{t("billing:pricing.table.chapters")}</TableHead>
              <TableHead className="text-end">{t("common:labels.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <Loader2 className="inline h-6 w-6 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-destructive">
                  {getApiError(error, t("billing:pricing.loadFailed"))}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {t("billing:pricing.empty")}
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              visible.map((course) => (
                <TableRow key={course.Id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate">{course.Title}</p>
                        <Badge variant="outline" className="mt-0.5 text-[10px] font-normal">
                          {t(`billing:pricing.courseStatus.${course.Status}`, { defaultValue: course.Status })}
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{course.InstructorName ?? t("billing:pricing.noInstructor")}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        course.AccessModel === "AlaCarte"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {t(`billing:pricing.accessModelValue.${course.AccessModel}`, { defaultValue: course.AccessModel })}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <PriceTag pricing={course.Pricing} currency={platformCurrency} size="sm" />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {course.HasChapterPricing
                        ? t("billing:pricing.hasChapterPricing")
                        : formatNumber(course.LessonsCount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <Can permission={PERMISSIONS.pricingManage}>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPriceCourse(course)}
                          aria-label={`${t("billing:pricing.edit")}: ${course.Title}`}
                        >
                          <Tag className="me-1.5 h-3.5 w-3.5" />
                          {t("billing:pricing.edit")}
                        </Button>
                        {course.AccessModel === "AlaCarte" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setChapterCourse(course)}
                            aria-label={`${t("billing:pricing.manageChapters")}: ${course.Title}`}
                          >
                            <Layers className="me-1.5 h-3.5 w-3.5" />
                            {t("billing:pricing.manageChapters")}
                          </Button>
                        )}
                      </div>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Can permission={PERMISSIONS.pricingManage}>
        <CoursePriceDialog
          course={priceCourseLive}
          platformCurrency={platformCurrency}
          onClose={() => setPriceCourse(null)}
        />
        <ChapterPricingSheet
          course={chapterCourseLive}
          platformCurrency={platformCurrency}
          onClose={() => setChapterCourse(null)}
        />
      </Can>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab 2 — tracks (wave F3a)
// ---------------------------------------------------------------------------

/** `<Select>` has no concept of "no value", so the empty choice needs a sentinel of its own. */
const NO_DEPARTMENT = "__none__";
const ALL_STATUSES = "all";

/**
 * `GET /api/Departments` is behind `departments.manage`, which is *not* implied by `tracks.manage`. The picker is only
 * mounted for a user who holds it; everyone else simply does not see the field, and the track keeps whatever department
 * it already has (its resolved `DepartmentName` is still shown in the table).
 */
const useDepartmentOptions = (enabled: boolean) =>
  useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get<{ Id: string; Name: string }[]>("/Departments")).data,
    enabled,
    staleTime: 60_000,
  });

const clampHours = (raw: string): number | null => {
  const parsed = Number(raw.trim());
  if (!raw.trim() || !Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.round(parsed), 0), 10000);
};

// --- create / edit -------------------------------------------------------

/**
 * Create or edit a track (`tracks.manage`). Only the fields `TrackWriteDto` really accepts are here — title,
 * description, cover image, status, featured, estimated hours and department. The ordered course list has its own
 * endpoint (and its own drawer), and the price has a third one behind a different permission.
 *
 * The dialog is mounted per target (see the `key` at the call site), so it holds no stale draft and never has its
 * fields rewritten under the cursor when the list behind it refetches.
 */
const TrackDialog = ({ target, onClose }: { target: TrackSummary | "new"; onClose: () => void }) => {
  const { t } = useTranslation(["billing", "common"]);
  const { toast } = useToast();
  const { can } = usePermissions();
  const createTrack = useCreateTrack();
  const updateTrack = useUpdateTrack();

  const existing = target === "new" ? null : target;
  const [title, setTitle] = useState(existing?.Title ?? "");
  const [description, setDescription] = useState(existing?.Description ?? "");
  const [imageUrl, setImageUrl] = useState(existing?.ImageUrl ?? "");
  const [status, setStatus] = useState<TrackStatus>(existing?.Status ?? "Draft");
  const [featured, setFeatured] = useState(existing?.IsFeatured ?? false);
  const [hours, setHours] = useState(existing?.EstimatedHours != null ? String(existing.EstimatedHours) : "");
  const [departmentId, setDepartmentId] = useState(existing?.DepartmentId ?? NO_DEPARTMENT);
  const [formError, setFormError] = useState<string | null>(null);

  const canPickDepartment = can(PERMISSIONS.departmentsManage);
  const { data: departments = [] } = useDepartmentOptions(canPickDepartment);

  const pending = createTrack.isPending || updateTrack.isPending;

  const handleSave = async () => {
    setFormError(null);
    const trimmed = title.trim();
    if (trimmed.length < 2 || trimmed.length > 200) {
      setFormError(t("billing:track.titleRequired"));
      return;
    }

    const body: TrackWrite = {
      Title: trimmed,
      // An empty string clears the stored value; omitting the field would leave it alone (TrackService.UpdateAsync).
      Description: description.trim(),
      ImageUrl: imageUrl.trim(),
      Status: status,
      IsFeatured: featured,
      EstimatedHours: clampHours(hours),
    };
    if (canPickDepartment) body.DepartmentId = departmentId === NO_DEPARTMENT ? "" : departmentId;

    try {
      if (existing) await updateTrack.mutateAsync({ id: existing.Id, body });
      else await createTrack.mutateAsync(body);
      toast({ title: t("billing:track.saved") });
      onClose();
    } catch (error) {
      setFormError(getApiError(error, t("billing:track.saveFailed")));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? t("billing:track.edit") : t("billing:track.create")}</DialogTitle>
          <DialogDescription>{t("billing:track.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <div className="space-y-1.5">
            <Label htmlFor="track-title">{t("billing:track.name")}</Label>
            <Input id="track-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="track-description">{t("billing:track.description")}</Label>
            <Textarea
              id="track-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="track-image">{t("billing:track.imageUrl")}</Label>
            <Input
              id="track-image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              maxLength={2048}
              dir="ltr"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="track-status">{t("billing:track.status")}</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as TrackStatus)}>
                <SelectTrigger id="track-status" aria-label={t("billing:track.status")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACK_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`billing:track.statusValue.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="track-hours">{t("billing:track.estimatedHours")}</Label>
              <Input
                id="track-hours"
                type="number"
                min={0}
                max={10000}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>

          {canPickDepartment && (
            <div className="space-y-1.5">
              <Label htmlFor="track-department">{t("billing:track.department")}</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="track-department" aria-label={t("billing:track.department")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>{t("billing:track.noDepartment")}</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.Id} value={department.Id}>
                      {department.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
            <Label htmlFor="track-featured" className="font-normal">
              {t("billing:track.featured")}
            </Label>
            <Switch
              id="track-featured"
              checked={featured}
              onCheckedChange={setFeatured}
              aria-label={t("billing:track.featured")}
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("billing:track.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- the ordered course list --------------------------------------------

/**
 * The track builder (`tracks.manage`). `PUT /api/tracks/{id}/courses` takes the **complete ordered list**, so adding,
 * removing and reordering are all the same request — the drawer edits a local list and sends it once.
 *
 * Titles and instructor names come resolved from the server (`TrackCourseDto` for what is already in the track,
 * `CourseSummaryDto` for the picker); a course that was deleted after it was added shows a placeholder, never its id.
 */
const TrackCoursesSheet = ({ track, onClose }: { track: TrackSummary; onClose: () => void }) => {
  const { t } = useTranslation(["billing", "common"]);
  const { toast } = useToast();
  const { data: detail, isLoading, isError, error } = useTrackQuery(track.Id);
  const { data: catalog = [] } = useCatalogCoursesQuery();
  const setCourses = useSetTrackCourses();

  // Seeded once from the server's order, then owned by this drawer so a background refetch never undoes an edit.
  const [order, setOrder] = useState<string[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    if (detail) setOrder((current) => current ?? detail.Courses.map((course) => course.Id));
  }, [detail]);

  const ids = order ?? [];
  const saved = detail?.Courses.map((course) => course.Id) ?? [];
  const dirty = ids.join(",") !== saved.join(",");
  const available = catalog.filter((course) => !ids.includes(course.Id));

  const resolve = (id: string) => {
    const inTrack = detail?.Courses.find((course) => course.Id === id);
    if (inTrack?.Title) return { title: inTrack.Title, instructor: inTrack.InstructorName };
    const inCatalog = catalog.find((course) => course.Id === id);
    if (inCatalog) return { title: inCatalog.Title, instructor: inCatalog.InstructorName };
    return { title: null, instructor: null };
  };

  const move = (index: number, delta: number) =>
    setOrder((current) => {
      const next = [...(current ?? [])];
      const target = index + delta;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const handleSave = async () => {
    setFormError(null);
    try {
      await setCourses.mutateAsync({ id: track.Id, courseIds: ids });
      toast({ title: t("billing:track.coursesSaved") });
      onClose();
    } catch (err) {
      setFormError(getApiError(err, t("billing:track.coursesSaveFailed")));
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t("billing:track.coursesTitle", { title: track.Title })}</SheetTitle>
          <SheetDescription>{t("billing:track.coursesSubtitle")}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 space-y-4">
          {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}
          {isError && (
            <p role="alert" className="text-sm text-destructive">
              {getApiError(error, t("billing:track.loadFailed"))}
            </p>
          )}

          {!isLoading && !isError && (
            <>
              <p className="text-xs text-muted-foreground">{t("billing:track.reorderHint")}</p>

              {ids.length === 0 && <p className="text-sm text-muted-foreground">{t("billing:track.emptyCourses")}</p>}

              <ol className="space-y-2">
                {ids.map((id, index) => {
                  const { title, instructor } = resolve(id);
                  return (
                    <li
                      key={id}
                      data-testid={`track-course-${id}`}
                      className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-medium", !title && "text-muted-foreground italic")}>
                          {title ?? t("billing:track.deletedCourse")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {instructor ?? t("billing:pricing.noInstructor")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          aria-label={`${t("billing:track.moveUp")}: ${title ?? t("billing:track.deletedCourse")}`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index === ids.length - 1}
                          onClick={() => move(index, 1)}
                          aria-label={`${t("billing:track.moveDown")}: ${title ?? t("billing:track.deletedCourse")}`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setOrder((current) => (current ?? []).filter((c) => c !== id))}
                          aria-label={`${t("billing:track.removeCourse")}: ${title ?? t("billing:track.deletedCourse")}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="space-y-1.5">
                <Label htmlFor="track-add-course">{t("billing:track.addCourse")}</Label>
                {available.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("billing:track.allCoursesAdded")}</p>
                ) : (
                  <Select
                    value=""
                    onValueChange={(courseId) => setOrder((current) => [...(current ?? []), courseId])}
                  >
                    <SelectTrigger id="track-add-course" aria-label={t("billing:track.addCourse")}>
                      <SelectValue placeholder={t("billing:track.addCourse")} />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((course) => (
                        <SelectItem key={course.Id} value={course.Id}>
                          {course.Title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
            </>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={setCourses.isPending}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!dirty || setCourses.isPending}>
            {setCourses.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("billing:track.saveCourses")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

// --- the track's own price ----------------------------------------------

/**
 * `PUT /api/tracks/{id}/pricing` — **`pricing.manage`**, the same permission as a course price and deliberately not
 * `tracks.manage`. Same form shape as `CoursePriceDialog` minus the access model, which a track does not have.
 */
const TrackPricingDialog = ({ track, onClose }: { track: TrackSummary; onClose: () => void }) => {
  const { t } = useTranslation(["billing", "common"]);
  const { toast } = useToast();
  const { currency: platformCurrency } = usePlatformCurrency();
  const setPricing = useSetTrackPricing();

  const currency = track.Pricing?.Currency || platformCurrency;
  const [paid, setPaid] = useState(!!track.Pricing && !track.Pricing.IsFree);
  const [amount, setAmount] = useState<number | null>(
    track.Pricing && !track.Pricing.IsFree ? track.Pricing.Amount : null
  );
  const [compareAt, setCompareAt] = useState<number | null>(track.Pricing?.CompareAtAmount ?? null);
  const [saleAmount, setSaleAmount] = useState<number | null>(track.Pricing?.SaleAmount ?? null);
  const [saleStartsAt, setSaleStartsAt] = useState(toLocalInput(track.Pricing?.SaleStartsAt));
  const [saleEndsAt, setSaleEndsAt] = useState(toLocalInput(track.Pricing?.SaleEndsAt));
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);

    let body: TrackPricingWrite;
    if (!paid) {
      body = { IsFree: true, Amount: 0 };
    } else {
      if (amount === null || amount <= 0) {
        setFormError(t("billing:pricing.amountRequired"));
        return;
      }
      if (saleAmount !== null && saleAmount >= amount) {
        setFormError(t("billing:pricing.saleBelowAmount"));
        return;
      }
      const starts = toIso(saleStartsAt);
      const ends = toIso(saleEndsAt);
      if (starts && ends && new Date(starts) >= new Date(ends)) {
        setFormError(t("billing:pricing.saleWindowInvalid"));
        return;
      }
      body = {
        IsFree: false,
        Amount: amount,
        CompareAtAmount: compareAt,
        SaleAmount: saleAmount,
        SaleStartsAt: starts,
        SaleEndsAt: ends,
        Currency: currency,
      };
    }

    try {
      await setPricing.mutateAsync({ id: track.Id, body });
      toast({ title: t("billing:pricing.saved") });
      onClose();
    } catch (error) {
      setFormError(getApiError(error, t("billing:pricing.saveFailed")));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("billing:track.pricingTitle", { title: track.Title })}</DialogTitle>
          <DialogDescription>{t("billing:track.pricingHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="track-paid">{t("billing:pricing.accessModel")}</Label>
              <p className="text-xs text-muted-foreground">
                {paid ? t("billing:pricing.accessModelValue.AlaCarte") : t("billing:pricing.accessModelValue.Free")}
              </p>
            </div>
            <Switch
              id="track-paid"
              checked={paid}
              onCheckedChange={setPaid}
              aria-label={t("billing:pricing.accessModel")}
            />
          </div>

          {paid ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="track-amount">{t("billing:pricing.amount")}</Label>
                <MoneyInput id="track-amount" value={amount} onChange={setAmount} currency={currency} max={1000000} />
                <p className="text-xs text-muted-foreground">{t("billing:pricing.currencyHint", { currency })}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="track-compare-at">{t("billing:pricing.compareAtAmount")}</Label>
                <MoneyInput
                  id="track-compare-at"
                  value={compareAt}
                  onChange={setCompareAt}
                  currency={currency}
                  max={1000000}
                />
                <p className="text-xs text-muted-foreground">{t("billing:pricing.compareAtHint")}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="track-sale-amount">{t("billing:pricing.saleAmount")}</Label>
                <MoneyInput
                  id="track-sale-amount"
                  value={saleAmount}
                  onChange={setSaleAmount}
                  currency={currency}
                  max={1000000}
                />
                <p className="text-xs text-muted-foreground">{t("billing:pricing.saleWindowHint")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="track-sale-starts">{t("billing:pricing.saleStartsAt")}</Label>
                  <Input
                    id="track-sale-starts"
                    type="datetime-local"
                    value={saleStartsAt}
                    onChange={(e) => setSaleStartsAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="track-sale-ends">{t("billing:pricing.saleEndsAt")}</Label>
                  <Input
                    id="track-sale-ends"
                    type="datetime-local"
                    value={saleEndsAt}
                    onChange={(e) => setSaleEndsAt(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {t("billing:pricing.isFree")}
            </p>
          )}

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={setPricing.isPending}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={setPricing.isPending}>
            {setPricing.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("billing:pricing.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- delete, and the rule that blocks it --------------------------------

/**
 * Deleting a track (`tracks.manage`). A bundle somebody bought is never deleted out from under them: the server
 * answers **409 `track.in_use`**, which this dialog turns into "archive it instead" rather than a generic failure.
 */
const TrackDeleteDialog = ({ track, onClose }: { track: TrackSummary; onClose: () => void }) => {
  const { t } = useTranslation(["billing", "common"]);
  const { toast } = useToast();
  const deleteTrack = useDeleteTrack();
  const [formError, setFormError] = useState<string | null>(null);

  const handleDelete = async () => {
    setFormError(null);
    try {
      await deleteTrack.mutateAsync(track.Id);
      toast({ title: t("billing:track.deleted") });
      onClose();
    } catch (error) {
      setFormError(
        isTrackInUseError(error) ? t("billing:track.inUse") : getApiError(error, t("billing:track.deleteFailed"))
      );
    }
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("billing:track.deleteConfirm", { title: track.Title })}</AlertDialogTitle>
          <AlertDialogDescription>{t("billing:track.deleteConfirmHint")}</AlertDialogDescription>
        </AlertDialogHeader>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTrack.isPending}>{t("common:actions.cancel")}</AlertDialogCancel>
          {/* Not an AlertDialogAction: the dialog must stay open to show the "somebody bought it" rule. */}
          <Button variant="destructive" onClick={handleDelete} disabled={deleteTrack.isPending}>
            {deleteTrack.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("billing:track.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// --- track certificate (certificates.manage) --------------------------------

/**
 * The track's certificate exam gate: the same form as the course editor's "Certificate" tab, but the capstone quiz may
 * come from any of the track's courses. Gated by `certificates.manage`, its own permission (not tracks.manage).
 */
const TrackCertificateDialog = ({ track, onClose }: { track: TrackSummary; onClose: () => void }) => {
  const { t } = useTranslation(["certificates", "common"]);
  const { toast } = useToast();
  const detail = useTrackQuery(track.Id);
  const quizzes = useQuizListQuery();
  const setConfig = useSetTrackCertificateConfig();
  const [config, setConfigState] = useState<CertificateConfig>({
    CertificateRequiresExam: track.CertificateRequiresExam ?? false,
    CertificateExamQuizId: track.CertificateExamQuizId ?? null,
  });

  const courseIds = new Set((detail.data?.Courses ?? []).map((c) => c.Id));
  const trackQuizzes = (quizzes.data ?? []).filter((q) => courseIds.has(q.CourseId));

  const save = async () => {
    if (!isCertificateConfigValid(config)) return;
    try {
      await setConfig.mutateAsync({ trackId: track.Id, config });
      toast({ title: t("config.saved") });
      onClose();
    } catch (err) {
      toast({ variant: "destructive", title: t("config.saveFailed"), description: getApiError(err) });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("config.trackDialogTitle", { title: track.Title })}</DialogTitle>
          <DialogDescription>{t("config.trackDescription")}</DialogDescription>
        </DialogHeader>
        <CertificateConfigForm
          idPrefix="track"
          value={config}
          onChange={setConfigState}
          onSave={save}
          saving={setConfig.isPending}
          quizzes={trackQuizzes}
          quizzesLoading={detail.isLoading || quizzes.isLoading}
          quizzesError={detail.isError || quizzes.isError}
          emptyText={t("config.noTrackQuizzes")}
          showCourseTitle
        />
      </DialogContent>
    </Dialog>
  );
};

// --- the track table -----------------------------------------------------

const TracksTab = () => {
  const { t } = useTranslation(["billing", "common", "certificates"]);
  const { formatNumber } = useFormatters();
  const { can } = usePermissions();
  const { toast } = useToast();
  const { currency: platformCurrency } = usePlatformCurrency();
  const updateTrack = useUpdateTrack();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL_STATUSES);
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<TrackSummary | "new" | null>(null);
  const [coursesTrack, setCoursesTrack] = useState<TrackSummary | null>(null);
  const [priceTrack, setPriceTrack] = useState<TrackSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrackSummary | null>(null);
  const [certificateTrack, setCertificateTrack] = useState<TrackSummary | null>(null);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status === ALL_STATUSES ? undefined : status,
      page,
      pageSize: TRACKS_PAGE_SIZE,
    }),
    [search, status, page]
  );
  const { data, isLoading, isError, error } = useTracksQuery(filters);

  const tracks = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / TRACKS_PAGE_SIZE));
  const canManageTracks = can(PERMISSIONS.tracksManage);

  /** Publish/archive without opening the editor. `Title` always goes along: the write DTO requires it. */
  const setStatusOf = async (track: TrackSummary, next: TrackStatus) => {
    try {
      await updateTrack.mutateAsync({ id: track.Id, body: { Title: track.Title, Status: next } });
      toast({ title: t("billing:track.statusSaved") });
    } catch (err) {
      toast({ variant: "destructive", title: getApiError(err, t("billing:track.saveFailed")) });
    }
  };

  return (
    <div className="space-y-6">
      {!canManageTracks && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{t("billing:track.readOnly")}</p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-soft sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("billing:track.searchPlaceholder")}
            aria-label={t("billing:track.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-48" aria-label={t("billing:track.statusFilter")}>
            <SelectValue placeholder={t("billing:track.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t("billing:track.allStatuses")}</SelectItem>
            {TRACK_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`billing:track.statusValue.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Can permission={PERMISSIONS.tracksManage}>
          <Button onClick={() => setEditTarget("new")}>
            <Plus className="me-1.5 h-4 w-4" />
            {t("billing:track.create")}
          </Button>
        </Can>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>{t("billing:track.table.track")}</TableHead>
              <TableHead>{t("billing:track.table.courses")}</TableHead>
              <TableHead>{t("billing:track.table.price")}</TableHead>
              <TableHead>{t("billing:track.table.department")}</TableHead>
              <TableHead className="text-end">{t("common:labels.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <Loader2 className="inline h-6 w-6 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-destructive">
                  {getApiError(error, t("billing:track.loadFailed"))}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && tracks.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  <p>{t("billing:track.empty")}</p>
                  <p className="mt-1 text-xs">{t("billing:track.emptyHint")}</p>
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              !isError &&
              tracks.map((track) => (
                <TableRow key={track.Id} className="transition-colors hover:bg-muted/30" data-testid={`track-${track.Id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Route className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate">{track.Title}</p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {t(`billing:track.statusValue.${track.Status}`, { defaultValue: track.Status })}
                          </Badge>
                          {track.EstimatedHours != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {t("billing:track.hoursValue", { hours: formatNumber(track.EstimatedHours) })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {t("billing:track.coursesCount", { count: track.CoursesCount })}
                    </span>
                  </TableCell>
                  <TableCell>
                    {track.Pricing && !track.Pricing.IsFree ? (
                      <PriceTag pricing={track.Pricing} currency={platformCurrency} size="sm" />
                    ) : (
                      <span className="text-sm text-muted-foreground">{t("billing:track.noPrice")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {track.DepartmentName ?? t("billing:track.noDepartment")}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Can permission={PERMISSIONS.tracksManage}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditTarget(track)}
                          aria-label={`${t("billing:track.edit")}: ${track.Title}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCoursesTrack(track)}
                          aria-label={`${t("billing:track.manageCourses")}: ${track.Title}`}
                        >
                          <Layers className="h-3.5 w-3.5" />
                        </Button>
                      </Can>

                      {/* The price is a different permission from the rest of the row — see the file header. */}
                      <Can permission={PERMISSIONS.pricingManage}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPriceTrack(track)}
                          aria-label={`${t("billing:track.editPrice")}: ${track.Title}`}
                        >
                          <Tag className="h-3.5 w-3.5" />
                        </Button>
                      </Can>

                      <Can permission={PERMISSIONS.certificatesManage}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCertificateTrack(track)}
                          aria-label={`${t("certificates:config.trackAction")}: ${track.Title}`}
                        >
                          <BadgeCheck className="h-3.5 w-3.5" />
                        </Button>
                      </Can>

                      <Can permission={PERMISSIONS.tracksManage}>
                        {track.Status !== "Published" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updateTrack.isPending}
                            onClick={() => setStatusOf(track, "Published")}
                            aria-label={`${t("billing:track.publish")}: ${track.Title}`}
                          >
                            {t("billing:track.publish")}
                          </Button>
                        )}
                        {track.Status !== "Archived" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updateTrack.isPending}
                            onClick={() => setStatusOf(track, "Archived")}
                            aria-label={`${t("billing:track.archive")}: ${track.Title}`}
                          >
                            {t("billing:track.archive")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(track)}
                          aria-label={`${t("billing:track.delete")}: ${track.Title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </Can>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {total > TRACKS_PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("billing:track.pageInfo", {
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

      {/* Each overlay is mounted per target (hence the `key`), so it starts from the freshest row and keeps no draft. */}
      <Can permission={PERMISSIONS.tracksManage}>
        {editTarget && (
          <TrackDialog
            key={editTarget === "new" ? "new" : editTarget.Id}
            target={editTarget}
            onClose={() => setEditTarget(null)}
          />
        )}
        {coursesTrack && (
          <TrackCoursesSheet key={coursesTrack.Id} track={coursesTrack} onClose={() => setCoursesTrack(null)} />
        )}
        {deleteTarget && (
          <TrackDeleteDialog key={deleteTarget.Id} track={deleteTarget} onClose={() => setDeleteTarget(null)} />
        )}
      </Can>

      <Can permission={PERMISSIONS.pricingManage}>
        {priceTrack && (
          <TrackPricingDialog key={priceTrack.Id} track={priceTrack} onClose={() => setPriceTrack(null)} />
        )}
      </Can>

      <Can permission={PERMISSIONS.certificatesManage}>
        {certificateTrack && (
          <TrackCertificateDialog key={certificateTrack.Id} track={certificateTrack} onClose={() => setCertificateTrack(null)} />
        )}
      </Can>
    </div>
  );
};

// ---------------------------------------------------------------------------
// The shared body both shells mount
// ---------------------------------------------------------------------------

export const CatalogPricingManager = () => {
  const { t } = useTranslation("billing");

  return (
    <Tabs defaultValue="courses" className="space-y-6">
      <TabsList>
        <TabsTrigger value="courses">{t("pricing.tabs.courses")}</TabsTrigger>
        <TabsTrigger value="tracks">{t("pricing.tabs.tracks")}</TabsTrigger>
      </TabsList>

      <TabsContent value="courses" className="mt-0">
        <CoursesPricingTab />
      </TabsContent>
      <TabsContent value="tracks" className="mt-0">
        <TracksTab />
      </TabsContent>
    </Tabs>
  );
};

export default CatalogPricingManager;
