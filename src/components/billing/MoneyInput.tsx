import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEFAULT_CURRENCY, moneyExponent, moneyStep, parseMoney, roundMoney, toMoneyInputValue } from "@/lib/money";

export interface MoneyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "min" | "step"> {
  /** The amount the form owns, in major units. `null` means "empty", which is not the same as 0. */
  value: number | null;
  /** Fires with the parsed amount, or `null` when the field is cleared. Never fires with `NaN`. */
  onChange: (value: number | null) => void;
  /** ISO-4217 code; decides how many decimals are kept (2, 3 for JOD/KWD/..., 0 for JPY/KRW). */
  currency?: string;
  /** Upper bound, clamped on blur. The backend caps prices at 1,000,000. */
  max?: number;
  /** Shows the currency code inside the field. */
  showCurrency?: boolean;
}

/**
 * A controlled money field for admin price-entry forms.
 *
 * Negative amounts are impossible (the sign character never reaches the value), and on blur the amount is rounded to
 * the currency's scale with `roundMoney`, the same rule the backend's `MoneyMath.Round` applies — so what the form
 * shows is what the server will store. While the user is still typing, the raw text is left alone, so a half-entered
 * "12." or "0.50" is never rewritten under the cursor.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    { value, onChange, currency = DEFAULT_CURRENCY, max, showCurrency = true, className, onBlur, disabled, ...props },
    ref
  ) => {
    const exponent = moneyExponent(currency);
    const [text, setText] = React.useState(() => toMoneyInputValue(value, currency));

    // Follow the value the form owns, but never fight a half-typed number: only rewrite when the text no longer
    // parses back to the current value.
    React.useEffect(() => {
      setText((current) => (parseMoney(current) === value ? current : toMoneyInputValue(value, currency)));
    }, [value, currency]);

    const clamp = (amount: number) => Math.min(Math.max(amount, 0), max ?? Number.MAX_SAFE_INTEGER);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      // Strip the sign characters outright: a price is never negative.
      const next = event.target.value.replace(/[-+−]/g, "");
      setText(next);
      if (next.trim() === "") {
        onChange(null);
        return;
      }
      const parsed = parseMoney(next);
      if (parsed === null) return; // keep the text, keep the last good value
      onChange(clamp(parsed));
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      const parsed = parseMoney(text);
      if (parsed === null) {
        setText("");
        onChange(null);
      } else {
        const rounded = roundMoney(clamp(parsed), currency);
        setText(toMoneyInputValue(rounded, currency));
        onChange(rounded);
      }
      onBlur?.(event);
    };

    return (
      <div className={cn("relative", className)}>
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode={exponent === 0 ? "numeric" : "decimal"}
          autoComplete="off"
          disabled={disabled}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn("text-start tabular-nums", showCurrency && "pe-14")}
          data-testid="money-input"
          data-currency={currency}
          data-step={moneyStep(currency)}
        />
        {showCurrency && (
          <span
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground"
            aria-hidden="true"
          >
            {currency}
          </span>
        )}
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";

export default MoneyInput;
