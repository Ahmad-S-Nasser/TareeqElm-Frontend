import { describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { LANGUAGE_STORAGE_KEY } from "./config";

describe("i18n runtime", () => {
  it("switching to Arabic sets <html lang/dir> and persists the choice", async () => {
    await i18n.changeLanguage("ar");
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ar");
    expect(i18n.t("common:actions.save")).toBe("حفظ");

    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("falls back to English when a key is missing in Arabic", async () => {
    i18n.addResource("en", "common", "onlyInEnglish", "Only in English");
    await i18n.changeLanguage("ar");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(i18n.t("common:onlyInEnglish")).toBe("Only in English");
    warn.mockRestore();
  });

  it("warns about missing keys in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(i18n.t("common:does.not.exist")).toBe("does.not.exist");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("common:does.not.exist"));
    warn.mockRestore();
  });

  it("selects the right Arabic plural form", async () => {
    await i18n.changeLanguage("ar");
    expect(i18n.t("roles:applicant.count", { count: 0 })).toBe("لا يوجد متدرّبون");
    expect(i18n.t("roles:applicant.count", { count: 1 })).toBe("متدرّب واحد");
    expect(i18n.t("roles:applicant.count", { count: 2 })).toBe("متدرّبان");
    expect(i18n.t("roles:applicant.count", { count: 5 })).toBe("5 متدرّبين");
    expect(i18n.t("roles:applicant.count", { count: 15 })).toBe("15 متدرّبًا");
    expect(i18n.t("roles:applicant.count", { count: 100 })).toBe("100 متدرّب");
  });
});
