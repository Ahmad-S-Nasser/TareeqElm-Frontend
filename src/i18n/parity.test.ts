import { describe, expect, it } from "vitest";
import { NAMESPACES, SUPPORTED_LANGUAGES } from "./config";

/**
 * Locale parity guard (also run by `npm run i18n:check`):
 *  - every namespace has a JSON file in every language, and no unknown files exist;
 *  - en and ar define the same keys (plural variants are compared as one key);
 *  - values are never empty, and every plural key has all the forms its language needs.
 */
const files = import.meta.glob<{ default: Record<string, unknown> }>("../locales/*/*.json", { eager: true });

const bundles: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [file, mod] of Object.entries(files)) {
  const [, lng, ns] = /locales\/([^/]+)\/([^/]+)\.json$/.exec(file) ?? [];
  (bundles[lng] ??= {})[ns] = mod.default;
}

const PLURAL = /_(zero|one|two|few|many|other)$/;
const REQUIRED_FORMS: Record<string, string[]> = {
  en: ["one", "other"],
  ar: ["zero", "one", "two", "few", "many", "other"],
};

const flatten = (obj: Record<string, unknown>, prefix = ""): Record<string, unknown> =>
  Object.entries(obj).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(acc, flatten(value as Record<string, unknown>, path));
    } else {
      acc[path] = value;
    }
    return acc;
  }, {});

/** base key -> plural forms present (empty set when the key is not plural). */
const groups = (flat: Record<string, unknown>) => {
  const result = new Map<string, Set<string>>();
  for (const key of Object.keys(flat)) {
    const match = PLURAL.exec(key);
    const base = match ? key.replace(PLURAL, "") : key;
    if (!result.has(base)) result.set(base, new Set());
    if (match) result.get(base)!.add(match[1]);
  }
  return result;
};

describe("locale files", () => {
  it("has exactly the configured languages and namespaces", () => {
    expect(Object.keys(bundles).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    for (const lng of SUPPORTED_LANGUAGES) {
      expect(Object.keys(bundles[lng]).sort()).toEqual([...NAMESPACES].sort());
    }
  });

  for (const ns of NAMESPACES) {
    describe(ns, () => {
      const en = flatten(bundles.en?.[ns] ?? {});
      const ar = flatten(bundles.ar?.[ns] ?? {});
      const enGroups = groups(en);
      const arGroups = groups(ar);

      it("en and ar define the same keys", () => {
        expect([...arGroups.keys()].sort(), `keys differ between en and ar in "${ns}"`).toEqual(
          [...enGroups.keys()].sort()
        );
      });

      it("has no empty values", () => {
        for (const [lng, flat] of [["en", en], ["ar", ar]] as const) {
          for (const [key, value] of Object.entries(flat)) {
            expect(typeof value === "string" && value.trim() !== "", `${lng}/${ns}:${key} is empty`).toBe(true);
          }
        }
      });

      it("has every plural form each language needs", () => {
        for (const [lng, g] of [["en", enGroups], ["ar", arGroups]] as const) {
          for (const [base, forms] of g) {
            if (forms.size === 0) continue;
            for (const form of REQUIRED_FORMS[lng]) {
              expect(forms.has(form), `${lng}/${ns}:${base} is missing plural form _${form}`).toBe(true);
            }
          }
        }
      });

      it("uses the same interpolation variables in both languages", () => {
        const vars = (s: unknown) => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
        for (const [key, value] of Object.entries(ar)) {
          // Plural forms may legitimately omit {{count}} ("one" -> "a single ..."), so only check plain keys.
          if (PLURAL.test(key)) continue;
          expect(vars(value), `${ns}:${key} variables differ`).toEqual(vars(en[key]));
        }
      });
    });
  }
});
