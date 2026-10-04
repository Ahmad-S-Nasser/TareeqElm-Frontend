import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isCertificateConfigValid, type CertificateConfig } from "@/hooks/useCertificates";
import type { QuizSummary } from "@/hooks/useQuizzes";

interface CertificateConfigFormProps {
  /** Prefix for element ids / test ids, so a course and a track form never collide. */
  idPrefix: string;
  value: CertificateConfig;
  onChange: (value: CertificateConfig) => void;
  onSave: () => void;
  saving?: boolean;
  /** The quizzes that may serve as the exam: the course's own, or (for a track) those of the track's courses. */
  quizzes: QuizSummary[];
  quizzesLoading?: boolean;
  quizzesError?: boolean;
  /** Shown when there is no quiz to choose from. */
  emptyText: string;
  /** Prefix each quiz with its course title (a track's quizzes come from several courses). */
  showCourseTitle?: boolean;
  /** Where the threshold can actually be changed; omitted = the hint alone. */
  quizEditHref?: string;
}

/**
 * The certificate exam gate, shared by the course editor's "Certificate" tab and the track certificate dialog.
 *
 * The threshold is **read-only** here on purpose: it is the chosen quiz's own `PassingScore`, and the only place to
 * change it is the quiz itself. Turning the exam on with no quiz chosen would make the certificate silently unreachable,
 * so that state shows an inline error and cannot be saved (the server refuses it too).
 */
export const CertificateConfigForm = ({
  idPrefix,
  value,
  onChange,
  onSave,
  saving = false,
  quizzes,
  quizzesLoading = false,
  quizzesError = false,
  emptyText,
  showCourseTitle = false,
  quizEditHref,
}: CertificateConfigFormProps) => {
  const { t } = useTranslation(["certificates", "common"]);
  const valid = isCertificateConfigValid(value);
  const selected = quizzes.find((q) => q.Id === value.CertificateExamQuizId) ?? null;
  const quizLabel = (quiz: QuizSummary) =>
    showCourseTitle && quiz.CourseTitle ? `${quiz.CourseTitle} — ${quiz.Title}` : quiz.Title;

  return (
    <div className="space-y-5" data-testid={`${idPrefix}-certificate-config`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor={`${idPrefix}-requires-exam`} className="text-base">
            {t("config.requiresExam")}
          </Label>
          <p className="text-sm text-muted-foreground">{t("config.requiresExamHint")}</p>
        </div>
        <Switch
          id={`${idPrefix}-requires-exam`}
          checked={value.CertificateRequiresExam}
          onCheckedChange={(checked) => onChange({ ...value, CertificateRequiresExam: checked })}
        />
      </div>

      {value.CertificateRequiresExam && (
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-exam-quiz`}>{t("config.examQuiz")}</Label>
            {quizzesLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            ) : quizzesError ? (
              <p className="text-sm text-destructive">{t("config.quizzesLoadFailed")}</p>
            ) : quizzes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              <Select
                value={value.CertificateExamQuizId ?? ""}
                onValueChange={(quizId) => onChange({ ...value, CertificateExamQuizId: quizId || null })}
              >
                <SelectTrigger id={`${idPrefix}-exam-quiz`} className="max-w-md" aria-label={t("config.examQuiz")}>
                  <SelectValue placeholder={t("config.selectQuiz")} />
                </SelectTrigger>
                <SelectContent>
                  {quizzes.map((quiz) => (
                    <SelectItem key={quiz.Id} value={quiz.Id}>
                      {quizLabel(quiz)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selected && (
            <div className="space-y-1" data-testid={`${idPrefix}-passing-score`}>
              <p className="text-sm">
                <span className="text-muted-foreground">{t("config.passingScore")}: </span>
                <span className="font-semibold tabular-nums" dir="ltr">
                  {t("config.passingScoreValue", { score: selected.PassingScore })}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t("config.passingScoreHint")}{" "}
                {quizEditHref && (
                  <Link to={quizEditHref} className="text-primary underline-offset-2 hover:underline">
                    {t("config.editQuiz")}
                  </Link>
                )}
              </p>
            </div>
          )}

          {!valid && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive" data-testid={`${idPrefix}-certificate-error`}>
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("config.quizRequired")}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!valid || saving}>
          {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
          {t("config.save")}
        </Button>
      </div>
    </div>
  );
};

export default CertificateConfigForm;
