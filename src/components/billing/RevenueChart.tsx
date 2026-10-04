/**
 * The revenue-over-time chart (phase 5, wave F2a).
 *
 * Three stacked-by-meaning series — gross, net and refunds — over the contiguous buckets `GET /api/admin/revenue/series`
 * returns. It is a plain presentational component: it fetches nothing, computes nothing and holds no filter state, so a
 * later wave can drop a `compact` copy of it into a payouts or orders card without dragging the dashboard along.
 *
 * The recharts vocabulary here (imports, `ResponsiveContainer`, the grid/axis/tooltip styling, `reversed`/`orientation`
 * for RTL) is deliberately the same one `OrganizationAnalytics.tsx` established, so the money charts and the academic
 * charts read as one product rather than two.
 */
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFormatters } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RevenuePoint } from "@/hooks/useRevenue";

/** Same palette family as `OrganizationAnalytics`: the brand primary first, then its COLORS run. */
const SERIES = [
  { key: "Gross", color: "hsl(var(--primary))", label: "revenue.series.gross" },
  { key: "Net", color: "#00C49F", label: "revenue.series.net" },
  { key: "Refunds", color: "#FF8042", label: "revenue.series.refunds" },
] as const;

export interface RevenueChartProps {
  /** The buckets, oldest first, exactly as the server ordered them. */
  data: RevenuePoint[];
  /** ISO-4217 code every amount in `data` is quoted in — one currency at a time, never mixed. */
  currency: string;
  /** Chart height in pixels; the width always fills the container. */
  height?: number;
  /** A mini chart for someone else's card: no axes, no grid, no legend — just the shape of the trend. */
  compact?: boolean;
  /** What to say when there is nothing to draw. Defaults to `billing:revenue.empty`. */
  emptyText?: string;
  className?: string;
}

/**
 * An area chart of gross / net / refunds per bucket. Renders an empty-state paragraph rather than an axis-only frame
 * when the window holds no buckets at all — a brand-new platform is the normal case, not an error.
 */
export const RevenueChart = ({
  data,
  currency,
  height = 320,
  compact = false,
  emptyText,
  className,
}: RevenueChartProps) => {
  const { t, i18n } = useTranslation("billing");
  const { formatCurrency } = useFormatters();
  const isRtl = i18n.dir() === "rtl";
  // Gradient ids are document-global, so two charts on one page must not share them.
  const gradientId = useId();

  if (data.length === 0) {
    return (
      <div
        data-testid="revenue-chart-empty"
        className={cn("flex flex-col items-center justify-center gap-1 text-center", className)}
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">{emptyText ?? t("revenue.empty")}</p>
        {!compact && <p className="text-xs text-muted-foreground">{t("revenue.emptyHint")}</p>}
      </div>
    );
  }

  return (
    <div
      data-testid="revenue-chart"
      role="img"
      aria-label={t("revenue.overTime")}
      className={cn("w-full", className)}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              {SERIES.map((series) => (
                <linearGradient key={series.key} id={`${gradientId}-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={series.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={series.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>

            {!compact && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />}
            {!compact && (
              <XAxis
                dataKey="Bucket"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                minTickGap={16}
                reversed={isRtl}
              />
            )}
            {!compact && (
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                orientation={isRtl ? "right" : "left"}
                width={72}
                tickFormatter={(value: number) =>
                  formatCurrency(value, currency, { notation: "compact", maximumFractionDigits: 1 })
                }
              />
            )}
            <Tooltip
              cursor={{ stroke: "#e5e7eb" }}
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                direction: isRtl ? "rtl" : "ltr",
              }}
              formatter={(value: number, name: string) => [formatCurrency(value, currency), name]}
            />

            {SERIES.map((series) => (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={t(series.label)}
                stroke={series.color}
                strokeWidth={2}
                fill={`url(#${gradientId}-${series.key})`}
                // A refund of zero should still sit on the axis rather than disappear into it.
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Hand-rolled legend, the way OrganizationAnalytics labels its pie — it survives RTL and stays readable. */}
      {!compact && (
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {SERIES.map((series) => (
            <div key={series.key} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: series.color }} />
              {t(series.label)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RevenueChart;
