import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, TicketPercent, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { couponReasonKey, useValidateCoupon } from "@/hooks/useCheckout";
import type { CheckoutItemDto, Money } from "@/hooks/useBilling";

export interface CouponFieldProps {
  /** The basket the code is tested against; an empty basket checks the code on its own. */
  items: CheckoutItemDto[];
  /** The code currently applied to the basket, or null. The parent owns it — this field only proposes one. */
  appliedCode: string | null;
  /** Fires with the server's normalised (uppercased, trimmed) code once it validated. */
  onApply: (code: string) => void;
  onRemove: () => void;
  /** What the applied coupon took off, as the quote reports it. Only used for the "you saved ..." line. */
  discountAmount?: Money | null;
  currency?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Coupon entry for the checkout: type a code, validate it against the real basket, apply or remove it.
 *
 * `POST /api/coupons/validate` always answers HTTP 200 — an unusable coupon comes back as `{ Valid: false,
 * ReasonCode }` — so the rejection path here is a branch on `Valid`, not an error handler. `onError` is reserved for
 * a genuine transport failure. The reason code is turned into a sentence by `couponReasonKey`; a buyer never sees a
 * raw `coupon.min_subtotal` string.
 *
 * Only one coupon can be used per order (plan §5, "coupons are not stackable"), which is why applying replaces
 * rather than accumulates.
 */
export function CouponField({
  items,
  appliedCode,
  onApply,
  onRemove,
  discountAmount,
  currency,
  disabled = false,
  className,
}: CouponFieldProps) {
  const { t } = useTranslation("billing");
  const { formatCurrency } = useFormatters();
  const validate = useValidateCoupon();

  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleApply = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || validate.isPending) return;
    setMessage(null);
    try {
      const result = await validate.mutateAsync({ code: trimmed, items });
      if (result.Valid) {
        setCode("");
        onApply(result.Code ?? trimmed.toUpperCase());
        return;
      }
      // `coupon.reason.minSubtotal` wants the minimum the coupon needs, but CouponValidationDto does not carry it
      // (it returns Valid/ReasonCode/Kind/DiscountAmount/Currency only). Rendering "at least $0.00" would be a lie,
      // so that one case falls back to the generic sentence until the API sends the threshold.
      const key = couponReasonKey(result.ReasonCode);
      setMessage(t(key === "coupon.reason.minSubtotal" ? "coupon.reason.default" : key));
    } catch (error) {
      setMessage(getApiError(error, t("checkout.coupon.checkFailed")));
    }
  };

  const handleRemove = () => {
    setMessage(null);
    setCode("");
    onRemove();
  };

  if (appliedCode) {
    return (
      <div className={cn("space-y-1", className)} data-testid="coupon-field">
        <div className="flex items-center justify-between gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2">
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span data-testid="coupon-applied">{t("checkout.coupon.applied", { code: appliedCode })}</span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="h-3.5 w-3.5 me-1" aria-hidden="true" />
            {t("checkout.coupon.remove")}
          </Button>
        </div>
        {typeof discountAmount === "number" && discountAmount > 0 && (
          <p className="text-xs text-muted-foreground" data-testid="coupon-saved">
            {t("checkout.coupon.savedAmount", { amount: formatCurrency(discountAmount, currency) })}
          </p>
        )}
      </div>
    );
  }

  return (
    <form className={cn("space-y-1.5", className)} onSubmit={handleApply} data-testid="coupon-field">
      <Label htmlFor="coupon-code" className="flex items-center gap-1.5 text-sm">
        <TicketPercent className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        {t("checkout.coupon.label")}
      </Label>
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          name="couponCode"
          autoComplete="off"
          spellCheck={false}
          className="uppercase"
          placeholder={t("checkout.coupon.placeholder")}
          value={code}
          disabled={disabled}
          onChange={(event) => {
            setCode(event.target.value);
            if (message) setMessage(null);
          }}
        />
        <Button type="submit" variant="outline" disabled={disabled || !code.trim() || validate.isPending}>
          {validate.isPending ? (
            <>
              <Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />
              {t("checkout.coupon.applying")}
            </>
          ) : (
            t("checkout.coupon.apply")
          )}
        </Button>
      </div>
      {message ? (
        <p className="text-xs text-destructive" role="alert" data-testid="coupon-message">
          {message}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("checkout.coupon.oneOnly")}</p>
      )}
    </form>
  );
}

export default CouponField;
