/**
 * The Financial/Orders report (reports plan, Phase 3).
 *
 *   GET /api/organization/invoices/report?status=&from=&to=&search=&provider=&itemId=&page=&pageSize=   (invoices.view)
 *
 * Kept in its own module rather than in ./useInvoices.ts because that file belongs to the invoices UI work that was
 * being edited concurrently; everything here is additive and only imports types/keys from it.
 *
 * Unlike the reactive invoice list, this query only runs once the report page's "Generate report" button has been
 * clicked: pass `enabled = useReportBuilder().hasGenerated` and the applied (not the live) filters.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import type { Money } from './useBilling';
import { invoiceKeys, type InvoiceListDto } from './useInvoices';

export const INVOICE_REPORT_PAGE_SIZE = 20;

/** `InvoiceListDto` as the report returns it (the server also fills these two on the plain list). */
export interface InvoiceReportRowDto extends InvoiceListDto {
  OrderId: string | null;
  TaxAmount: Money;
}

/** `InvoiceReportDto` — one page of rows plus totals over EVERY matching invoice, not just this page. */
export interface InvoiceReportDto {
  Items: { Items: InvoiceReportRowDto[]; Total: number };
  TotalAmount: Money;
  TotalTax: Money;
  /** Sum of the live RefundedAmount (from each invoice's own order) over every matching invoice. */
  TotalRefunded: Money;
  Count: number;
  /** The single currency of every matching invoice; null when there are none or they are mixed. */
  Currency: string | null;
}

export interface InvoiceReportFilters {
  status?: string;
  /** Bare date; the server reads a bare `to` through the end of that day. */
  from?: string;
  to?: string;
  /** Invoice number, buyer name or order id. */
  search?: string;
  /** Payment provider ("mock", "manual", ...). */
  provider?: string;
  /** Only invoices whose order has a line for this course/track id. */
  itemId?: string;
  page?: number;
  pageSize?: number;
}

export const invoiceReportKeys = {
  all: [...invoiceKeys.all, 'report'] as const,
  report: (filters: InvoiceReportFilters, runId = 0) =>
    [
      ...invoiceReportKeys.all,
      filters.status ?? '',
      filters.from ?? '',
      filters.to ?? '',
      filters.search ?? '',
      filters.provider ?? '',
      filters.itemId ?? '',
      filters.page ?? 1,
      filters.pageSize ?? INVOICE_REPORT_PAGE_SIZE,
      runId,
    ] as const,
};

export const invoiceReportParams = (filters: InvoiceReportFilters) => ({
  status: filters.status || undefined,
  from: filters.from || undefined,
  to: filters.to || undefined,
  search: filters.search?.trim() || undefined,
  provider: filters.provider || undefined,
  itemId: filters.itemId || undefined,
  page: filters.page ?? 1,
  pageSize: filters.pageSize ?? INVOICE_REPORT_PAGE_SIZE,
});

export const fetchInvoiceReport = async (filters: InvoiceReportFilters): Promise<InvoiceReportDto> => {
  const res = await api.get<InvoiceReportDto>('/organization/invoices/report', { params: invoiceReportParams(filters) });
  const data = res.data;
  return {
    Items: { Items: data?.Items?.Items ?? [], Total: Number(data?.Items?.Total ?? 0) },
    TotalAmount: Number(data?.TotalAmount ?? 0),
    TotalTax: Number(data?.TotalTax ?? 0),
    TotalRefunded: Number(data?.TotalRefunded ?? 0),
    Count: Number(data?.Count ?? 0),
    Currency: data?.Currency ?? null,
  };
};

/**
 * `GET /api/organization/invoices/report`. Idle until `enabled` (the report page's `hasGenerated`); `runId` from
 * `useReportBuilder` is part of the key so clicking Generate again with the same filters re-fires the request.
 */
export const useInvoiceReportQuery = (filters: InvoiceReportFilters | null, options: { enabled: boolean; runId?: number }) => {
  const { user } = useAuth();
  const applied = filters ?? {};
  return useQuery({
    queryKey: invoiceReportKeys.report(applied, options.runId ?? 0),
    queryFn: () => fetchInvoiceReport(applied),
    enabled: !!user && options.enabled && filters !== null,
    placeholderData: keepPreviousData,
  });
};
