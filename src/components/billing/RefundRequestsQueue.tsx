/**
 * The refund-request review queue (`GET /api/refund-requests`, permission `refund-requests.manage`).
 *
 * One shared body, two thin page shells — exactly like `RevenueDashboard`: `OrganizationRefundRequests` mounts it under
 * `OrganizationPageLayout`, `AdminRefundRequests` under the Admin sidebar/header. The server does the scoping (an
 * Organization sees its own organization's requests, Admin every organization's), so nothing here differs by role.
 *
 * A reactive browse list, not a report builder: the filter bar re-queries as it changes (the `AdminOrders` convention),
 * the previous page stays on screen while the next one loads. Approve runs the refund immediately; when the refund cannot
 * run, the server's own reason (window closed, amount above what is left, provider refused...) is shown on the row.
 */
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  REFUND_REQUESTS_PAGE_SIZE,
  REFUND_REQUEST_STATUSES,
  useApproveRefundRequest,
  useRefundRequestsQuery,
  useRejectRefundRequest,
  type RefundRequestDto,
  type RefundRequestFilters,
} from "@/hooks/useRefundRequests";
import { RefundRequestStatusBadge } from "./RefundRequestStatusBadge";

const ALL = "all";

export const RefundRequestsQueue = () => {
  const { t } = useTranslation(["billing", "common"]);
  const { formatCurrency, formatDate, formatNumber } = useFormatters();
  const { toast } = useToast();

  // Pending first: the queue is for deciding, and history is one click away.
  const [status, setStatus] = useState<string>("Pending");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [rejecting, setRejecting] = useState<RefundRequestDto | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  const filters: RefundRequestFilters = {
    status: status === ALL ? undefined : status,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: REFUND_REQUESTS_PAGE_SIZE,
  };

  const { data, isLoading, isError, error, isFetching } = useRefundRequestsQuery(filters);
  const approve = useApproveRefundRequest();
  const reject = useRejectRefundRequest();

  const requests = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / REFUND_REQUESTS_PAGE_SIZE));

  const resetPaged = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const handleApprove = async (request: RefundRequestDto) => {
    setRowError(null);
    try {
      await approve.mutateAsync({ id: request.Id });
      toast({ title: t("refundRequest.approved") });
    } catch (err) {
      // The refund's own reason, localized by the server — never a generic "something went wrong".
      const message = getApiError(err, t("refundRequest.approveFailed"));
      setRowError({ id: request.Id, message });
      toast({ variant: "destructive", title: t("refundRequest.approveFailed"), description: message });
    }
  };

  const openReject = (request: RefundRequestDto) => {
    setRowError(null);
    setNote("");
    setNoteError(null);
    setRejecting(request);
  };

  const submitReject = async (event: FormEvent) => {
    event.preventDefault();
    if (!rejecting) return;
    if (!note.trim()) {
      setNoteError(t("refundRequest.noteRequired"));
      return;
    }
    try {
      await reject.mutateAsync({ id: rejecting.Id, note });
      toast({ title: t("refundRequest.rejected") });
      setRejecting(null);
    } catch (err) {
      setNoteError(getApiError(err, t("refundRequest.rejectFailed")));
    }
  };

  const amountLabel = (request: RefundRequestDto) =>
    request.RequestedAmount != null
      ? formatCurrency(request.RequestedAmount, request.Currency)
      : t("refundRequest.everything");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select value={status} onValueChange={resetPaged(setStatus)}>
          <SelectTrigger aria-label={t("common.status")}>
            <SelectValue placeholder={t("common.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("common.allStatuses")}</SelectItem>
            {REFUND_REQUEST_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`refundRequestStatus.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div>
          <Label htmlFor="refund-requests-from" className="sr-only">
            {t("common.from")}
          </Label>
          <Input
            id="refund-requests-from"
            type="date"
            aria-label={t("common.from")}
            value={from}
            onChange={(event) => resetPaged(setFrom)(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="refund-requests-to" className="sr-only">
            {t("common.to")}
          </Label>
          <Input
            id="refund-requests-to"
            type="date"
            aria-label={t("common.to")}
            value={to}
            onChange={(event) => resetPaged(setTo)(event.target.value)}
          />
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("refundRequest.columns.trainee")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">{t("refundRequest.columns.order")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("refundRequest.columns.amount")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("refundRequest.columns.reason")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">{t("refundRequest.columns.requestedAt")}</th>
                  <th className="text-start px-5 py-3 font-semibold text-muted-foreground">{t("refundRequest.columns.status")}</th>
                  <th className="text-end px-5 py-3 font-semibold text-muted-foreground">{t("refundRequest.columns.actions")}</th>
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
                    <td colSpan={7} className="text-center py-12 text-destructive" data-testid="refund-requests-error">
                      {getApiError(error, t("refundRequest.loadFailed"))}
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !isError &&
                  requests.map((request) => (
                    <RequestRow
                      key={request.Id}
                      request={request}
                      dimmed={isFetching}
                      amount={amountLabel(request)}
                      requestedAt={formatDate(request.RequestedAt)}
                      approving={approve.isPending && approve.variables?.id === request.Id}
                      busy={approve.isPending || reject.isPending}
                      error={rowError?.id === request.Id ? rowError.message : null}
                      onApprove={() => void handleApprove(request)}
                      onReject={() => openReject(request)}
                    />
                  ))}
                {!isLoading && !isError && requests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground" data-testid="refund-requests-empty">
                      {t("refundRequest.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {total > REFUND_REQUESTS_PAGE_SIZE && (
        <div className="flex items-center justify-between" data-testid="refund-requests-pagination">
          <p className="text-xs text-muted-foreground">
            {t("refundRequest.pageInfo", {
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

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <form onSubmit={(event) => void submitReject(event)} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t("refundRequest.rejectTitle")}</DialogTitle>
              <DialogDescription>{t("refundRequest.rejectDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="refund-request-note">{t("refundRequest.note")}</Label>
              <Textarea
                id="refund-request-note"
                value={note}
                maxLength={500}
                placeholder={t("refundRequest.notePlaceholder")}
                onChange={(event) => setNote(event.target.value)}
                required
              />
            </div>
            {noteError && (
              <p className="text-sm text-destructive" role="alert" data-testid="refund-request-reject-error">
                {noteError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={reject.isPending} data-testid="refund-request-reject-submit">
                {reject.isPending ? t("refundRequest.rejecting") : t("refundRequest.rejectSubmit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface RequestRowProps {
  request: RefundRequestDto;
  dimmed: boolean;
  amount: string;
  requestedAt: string;
  approving: boolean;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
  onReject: () => void;
}

const RequestRow = ({ request, dimmed, amount, requestedAt, approving, busy, error, onApprove, onReject }: RequestRowProps) => {
  const { t } = useTranslation(["billing", "common"]);
  const pending = request.Status === "Pending";
  return (
    <>
      <tr
        className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors align-top", dimmed && "opacity-70")}
        data-testid={`refund-request-row-${request.Id}`}
      >
        <td className="px-5 py-3.5">
          <p className="font-semibold">{request.UserName ?? t("common.unknownUser")}</p>
          {request.ItemTitles.length > 0 && (
            <p className="text-xs text-muted-foreground">{request.ItemTitles.join(", ")}</p>
          )}
        </td>
        <td className="px-5 py-3.5 hidden md:table-cell font-mono text-xs">{request.OrderId}</td>
        <td className="px-5 py-3.5 tabular-nums">{amount}</td>
        <td className="px-5 py-3.5 max-w-xs">
          <p className="whitespace-pre-line break-words">{request.Reason}</p>
          {request.DecisionNote && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("refundRequest.decisionNote")}: {request.DecisionNote}
            </p>
          )}
        </td>
        <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{requestedAt}</td>
        <td className="px-5 py-3.5">
          <RefundRequestStatusBadge status={request.Status} />
        </td>
        <td className="px-5 py-3.5">
          {pending && (
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={onApprove} disabled={busy} data-testid={`refund-request-approve-${request.Id}`}>
                {approving ? (
                  <Loader2 className="h-4 w-4 me-1 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4 me-1" aria-hidden="true" />
                )}
                {approving ? t("refundRequest.approving") : t("refundRequest.approve")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={busy}
                data-testid={`refund-request-reject-${request.Id}`}
              >
                <X className="h-4 w-4 me-1" aria-hidden="true" />
                {t("refundRequest.reject")}
              </Button>
            </div>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={7} className="px-5 pb-3 text-sm text-destructive" role="alert" data-testid={`refund-request-error-${request.Id}`}>
            {error}
          </td>
        </tr>
      )}
    </>
  );
};

export default RefundRequestsQueue;
