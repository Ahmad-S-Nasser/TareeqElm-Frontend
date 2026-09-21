import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  getIntlLocale,
} from "./format";
import i18n from "@/i18n";

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/;
const date = new Date("2025-03-09T14:05:00Z");

describe("format helpers", () => {
  it("maps languages to Intl locales", () => {
    expect(getIntlLocale("en")).toBe("en-US");
    expect(getIntlLocale("ar")).toBe("ar-u-nu-latn");
    expect(getIntlLocale("ar-EG")).toBe("ar-u-nu-latn");
  });

  it("formats numbers with Latin digits in Arabic", () => {
    expect(formatNumber(1234567.5, undefined, "en")).toBe("1,234,567.5");
    const ar = formatNumber(1234567.5, undefined, "ar");
    expect(ar).not.toMatch(ARABIC_INDIC_DIGITS);
    expect(ar).toMatch(/1.234.567/);
  });

  it("formats percentages from 0-100 values", () => {
    expect(formatPercent(42, undefined, "en")).toBe("42%");
    const ar = formatPercent(42, undefined, "ar");
    expect(ar).toContain("42");
    expect(ar).not.toMatch(ARABIC_INDIC_DIGITS);
  });

  it("formats dates and times in both languages with Latin digits", () => {
    const opts = { timeZone: "UTC" } as const;
    expect(formatDate(date, { ...opts, year: "numeric", month: "short", day: "numeric" }, "en")).toBe("Mar 9, 2025");
    const arDate = formatDate(date, { ...opts, year: "numeric", month: "short", day: "numeric" }, "ar");
    expect(arDate).toContain("2025");
    expect(arDate).toContain("مارس");
    expect(arDate).not.toMatch(ARABIC_INDIC_DIGITS);
    expect(formatTime(date, { ...opts, timeStyle: "short" }, "ar")).not.toMatch(ARABIC_INDIC_DIGITS);
    expect(formatDateTime(date, { ...opts, dateStyle: "short", timeStyle: "short" }, "ar")).not.toMatch(
      ARABIC_INDIC_DIGITS
    );
  });

  it("returns an empty string for invalid input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("nonsense")).toBe("");
    expect(formatNumber(Number.NaN)).toBe("");
  });

  it("formats relative time", () => {
    const now = new Date("2025-03-09T12:00:00Z");
    expect(formatRelativeTime("2025-03-09T09:00:00Z", "en", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2025-03-11T12:00:00Z", "en", now)).toBe("in 2 days");
    expect(formatRelativeTime("2025-03-08T12:00:00Z", "en", now)).toBe("yesterday");
    const ar = formatRelativeTime("2025-03-09T09:00:00Z", "ar", now);
    expect(ar).toContain("3");
    expect(ar).not.toMatch(ARABIC_INDIC_DIGITS);
  });

  it("formats currency", () => {
    expect(formatCurrency(1234.5, "USD", undefined, "en")).toBe("$1,234.50");
    const ar = formatCurrency(1234.5, "USD", undefined, "ar");
    expect(ar).toContain("1,234.50");
    expect(ar).not.toMatch(ARABIC_INDIC_DIGITS);
  });

  it("formats durations", () => {
    expect(formatDuration(3900, "en")).toBe("1 hr 5 min");
    expect(formatDuration(45, "en")).toBe("45 sec");
    expect(formatDuration(0, "en")).toBe("0 sec");
    expect(formatDuration(3900, "ar")).not.toMatch(ARABIC_INDIC_DIGITS);
  });

  it("uses the active i18n language by default", async () => {
    await i18n.changeLanguage("ar");
    expect(formatNumber(12345)).not.toMatch(ARABIC_INDIC_DIGITS);
    expect(formatDate(date, { month: "long", timeZone: "UTC" })).toBe("مارس");
  });
});
