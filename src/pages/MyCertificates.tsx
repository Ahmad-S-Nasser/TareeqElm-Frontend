import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft, Award, BadgeCheck, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { CertificateView } from "@/components/certificates/CertificateView";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMyCertificatesQuery } from "@/hooks/useCertificates";

/**
 * The trainee's certificates (`GET /api/certificates/me`, `certificates.self`): the list at `/certificates`, and one
 * printable certificate at `/certificates/:certificateId`. Printing follows `OrderReceipt`: the chrome is `print:hidden`
 * and `window.print()` does the rest.
 */
const MyCertificates = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation(["certificates", "common"]);
  const { formatDate, formatPercent } = useFormatters();
  const { certificateId } = useParams<{ certificateId: string }>();
  const { data: certificates = [], isLoading, isError, error } = useMyCertificatesQuery();
  const selected = certificateId ? certificates.find((c) => c.Id === certificateId) ?? null : null;

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="print:hidden">
        <ApplicantSidebar onCollapse={setSidebarCollapsed} />
        <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />
      </div>

      <main
        className={cn(
          "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
          "ms-0",
          "print:p-0 print:m-0 print:pt-0"
        )}
      >
        <div className="max-w-5xl mx-auto space-y-6 print:max-w-none">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : isError ? (
            <div className="text-center py-16 space-y-2" data-testid="certificates-error">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" aria-hidden="true" />
              <p className="text-destructive">{getApiError(error, t("mine.loadFailed"))}</p>
            </div>
          ) : certificateId ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <Button variant="ghost" size="sm" className="-ms-2 text-muted-foreground" asChild>
                  <Link to="/certificates">
                    <ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" aria-hidden="true" />
                    {t("view.back")}
                  </Link>
                </Button>
                {selected && (
                  <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="certificate-print">
                    <Printer className="h-4 w-4 me-2" aria-hidden="true" />
                    {t("view.print")}
                  </Button>
                )}
              </div>
              {selected ? (
                <CertificateView certificate={selected} />
              ) : (
                <p className="text-center py-16 text-muted-foreground" data-testid="certificate-not-found">{t("view.notFound")}</p>
              )}
            </>
          ) : (
            <>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("mine.title")}</h1>
                <p className="text-muted-foreground mt-1">{t("mine.subtitle")}</p>
              </div>

              {certificates.length === 0 ? (
                <div className="text-center py-20 bg-card/40 rounded-2xl border border-dashed border-border/50" data-testid="certificates-empty">
                  <Award className="w-14 h-14 mx-auto text-muted-foreground mb-4 opacity-30" aria-hidden="true" />
                  <h2 className="text-xl font-medium">{t("mine.empty")}</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mt-1">{t("mine.emptyHint")}</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2" data-testid="certificates-list">
                  {certificates.map((certificate) => (
                    <Card key={certificate.Id} className="border-border/50">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <BadgeCheck className="h-6 w-6 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{certificate.Title}</p>
                              <p className="text-xs text-muted-foreground">
                                {certificate.OrganizationName ?? t("platformName")}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">{t(`scope.${certificate.Scope}`)}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{t("mine.issuedOn", { date: formatDate(certificate.IssuedAt) })}</span>
                          {certificate.ExamPercentage != null && (
                            <span>
                              {t("view.examScore")}: <bdi className="tabular-nums">{formatPercent(certificate.ExamPercentage)}</bdi>
                            </span>
                          )}
                          {certificate.Manual && <span>{t("mine.manual")}</span>}
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/certificates/${certificate.Id}`}>{t("mine.open")}</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default MyCertificates;
