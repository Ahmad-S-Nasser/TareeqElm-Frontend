/**
 * Test setup (vitest + jsdom + Testing Library).
 *
 * Run:  npm run test:run   (once)   |   npm test   (watch)
 * Env:  VITE_API_URL=https://api.test/api is injected by the `test` block in vite.config.ts.
 *
 * How the tests mock things:
 *  - HTTP: `new MockAdapter(api)` (axios-mock-adapter) on the shared instance from src/lib/api.ts. No real network.
 *  - Toasts: `vi.mock('@/hooks/use-toast')` (shadcn toast) or `vi.mock('sonner')`.
 *  - Pages: heavy layout (sidebar/header) is `vi.mock`ed where it is not under test.
 *  - Signed-in state: `seedSession()` from ./renderWithProviders writes the localStorage keys the app reads.
 *
 * This file also stubs browser APIs jsdom lacks (ResizeObserver for recharts/radix, matchMedia,
 * IntersectionObserver, scrollTo, pointer capture, speechSynthesis) and clears localStorage between tests.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import i18n, { i18nReady } from "@/i18n";

// i18n: load every locale file eagerly so translations are available synchronously in tests
// (the app itself lazy-loads them). English is the default language; each test starts in English.
await i18nReady;
const localeFiles = import.meta.glob<{ default: Record<string, unknown> }>("../locales/*/*.json", { eager: true });
for (const [file, mod] of Object.entries(localeFiles)) {
  const [, lng, ns] = /locales\/([^/]+)\/([^/]+)\.json$/.exec(file) ?? [];
  if (lng && ns) i18n.addResourceBundle(lng, ns, mod.default, true, true);
}
await i18n.changeLanguage("en");

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);
vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollIntoView = vi.fn();
// Radix Select/Popover call these on pointer interaction.
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

// Text-to-speech (LessonPlayer).
vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] });

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
  localStorage.clear();
});
