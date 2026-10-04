import { describe, expect, it } from "vitest";
import { DEFAULT_CURRENCY, moneyExponent, moneyStep, parseMoney, roundMoney, toMoneyInputValue } from "./money";

describe("moneyExponent", () => {
  it("mirrors the backend MoneyMath.Exponent table", () => {
    for (const code of ["JOD", "KWD", "BHD", "OMR", "TND"]) expect(moneyExponent(code)).toBe(3);
    for (const code of ["JPY", "KRW"]) expect(moneyExponent(code)).toBe(0);
    for (const code of ["USD", "EUR", "AED", "SAR", "EGP"]) expect(moneyExponent(code)).toBe(2);
  });

  it("ignores case and padding, and falls back to 2", () => {
    expect(moneyExponent(" jod ")).toBe(3);
    expect(moneyExponent("jpy")).toBe(0);
    expect(moneyExponent(undefined)).toBe(2);
    expect(moneyExponent(null)).toBe(2);
    expect(moneyExponent("")).toBe(2);
    expect(moneyExponent("ZZZ")).toBe(2);
  });

  it("exposes the matching smallest step", () => {
    expect(moneyStep("USD")).toBe(0.01);
    expect(moneyStep("JOD")).toBe(0.001);
    expect(moneyStep("JPY")).toBe(1);
  });
});

describe("roundMoney", () => {
  it("rounds to the currency's scale", () => {
    expect(roundMoney(1.239, "USD")).toBe(1.24);
    expect(roundMoney(1.2349, "JOD")).toBe(1.235);
    expect(roundMoney(1234.4, "JPY")).toBe(1234);
    expect(roundMoney(1234.5, "JPY")).toBe(1235);
  });

  it("rounds half away from zero, like MoneyMath.Round (not banker's rounding)", () => {
    expect(roundMoney(1.005, "USD")).toBe(1.01);
    expect(roundMoney(2.675, "USD")).toBe(2.68);
    expect(roundMoney(0.125, "USD")).toBe(0.13);
    expect(roundMoney(-1.005, "USD")).toBe(-1.01);
    expect(roundMoney(-2.5, "JPY")).toBe(-3);
  });

  it("leaves already-exact amounts alone and guards against non-numbers", () => {
    expect(roundMoney(79, "USD")).toBe(79);
    expect(roundMoney(0, "USD")).toBe(0);
    expect(roundMoney(Number.NaN, "USD")).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY, "USD")).toBe(0);
  });
});

describe("parseMoney", () => {
  it("returns null for anything that is not a number, never NaN", () => {
    for (const input of ["", "   ", "abc", "$", null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseMoney(input as string)).toBeNull();
    }
  });

  it("passes finite numbers through untouched", () => {
    expect(parseMoney(79.99)).toBe(79.99);
    expect(parseMoney(0)).toBe(0);
    expect(parseMoney(-3)).toBe(-3);
  });

  it("reads plain decimals", () => {
    expect(parseMoney("79.99")).toBe(79.99);
    expect(parseMoney("  0.50 ")).toBe(0.5);
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("12.")).toBe(12);
    expect(parseMoney(".5")).toBe(0.5);
  });

  it("keeps three-decimal amounts exact (JOD/KWD prices)", () => {
    expect(parseMoney("0.500")).toBe(0.5);
    expect(parseMoney("12.345")).toBe(12.345);
  });

  it("strips currency symbols, spaces, NBSP and RTL marks", () => {
    expect(parseMoney("$1,234.56")).toBe(1234.56);
    expect(parseMoney("1 234.56")).toBe(1234.56);
    expect(parseMoney("1 234,56")).toBe(1234.56);
    expect(parseMoney("‏1,234.50 US$")).toBe(1234.5);
    expect(parseMoney("JOD 1.500")).toBe(1.5);
  });

  it("handles both separator conventions", () => {
    expect(parseMoney("1,234.56")).toBe(1234.56);
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("1,234")).toBe(1234);
    expect(parseMoney("1.234.567")).toBe(1234567);
    expect(parseMoney("12,5")).toBe(12.5);
  });

  it("reads Eastern-Arabic digits and Arabic separators", () => {
    expect(parseMoney("٧٩٫٩٩")).toBe(79.99);
    expect(parseMoney("١٬٢٣٤٫٥٠")).toBe(1234.5);
    expect(parseMoney("۱۲۳")).toBe(123);
  });

  it("reads signs", () => {
    expect(parseMoney("-5.25")).toBe(-5.25);
    expect(parseMoney("−5")).toBe(-5);
    expect(parseMoney("+5")).toBe(5);
  });

  it("does not round: that is roundMoney's job", () => {
    expect(parseMoney("1.239")).toBe(1.239);
    expect(roundMoney(parseMoney("1.239") ?? 0, "USD")).toBe(1.24);
  });
});

describe("toMoneyInputValue", () => {
  it("formats to the currency's scale with plain digits and no grouping", () => {
    expect(toMoneyInputValue(1234.5, "USD")).toBe("1234.50");
    expect(toMoneyInputValue(1.5, "JOD")).toBe("1.500");
    expect(toMoneyInputValue(1234.6, "JPY")).toBe("1235");
    expect(toMoneyInputValue(0, "USD")).toBe("0.00");
  });

  it("renders an empty string for an empty amount", () => {
    expect(toMoneyInputValue(null, "USD")).toBe("");
    expect(toMoneyInputValue(undefined, "USD")).toBe("");
    expect(toMoneyInputValue(Number.NaN, "USD")).toBe("");
  });

  it("round-trips through parseMoney", () => {
    for (const [amount, code] of [
      [79.99, "USD"],
      [1.235, "JOD"],
      [1234, "JPY"],
    ] as const) {
      expect(parseMoney(toMoneyInputValue(amount, code))).toBe(amount);
    }
  });
});

describe("DEFAULT_CURRENCY", () => {
  it("matches the backend PlatformSettings default", () => {
    expect(DEFAULT_CURRENCY).toBe("USD");
  });
});
