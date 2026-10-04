import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useFormatters } from "@/lib/format";
import { DEFAULT_CURRENCY } from "@/lib/money";
import type { PricingDto } from "@/hooks/useBilling";

const SIZE_CLASSES = {
  sm: { price: "text-sm font-semibold", compare: "text-xs", badge: "text-[10px] px-1.5 py-0" },
  md: { price: "text-base font-semibold", compare: "text-sm", badge: "text-[10px] px-1.5 py-0.5" },
  lg: { price: "text-2xl font-bold", compare: "text-base", badge: "text-xs px-2 py-0.5" },
} as const;

export interface PriceTagProps {
  /** The server-computed price. `null`/`undefined` (or `IsFree`) renders the free label. */
  pricing?: PricingDto | null;
  /** Currency used only when there is no `pricing` to read one from; defaults to USD. */
  currency?: string;
  /** Renders an "Owned" badge instead of a price — the caller decides what "owned" means (`Owned` on the DTO). */
  owned?: boolean;
  size?: keyof typeof SIZE_CLASSES;
  /** Set false to render nothing at all when the item is free (e.g. a card that should stay bare). */
  showFree?: boolean;
  /** Hides the "On sale" badge; the struck-through compare-at price is still shown. */
  hideSaleBadge?: boolean;
  className?: string;
}

/**
 * Renders a `PricingDto` the way the backend decided it: `EffectiveAmount` is what is charged and `OnSale` says
 * whether a sale window is open. Nothing here recomputes a price from the sale dates, and nothing sums amounts —
 * money maths is server-side only (plan §5.0). Formatting goes through `useFormatters().formatCurrency`, so the
 * amount follows the active language and the price's own currency, never the platform default.
 */
export function PriceTag({
  pricing,
  currency,
  owned = false,
  size = "md",
  showFree = true,
  hideSaleBadge = false,
  className,
}: PriceTagProps) {
  const { t } = useTranslation("billing");
  const { formatCurrency } = useFormatters();
  const classes = SIZE_CLASSES[size];

  if (owned) {
    return (
      <Badge
        variant="outline"
        className={cn("border-success/30 bg-success/10 text-success", classes.badge, className)}
        data-testid="price-tag-owned"
      >
        {t("price.owned")}
      </Badge>
    );
  }

  const isFree = !pricing || pricing.IsFree;
  if (isFree) {
    if (!showFree) return null;
    return (
      <span className={cn(classes.price, "text-success", className)} data-testid="price-tag-free">
        {t("price.free")}
      </span>
    );
  }

  const code = pricing.Currency || currency || DEFAULT_CURRENCY;
  const effective = pricing.EffectiveAmount;
  // The struck-through "was" price: the sale's own list price while on sale, otherwise an explicit compare-at price.
  const compareAt = pricing.OnSale
    ? (pricing.CompareAtAmount ?? pricing.Amount)
    : pricing.CompareAtAmount !== null && pricing.CompareAtAmount > pricing.Amount
      ? pricing.CompareAtAmount
      : null;
  const showCompareAt = compareAt !== null && compareAt > effective;

  return (
    <span className={cn("inline-flex items-baseline gap-2", className)} data-testid="price-tag">
      <span className={cn(classes.price, "text-foreground")} data-testid="price-tag-amount">
        {formatCurrency(effective, code)}
      </span>
      {showCompareAt && (
        <span className={cn(classes.compare, "text-muted-foreground line-through")} data-testid="price-tag-compare-at">
          {formatCurrency(compareAt, code)}
        </span>
      )}
      {pricing.OnSale && !hideSaleBadge && (
        <Badge
          variant="outline"
          className={cn("border-warning/30 bg-warning/10 text-warning", classes.badge)}
          data-testid="price-tag-sale"
        >
          {t("price.onSale")}
        </Badge>
      )}
    </span>
  );
}

export default PriceTag;
