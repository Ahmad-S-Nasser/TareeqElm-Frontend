import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft, Building2, Loader2, Printer } from "lucide-react";
import { OrganizationSidebar, OrganizationSidebarContent } from "@/components/layout/OrganizationSidebar";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Can } from "@/components/routing/Can";
import { InvoiceStatusBadge } from "@/components/billing/InvoiceStatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOrganizationInvoiceQuery, type InvoiceDetailDto } from "@/hooks/useInvoices";
// Stored logos are often relative `/uploads/...` paths; same resolution PlatformSettingsForm uses.
import { getApiOrigin } from "@/hooks/useCourseEditor";

/**
 * One invoice, printable (`GET /api/organization/invoices/{id}`, `invoices.view`).
 *
 * Follows {@link OrderReceipt}'s print convention: `print:` utilities hide the app chrome and flatten the card, and the
 * Print button just calls `window.print()` — no PDF library. Every figure and name printed here is the snapshot taken
 * when the invoice was issued; the tax line only exists when the organization had a tax rate at that moment.
 */
const InvoiceBody = ({ invoice }: { invoice: InvoiceDetailDto }) => {
  const { t } = useTranslation(["billing", "common"]);
  const { formatCurrency, formatDate, formatNumber } = useFormatters();
  const money = (value: number) => formatCurrency(value, invoice.Currency);
  const brandName = invoice.OrganizationName?.trim() || invoice.SellerLegalNameSnapshot;
  const showLegalName = !!invoice.SellerLegalNameSnapshot && invoice.SellerLegalNameSnapshot !== brandName;

  return (
    <Card className="print:border-0 print:shadow-none" data-testid="invoice-document">
      <CardContent className="p-6 sm:p-10 space-y-8 print:p-0">
        {/* Letterhead */}
        <div className="flex flex-wrap items-start justify-between gap-6" data-testid="invoice-letterhead">
          <div className="flex items-start gap-4 min-w-0">
            {invoice.OrganizationLogoUrl ? (
              <img
                src={
                  /^https?:\/\//i.test(invoice.OrganizationLogoUrl)
                    ? invoice.OrganizationLogoUrl
                    : `${getApiOrigin()}${invoice.OrganizationLogoUrl}`
                }
                alt={brandName}
                className="h-14 w-14 rounded-lg object-contain shrink-0"
                data-testid="invoice-logo"
              />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 print:hidden">
                <Building2 className="h-7 w-7 text-primary" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 space-y-0.5 text-sm">
              <p className="text-xl font-bold" data-testid="invoice-org-name">{brandName}</p>
              {showLegalName && <p className="font-medium">{invoice.SellerLegalNameSnapshot}</p>}
              {invoice.SellerAddressSnapshot && (
                <p className="text-muted-foreground whitespace-pre-line" data-testid="invoice-seller-address">
                  {invoice.SellerAddressSnapshot}
                </p>
              )}
              {invoice.SellerTaxIdSnapshot && (
                <p className="text-muted-foreground" data-testid="invoice-seller-tax-id">
                  {t("invoice.document.taxId", { taxId: invoice.SellerTaxIdSnapshot })}
                </p>
              )}
            </div>
          </div>

          <div className="text-end space-y-1">
            <p className="text-3xl font-black tracking-tight uppercase">{t("invoice.document.title")}</p>
            <dl className="text-sm space-y-0.5">
              <div className="flex justify-end gap-2">
                <dt className="text-muted-foreground">{t("invoice.document.number")}</dt>
                <dd className="font-mono font-semibold" data-testid="invoice-number">
                  <bdi>{invoice.InvoiceNumber}</bdi>
                </dd>
              </div>
              <div className="flex justify-end gap-2">
                <dt className="text-muted-foreground">{t("invoice.document.issued")}</dt>
                <dd data-testid="invoice-issued-at">{formatDate(invoice.IssuedAt)}</dd>
              </div>
            </dl>
            <div className="pt-1 flex justify-end gap-1.5">
              <InvoiceStatusBadge status={invoice.Status} />
              {(invoice.OrderStatus === "PartiallyRefunded" || invoice.OrderStatus === "Refunded") && (
                <Badge variant="outline" className="text-destructive border-destructive/40" data-testid="invoice-refund-badge">
                  {t(`invoice.document.orderStatus.${invoice.OrderStatus}`)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {invoice.Status === "Voided" && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive" data-testid="invoice-voided">
            {t("invoice.document.voided")}
          </p>
        )}

        <Separator />

        {/* Bill to */}
        <div className="grid gap-6 sm:grid-cols-2 text-sm">
          <div className="space-y-1" data-testid="invoice-bill-to">
            <p className="text-xs font-semibold text-muted-foreground">{t("invoice.document.billTo")}</p>
            <p className="font-semibold">{invoice.BuyerNameSnapshot}</p>
            {invoice.BuyerBillingSnapshot && (
              <p className="text-muted-foreground whitespace-pre-line" data-testid="invoice-buyer-billing">
                {invoice.BuyerBillingSnapshot}
              </p>
            )}
          </div>
          <div className="space-y-1 sm:text-end">
            <p className="text-xs font-semibold text-muted-foreground">{t("invoice.document.orderReference")}</p>
            <p className="font-mono text-xs">
              <bdi>{invoice.OrderId}</bdi>
            </p>
          </div>
        </div>

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="invoice-lines">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2 pe-4 font-semibold">{t("invoice.document.item")}</th>
                <th className="text-end py-2 px-4 font-semibold">{t("invoice.document.unitAmount")}</th>
                <th className="text-end py-2 px-4 font-semibold">{t("invoice.document.discount")}</th>
                <th className="text-end py-2 ps-4 font-semibold">{t("invoice.document.lineTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.LineItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    {t("invoice.document.noLines")}
                  </td>
                </tr>
              ) : (
                invoice.LineItems.map((line, index) => (
                  <tr key={`${line.TitleSnapshot}-${index}`} className="border-b border-border/40">
                    <td className="py-2.5 pe-4">{line.TitleSnapshot || t("common.unknownItem")}</td>
                    <td className="py-2.5 px-4 text-end tabular-nums">{money(line.UnitAmount)}</td>
                    <td className="py-2.5 px-4 text-end tabular-nums text-muted-foreground">
                      {line.DiscountAmount > 0 ? `-${money(line.DiscountAmount)}` : "—"}
                    </td>
                    <td className="py-2.5 ps-4 text-end tabular-nums font-medium">{money(line.LineTotal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <dl className="w-full sm:w-72 space-y-1.5 text-sm" data-testid="invoice-totals">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("invoice.document.subtotal")}</dt>
              <dd className="tabular-nums" data-testid="invoice-subtotal">{money(invoice.Subtotal)}</dd>
            </div>
            {invoice.DiscountAmount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("invoice.document.discountTotal")}</dt>
                <dd className="tabular-nums" data-testid="invoice-discount">-{money(invoice.DiscountAmount)}</dd>
              </div>
            )}
            {invoice.TaxRatePercentSnapshot !== null && invoice.TaxRatePercentSnapshot !== undefined && (
              <div className="flex justify-between gap-4" data-testid="invoice-tax">
                <dt className="text-muted-foreground">
                  {t("invoice.document.tax", { rate: formatNumber(invoice.TaxRatePercentSnapshot) })}
                </dt>
                <dd className="tabular-nums">{money(invoice.TaxAmount)}</dd>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between gap-4 text-base font-bold">
              <dt>{t("invoice.document.total")}</dt>
              <dd className="tabular-nums" data-testid="invoice-total">{money(invoice.Total)}</dd>
            </div>
            {invoice.RefundedAmount > 0 && (
              <>
                <div className="flex justify-between gap-4 text-destructive" data-testid="invoice-refunded">
                  <dt>{t("invoice.document.refunded")}</dt>
                  <dd className="tabular-nums">-{money(invoice.RefundedAmount)}</dd>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between gap-4 text-base font-bold">
                  <dt>{t("invoice.document.amountDue")}</dt>
                  <dd className="tabular-nums" data-testid="invoice-balance">{money(invoice.Total - invoice.RefundedAmount)}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
};

const InvoiceDocument = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation(["billing", "common"]);
  const { invoiceId } = useParams<{ invoiceId: string }>();

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="print:hidden">
        <OrganizationSidebar onCollapse={setSidebarCollapsed} />
        <Header
          sidebarCollapsed={sidebarCollapsed}
          userRole="Organization"
          mobileSidebar={<OrganizationSidebarContent collapsed={false} />}
        />
      </div>

      <main
        className={cn(
          "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
          "ms-0",
          "print:p-0 print:m-0 print:pt-0"
        )}
      >
        <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:space-y-4">
          <Can
            permission={PERMISSIONS.invoicesView}
            fallback={
              <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground" data-testid="invoice-no-access">
                {t("invoice.noAccess")}
              </p>
            }
          >
            <InvoiceDocumentContent invoiceId={invoiceId} />
          </Can>
        </div>
      </main>
    </div>
  );
};

const InvoiceDocumentContent = ({ invoiceId }: { invoiceId?: string }) => {
  const { t } = useTranslation(["billing", "common"]);
  const { data: invoice, isLoading, isError, error } = useOrganizationInvoiceQuery(invoiceId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" className="-ms-2 text-muted-foreground" asChild>
          <Link to="/organization/invoices">
            <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" aria-hidden="true" />
            {t("invoice.document.back")}
          </Link>
        </Button>
        {invoice && (
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="invoice-print">
            <Printer className="h-4 w-4 me-2" aria-hidden="true" />
            {t("invoice.document.print")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : isError || !invoice ? (
        <div className="text-center py-16 space-y-2" data-testid="invoice-error">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" aria-hidden="true" />
          <p className="text-destructive">{getApiError(error, t("invoice.document.loadFailed"))}</p>
          <Button variant="outline" className="mt-2" asChild>
            <Link to="/organization/invoices">{t("invoice.document.back")}</Link>
          </Button>
        </div>
      ) : (
        <InvoiceBody invoice={invoice} />
      )}
    </>
  );
};

export default InvoiceDocument;
