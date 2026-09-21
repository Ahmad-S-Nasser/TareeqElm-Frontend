import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { INTL_LOCALES, normalizeLanguage } from '@/i18n/config';

/**
 * Locale-aware formatting. Every function takes an optional trailing `lang` ('en' | 'ar');
 * when omitted the ACTIVE i18n language is used. Arabic always prints Western digits (0-9).
 * In components prefer `useFormatters()`, which re-renders when the language changes.
 */

/** Named month ("Mar 9, 2025" / "9 مارس 2025") so Arabic never falls back to a numeric-only date. */
const DEFAULT_DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

export type DateInput = Date | string | number | null | undefined;

/** Intl locale tag for a language: en -> en-US, ar -> ar-u-nu-latn. */
export const getIntlLocale = (lang?: string): string =>
  INTL_LOCALES[normalizeLanguage(lang ?? i18n.resolvedLanguage ?? i18n.language)];

const toDate = (value: DateInput): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions, lang?: string): string =>
  Number.isFinite(value) ? new Intl.NumberFormat(getIntlLocale(lang), options).format(value) : '';

/** `percent` is a 0-100 value (42 -> "42%"), matching what the API returns. */
export const formatPercent = (percent: number, options?: Intl.NumberFormatOptions, lang?: string): string =>
  Number.isFinite(percent)
    ? new Intl.NumberFormat(getIntlLocale(lang), {
        style: 'percent',
        maximumFractionDigits: 0,
        ...options,
      }).format(percent / 100)
    : '';

export const formatDate = (value: DateInput, options?: Intl.DateTimeFormatOptions, lang?: string): string => {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(getIntlLocale(lang), options ?? DEFAULT_DATE).format(date) : '';
};

export const formatTime = (value: DateInput, options?: Intl.DateTimeFormatOptions, lang?: string): string => {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(getIntlLocale(lang), options ?? { timeStyle: 'short' }).format(date) : '';
};

export const formatDateTime = (value: DateInput, options?: Intl.DateTimeFormatOptions, lang?: string): string => {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(getIntlLocale(lang), options ?? { ...DEFAULT_DATE, hour: 'numeric', minute: '2-digit' }).format(date)
    : '';
};

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 hours ago" / "in 2 days" / "yesterday". `now` is injectable for tests. */
export const formatRelativeTime = (value: DateInput, lang?: string, now: Date | number = Date.now()): string => {
  const date = toDate(value);
  if (!date) return '';
  const diffSeconds = Math.round((date.getTime() - new Date(now).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(getIntlLocale(lang), { numeric: 'auto' });
  const abs = Math.abs(diffSeconds);
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (abs >= seconds) return rtf.format(Math.trunc(diffSeconds / seconds), unit);
  }
  return rtf.format(diffSeconds, 'second');
};

export const formatCurrency = (
  amount: number,
  currency = 'USD',
  options?: Intl.NumberFormatOptions,
  lang?: string
): string =>
  Number.isFinite(amount)
    ? new Intl.NumberFormat(getIntlLocale(lang), { style: 'currency', currency, ...options }).format(amount)
    : '';

/** Seconds -> "1 hr 5 min" / "45 sec" (localized units, zero parts omitted). */
export const formatDuration = (seconds: number, lang?: string): string => {
  if (!Number.isFinite(seconds)) return '';
  const total = Math.max(0, Math.round(seconds));
  const locale = getIntlLocale(lang);
  const unit = (value: number, name: 'hour' | 'minute' | 'second') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'short' }).format(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(unit(hours, 'hour'));
  if (minutes) parts.push(unit(minutes, 'minute'));
  if (!parts.length) parts.push(unit(secs, 'second'));
  else if (!hours && secs && total < 600) parts.push(unit(secs, 'second'));
  return parts.join(' ');
};

/** Formatters bound to the active language; the component re-renders when the language changes. */
export const useFormatters = () => {
  const { i18n: instance } = useTranslation();
  const lang = normalizeLanguage(instance.resolvedLanguage ?? instance.language);
  return useMemo(
    () => ({
      lang,
      locale: getIntlLocale(lang),
      formatNumber: (v: number, o?: Intl.NumberFormatOptions) => formatNumber(v, o, lang),
      formatPercent: (v: number, o?: Intl.NumberFormatOptions) => formatPercent(v, o, lang),
      formatDate: (v: DateInput, o?: Intl.DateTimeFormatOptions) => formatDate(v, o, lang),
      formatTime: (v: DateInput, o?: Intl.DateTimeFormatOptions) => formatTime(v, o, lang),
      formatDateTime: (v: DateInput, o?: Intl.DateTimeFormatOptions) => formatDateTime(v, o, lang),
      formatRelativeTime: (v: DateInput, now?: Date | number) => formatRelativeTime(v, lang, now),
      formatCurrency: (a: number, c?: string, o?: Intl.NumberFormatOptions) => formatCurrency(a, c, o, lang),
      formatDuration: (s: number) => formatDuration(s, lang),
    }),
    [lang]
  );
};
