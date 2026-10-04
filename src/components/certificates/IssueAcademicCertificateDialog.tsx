import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useIssueAcademicCertificate } from "@/hooks/useCertificates";

const MIN_TITLE = 2;
const MAX_TITLE = 200;

interface IssueAcademicCertificateDialogProps {
  trainee: { Id: string; FullName: string } | null;
  onClose: () => void;
}

/**
 * The manual half of academic certificates (`POST /api/certificates/academic`, `certificates.issue`): an Organization
 * awards one of its trainees a certificate at its discretion. The automatic half (completing every course of a School
 * grade) needs no UI; it simply appears in the trainee's certificates.
 */
export const IssueAcademicCertificateDialog = ({ trainee, onClose }: IssueAcademicCertificateDialogProps) => {
  const { t } = useTranslation(["certificates", "common"]);
  const { toast } = useToast();
  const issue = useIssueAcademicCertificate();
  const [title, setTitle] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = title.trim();
  const valid = trimmed.length >= MIN_TITLE && trimmed.length <= MAX_TITLE;

  const close = () => {
    setTitle("");
    setTouched(false);
    onClose();
  };

  const submit = async () => {
    setTouched(true);
    if (!trainee || !valid) return;
    try {
      await issue.mutateAsync({ TrainerId: trainee.Id, Title: trimmed });
      toast({ title: t("issue.issued") });
      close();
    } catch (err) {
      toast({ variant: "destructive", title: t("issue.failed"), description: getApiError(err) });
    }
  };

  return (
    <Dialog open={!!trainee} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("issue.title")}</DialogTitle>
          <DialogDescription>{t("issue.description", { name: trainee?.FullName ?? "" })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="academic-certificate-title">{t("issue.titleLabel")}</Label>
          <Input
            id="academic-certificate-title"
            value={title}
            maxLength={MAX_TITLE}
            placeholder={t("issue.titlePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && !valid}
          />
          {touched && !valid ? (
            <p role="alert" className="text-sm text-destructive">{t("issue.titleInvalid")}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("issue.titleHint")}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>{t("common:actions.cancel")}</Button>
          <Button onClick={submit} disabled={issue.isPending}>
            {issue.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {t("issue.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default IssueAcademicCertificateDialog;
