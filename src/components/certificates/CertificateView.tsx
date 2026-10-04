import { useTranslation } from "react-i18next";
import { Award } from "lucide-react";
import { useFormatters } from "@/lib/format";
import { certificateVerifyUrl, type Certificate } from "@/hooks/useCertificates";

interface CertificateViewProps {
  certificate: Certificate;
  /** Overridable for tests; defaults to the current origin. */
  origin?: string;
}

/**
 * One certificate, laid out to print. It follows `OrderReceipt`'s print-CSS convention — `print:` utilities flatten the
 * frame and the page chrome is hidden by the caller — so Ctrl+P (or the page's Print button) yields a clean page with no
 * PDF generator. The trust does not come from the file: the certificate prints its own public `/verify/:code` URL as
 * plain text, and that server-held record is what anyone checking it relies on.
 */
export const CertificateView = ({ certificate, origin }: CertificateViewProps) => {
  const { t } = useTranslation("certificates");
  const { formatDate, formatPercent } = useFormatters();
  const verifyUrl = certificateVerifyUrl(certificate.VerificationCode, origin);
  const academic = certificate.Scope === "Academic";

  return (
    <article
      className="relative mx-auto max-w-3xl rounded-2xl border-4 border-double border-primary/40 bg-card p-8 text-center shadow-soft sm:p-12 print:max-w-none print:rounded-none print:border-primary/60 print:shadow-none"
      data-testid="certificate-view"
    >
      <Award className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        {certificate.OrganizationName ?? t("platformName")}
      </p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
        {academic ? t("view.headingAcademic") : t("view.headingCompletion")}
      </h1>

      <p className="mt-8 text-muted-foreground">{t("view.presentedTo")}</p>
      <p className="mt-2 text-2xl font-semibold sm:text-3xl" data-testid="certificate-trainee">
        {certificate.TrainerName ?? t("view.unknownTrainee")}
      </p>
      <p className="mt-4 text-muted-foreground">{academic ? t("view.awarded") : t("view.completed")}</p>
      <p className="mt-2 text-xl font-semibold text-primary sm:text-2xl" data-testid="certificate-title">
        {certificate.Title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t(`scope.${certificate.Scope}`)}</p>

      <dl className="mx-auto mt-8 grid max-w-xl gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t("view.issuedBy")}</dt>
          <dd className="font-medium">{certificate.OrganizationName ?? t("platformName")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("view.issuedOn")}</dt>
          <dd className="font-medium">{formatDate(certificate.IssuedAt)}</dd>
        </div>
        {certificate.ExamPercentage != null && (
          <div>
            <dt className="text-muted-foreground">{t("view.examScore")}</dt>
            <dd className="font-medium tabular-nums" data-testid="certificate-exam-score">
              {formatPercent(certificate.ExamPercentage)}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-10 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <p>{t("view.verifyAt")}</p>
        <p className="mt-1 break-all font-mono text-foreground" dir="ltr" data-testid="certificate-verify-url">
          {verifyUrl}
        </p>
        <p className="mt-1">
          {t("view.code")}: <bdi className="font-mono">{certificate.VerificationCode}</bdi>
        </p>
      </div>
    </article>
  );
};

export default CertificateView;
