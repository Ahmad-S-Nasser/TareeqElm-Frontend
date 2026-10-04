import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Receipt, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/api";
import { useOrganizationBillingProfileQuery, useUpdateOrganizationBillingProfile } from "@/hooks/useInvoices";

interface BillingProfileFormProps {
  /** `settings.manage` — the PUT needs it; everyone else holding `organization.view` sees the profile read-only. */
  canManage: boolean;
}

/**
 * The organization's seller details for new invoices (`GET/PUT /api/Organization/billing-profile`).
 *
 * Plain controlled inputs, one `useState` per field (the codebase does not use react-hook-form). A blank field is sent
 * as null, which clears it; a blank tax rate means "print no tax line". The 0-100 range is checked here for a friendly
 * message, and the server re-checks it (400).
 */
export const BillingProfileForm = ({ canManage }: BillingProfileFormProps) => {
  const { t } = useTranslation("billing");
  const { toast } = useToast();
  const { data: profile, isLoading, isError, error } = useOrganizationBillingProfileQuery();
  const update = useUpdateOrganizationBillingProfile();

  const [legalName, setLegalName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [taxRateError, setTaxRateError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setLegalName(profile.LegalName ?? "");
    setBillingAddress(profile.BillingAddress ?? "");
    setTaxId(profile.TaxId ?? "");
    setTaxRate(typeof profile.TaxRatePercent === "number" ? String(profile.TaxRatePercent) : "");
  }, [profile]);

  const handleSave = async () => {
    let rate: number | null = null;
    if (taxRate.trim() !== "") {
      rate = Number(taxRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        setTaxRateError(t("billingProfile.taxRateInvalid"));
        return;
      }
    }
    setTaxRateError(null);
    try {
      await update.mutateAsync({ LegalName: legalName, BillingAddress: billingAddress, TaxId: taxId, TaxRatePercent: rate });
      toast({ title: t("billingProfile.saved") });
    } catch (err) {
      toast({ variant: "destructive", title: t("billingProfile.saveFailed"), description: getApiError(err) });
    }
  };

  return (
    <Card className="border-border/50" data-testid="billing-profile-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("billingProfile.title")}
        </CardTitle>
        <CardDescription>{t("billingProfile.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive" data-testid="billing-profile-error">
            {getApiError(error, t("billingProfile.loadFailed"))}
          </p>
        ) : profile === null ? (
          <p className="text-sm text-muted-foreground" data-testid="billing-profile-none">
            {t("billingProfile.noOrganization")}
          </p>
        ) : (
          <form
            className="space-y-4"
            // Our own range check shows a translated message; the browser's native bubble would not.
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="billing-legal-name">{t("billingProfile.legalName")}</Label>
              <Input
                id="billing-legal-name"
                value={legalName}
                placeholder={t("billingProfile.legalNamePlaceholder")}
                maxLength={200}
                disabled={!canManage}
                onChange={(event) => setLegalName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-address">{t("billingProfile.billingAddress")}</Label>
              <Textarea
                id="billing-address"
                value={billingAddress}
                rows={3}
                placeholder={t("billingProfile.billingAddressPlaceholder")}
                maxLength={500}
                disabled={!canManage}
                onChange={(event) => setBillingAddress(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billing-tax-id">{t("billingProfile.taxId")}</Label>
                <Input
                  id="billing-tax-id"
                  value={taxId}
                  placeholder={t("billingProfile.taxIdPlaceholder")}
                  maxLength={60}
                  disabled={!canManage}
                  onChange={(event) => setTaxId(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-tax-rate">{t("billingProfile.taxRatePercent")}</Label>
                <Input
                  id="billing-tax-rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  value={taxRate}
                  disabled={!canManage}
                  aria-invalid={taxRateError ? true : undefined}
                  aria-describedby="billing-tax-rate-hint"
                  onChange={(event) => {
                    setTaxRate(event.target.value);
                    setTaxRateError(null);
                  }}
                />
                <p
                  id="billing-tax-rate-hint"
                  className={taxRateError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                  data-testid={taxRateError ? "billing-tax-rate-error" : undefined}
                >
                  {taxRateError ?? t("billingProfile.taxRateHint")}
                </p>
              </div>
            </div>

            {canManage ? (
              <div className="flex justify-end">
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? (
                    <Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4 me-2" aria-hidden="true" />
                  )}
                  {update.isPending ? t("billingProfile.saving") : t("billingProfile.save")}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground" data-testid="billing-profile-readonly">
                {t("billingProfile.readOnly")}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default BillingProfileForm;
