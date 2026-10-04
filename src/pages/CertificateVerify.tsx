import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, BadgeCheck, Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useFormatters } from "@/lib/format";
import { getHttpStatus } from "@/hooks/useQuizzes";
import { useCertificateVerificationQuery } from "@/hooks/useCertificates";

/**
 * The public certificate check at `/verify/:code` — no sign-in, like the auth pages. It shows exactly what is printed on
 * the certificate, from the server-held record (`GET /api/certificates/verify/{code}`, anonymous): that record, not the
 * printout, is what makes a certificate trustworthy.
 */
const CertificateVerify = () => {
  const { t } = useTranslation(["certificates", "common"]);
  const { formatDate, formatPercent } = useFormatters();
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, isError, error } = useCertificateVerificationQuery(code);
  const notFound = isError && getHttpStatus(error) === 404;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="font-bold text-primary">{t("platformName")}</Link>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-2xl">{t("verify.title")}</CardTitle>
            {code && (
              <CardDescription>
                {t("verify.code")}: <bdi className="font-mono">{code}</bdi>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : notFound || !code ? (
              <div className="text-center py-8 space-y-2" data-testid="verify-not-found">
                <ShieldX className="h-12 w-12 text-destructive mx-auto" aria-hidden="true" />
                <p className="font-semibold text-destructive">{t("verify.notFound")}</p>
                <p className="text-sm text-muted-foreground">{t("verify.notFoundHint")}</p>
              </div>
            ) : isError || !data ? (
              <div className="text-center py-8 space-y-2" data-testid="verify-error">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto" aria-hidden="true" />
                <p className="text-destructive">{t("verify.loadFailed")}</p>
              </div>
            ) : (
              <div className="space-y-6" data-testid="verify-valid">
                <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
                  <BadgeCheck className="h-6 w-6 text-success shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-success">{t("verify.valid")}</p>
                    <p className="text-sm text-muted-foreground">{t("verify.validHint")}</p>
                  </div>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
                  <dt className="text-muted-foreground">{t("verify.trainee")}</dt>
                  <dd className="font-semibold" data-testid="verify-trainee">{data.TrainerName ?? t("view.unknownTrainee")}</dd>
                  <dt className="text-muted-foreground">{t("verify.credential")}</dt>
                  <dd className="font-semibold" data-testid="verify-title">{data.Title}</dd>
                  <dt className="text-muted-foreground">{t("verify.type")}</dt>
                  <dd>{t(`scope.${data.Scope}`)}</dd>
                  <dt className="text-muted-foreground">{t("verify.issuer")}</dt>
                  <dd data-testid="verify-issuer">{data.IssuerName ?? t("platformName")}</dd>
                  <dt className="text-muted-foreground">{t("verify.issuedOn")}</dt>
                  <dd>{formatDate(data.IssuedAt)}</dd>
                  {data.ExamPercentage != null && (
                    <>
                      <dt className="text-muted-foreground">{t("verify.examScore")}</dt>
                      <dd className="tabular-nums" data-testid="verify-exam-score">{formatPercent(data.ExamPercentage)}</dd>
                    </>
                  )}
                </dl>
              </div>
            )}
            <div className="mt-8 flex justify-center">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">{t("verify.signIn")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CertificateVerify;
