import { afterEach, describe, expect, it } from "vitest";
import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { LANGUAGE_DETECTION, LANGUAGE_STORAGE_KEY } from "./config";

const detect = async () => {
  const instance = i18next.createInstance();
  await instance.use(LanguageDetector).init({
    supportedLngs: ["en", "ar"],
    fallbackLng: "en",
    load: "languageOnly",
    resources: {},
    detection: LANGUAGE_DETECTION,
  });
  return instance.language;
};

describe("language detection", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  it("honours ?lng=ar ahead of the stored language", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    window.history.replaceState({}, "", "/?lng=ar");
    expect(await detect()).toBe("ar");
  });

  it("falls back to the stored language without the parameter", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "ar");
    expect(await detect()).toBe("ar");
  });

  it("does not persist by itself (applyLanguage does that)", () => {
    expect(LANGUAGE_DETECTION.caches).toEqual([]);
    expect(LANGUAGE_DETECTION.order[0]).toBe("querystring");
  });
});
