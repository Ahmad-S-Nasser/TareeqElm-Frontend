/**
 * Money parsing, rounding and currency metadata.
 *
 * This file is deliberately NOT about display: prices are rendered with `useFormatters().formatCurrency`
 * (src/lib/format.ts), which already binds `Intl.NumberFormat` to the active language. What lives here is the
 * client-side mirror of the backend's `Nafea.Application/Services/Billing/MoneyMath.cs`:
 *
 *  - `moneyExponent(currency)`  -> how many decimals a currency uses (JOD/KWD/BHD/OMR/TND = 3, JPY/KRW = 0, else 2);
 *  - `roundMoney(amount, cur)`  -> rounds to that scale, half away from zero, exactly like `MoneyMath.Round`;
 *  - `parseMoney(input)`        -> reads what a human typed (Arabic digits, separators, currency symbols) back to a number.
 *
 * It exists so admin price-entry forms can validate and normalise a typed amount before sending it. The server is
 * still the only place money is summed, multiplied or split — the client never computes a total it acts on.
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

/** What the backend's `PlatformSettings.Currency` defaults to, and the fallback whenever settings are not loaded yet. */
export const DEFAULT_CURRENCY = 'USD';

/** ISO-4217 codes with three decimal places (mirror of `MoneyMath.Exponent`). */
const THREE_DECIMAL_CURRENCIES = new Set(['JOD', 'KWD', 'BHD', 'OMR', 'TND']);
/** ISO-4217 codes with no decimal places (mirror of `MoneyMath.Exponent`). */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW']);

/** How many decimals this currency uses. Unknown/missing currencies fall back to 2, like the backend. */
export const moneyExponent = (currency?: string | null): number => {
  const code = (currency ?? '').trim().toUpperCase();
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  return 2;
};

/** The smallest step of this currency: 0.01, 0.001 or 1. Handy for an `<input step>`. */
export const moneyStep = (currency?: string | null): number => 10 ** -moneyExponent(currency);

/**
 * Rounds to the currency's scale, half away from zero — what a cashier does, and what `MoneyMath.Round` does.
 * The intermediate `toPrecision(12)` strips binary floating-point noise, so 1.005 rounds to 1.01 (as the server's
 * `decimal` arithmetic would) instead of to 1.00 (as `Math.round(1.005 * 100)` would).
 */
export const roundMoney = (amount: number, currency?: string | null): number => {
  if (!Number.isFinite(amount)) return 0;
  const factor = 10 ** moneyExponent(currency);
  const sign = amount < 0 ? -1 : 1;
  const scaled = Number((Math.abs(amount) * factor).toPrecision(12));
  return (sign * Math.round(scaled)) / factor;
};

/** Eastern-Arabic (٠-٩) and Extended-Arabic (۰-۹) digits, plus the Arabic decimal/thousands separators. */
const normalizeDigits = (text: string): string =>
  text.replace(/[٠-٩۰-۹٫٬،−‒-―]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    if (ch === '٫') return '.'; // Arabic decimal separator
    if (ch === '٬' || ch === '،') return ','; // Arabic thousands separator / Arabic comma
    return '-'; // minus sign and the dash family
  });

/**
 * Locale-tolerant parse of a typed amount. Returns `null` for anything that is not a number — never `NaN`, never 0,
 * so "empty" and "zero" stay distinguishable in a form.
 *
 * Tolerated: Eastern-Arabic digits, Arabic separators, currency symbols, spaces, NBSP and RTL/LTR marks, a leading
 * `+`/`-`, and either separator convention. When both `.` and `,` appear, the last one is the decimal separator
 * ("1.234,56" and "1,234.56" both read as 1234.56). A lone `,` followed by exactly three digits is read as grouping
 * ("1,234" -> 1234); otherwise it is the decimal separator ("12,5" -> 12.5). A lone `.` is always the decimal
 * separator unless it repeats ("1.234.567" -> 1234567) — that keeps three-decimal prices like "0.500" (JOD) exact.
 *
 * The result is NOT rounded to a currency: call `roundMoney` when you need that.
 */
export const parseMoney = (input: string | number | null | undefined): number | null => {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input !== 'string') return null;

  // Strip everything that is not a digit, a separator or a sign (currency symbols, spaces, NBSP, RTL marks...).
  const cleaned = normalizeDigits(input).replace(/[^0-9.,+-]/g, '');
  if (!cleaned || !/[0-9]/.test(cleaned)) return null;

  const negative = cleaned.startsWith('-');
  let body = cleaned.replace(/[+-]/g, '');

  const dots = (body.match(/\./g) ?? []).length;
  const commas = (body.match(/,/g) ?? []).length;

  if (dots > 0 && commas > 0) {
    const decimal = body.lastIndexOf('.') > body.lastIndexOf(',') ? '.' : ',';
    const grouping = decimal === '.' ? ',' : '.';
    body = body.split(grouping).join('').replace(decimal, '.');
  } else if (commas > 0) {
    // A single comma followed by exactly three digits is a thousands separator; anything else is a decimal point.
    body = commas === 1 && /,\d{3}$/.test(body) ? body.replace(',', '') : body.replace(/,/g, '.');
  }
  // A repeated dot can only be grouping ("1.234.567"); a single one is always the decimal point.
  if ((body.match(/\./g) ?? []).length > 1) body = body.split('.').join('');

  const value = Number(body);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
};

/** Formats a number for a money `<input>`: plain Latin digits, no grouping, fixed to the currency's scale. */
export const toMoneyInputValue = (amount: number | null | undefined, currency?: string | null): string =>
  typeof amount === 'number' && Number.isFinite(amount)
    ? roundMoney(amount, currency).toFixed(moneyExponent(currency))
    : '';

/** The subset of `GET /api/Settings` this module cares about; `useSettings.ts` owns the full shape. */
interface CurrencySettings {
  Currency?: string | null;
}

/** react-query key for the currency read; shared so `billingKeys` and `settingsKeys` never disagree. */
export const platformCurrencyKey = ['platform-settings', 'currency'] as const;

/**
 * The platform's default currency, from `GET /api/Settings` (`PlatformSettings.Currency`, visible to every signed-in
 * caller). Prices that carry their own `Currency` always win — this is only the default for new prices, for a basket
 * that has no lines yet and for empty-state figures.
 */
export const usePlatformCurrency = (): { currency: string; isLoading: boolean } => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: platformCurrencyKey,
    queryFn: async () => (await api.get<CurrencySettings>('/Settings')).data,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    select: (settings) => settings?.Currency?.trim().toUpperCase() || DEFAULT_CURRENCY,
  });
  return { currency: data ?? DEFAULT_CURRENCY, isLoading };
};
