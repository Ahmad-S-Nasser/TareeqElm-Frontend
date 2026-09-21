# Internationalisation (i18n)

Languages: `en` (default) and `ar` (RTL). Stack: `i18next` + `react-i18next` + lazy JSON namespaces.
Arabic UI uses **Western digits (0-9)**, Cairo font, and `dir="rtl"` on `<html>`.

## Files

| Path | Purpose |
| --- | --- |
| `src/i18n/index.ts` | Initialises i18next (detection, lazy backend, `<html lang dir>` sync, persistence). Imported first in `main.tsx`. |
| `src/i18n/config.ts` | Constants: supported languages, namespace list, storage key `tareeqelm_lang`, `Intl` locale tags. |
| `src/locales/{en,ar}/<ns>.json` | Translations, one file per namespace per language. |
| `src/lib/format.ts` | Number / date / time / relative-time / currency / duration formatters (+ `useFormatters()`). |
| `src/components/i18n/LanguageSwitcher.tsx` | "EN \| العربية" toggle (Header, Auth page; drop it into sidebars too). |
| `src/i18n/parity.test.ts` | Guard: same keys in `en` and `ar`, no empty values, complete plural forms. Run alone with `npm run i18n:check`. |

## Namespaces

`common` (buttons, states, language names, "deleted X" placeholders), `roles`, `errors` (getApiError messages),
`auth`, `nav` (header + sidebars), `dashboard`, `courses`, `learning`, `quizzes`, `instructor`, `organization`,
`admin`, `profile`, `errorBoundary` (PageLoader / AppErrorBoundary / NotFound).
`common`, `errors` and `errorBoundary` load at start-up; the others load the first time a component uses them
(each triggers `Suspense`, whose fallback is `PageLoader`).

## Adding strings

1. Add the key to **both** `src/locales/en/<ns>.json` and `src/locales/ar/<ns>.json` (same nesting).
   Group by screen/feature (`"table": { "empty": "..." }`). Do not build sentences by concatenation.
2. Use it:

```tsx
import { useTranslation } from "react-i18next";

const MyPage = () => {
  const { t } = useTranslation("courses");            // default namespace for this component
  const { t: tc } = useTranslation(["courses", "common"]); // several namespaces -> t("common:actions.save")
  return <Button>{t("common:actions.save")}</Button>;
};
```

Outside React (services, hooks that run `toast`) use `import i18n from "@/i18n"` and `i18n.t("ns:key")`.
Do not call `t` at module top level (the language may change); call it at render/validation time.

### Interpolation

Pass resolved values as variables; never concatenate:

```json
{ "welcomeBack": "Welcome back, {{name}}!" }   // ar: "مرحبًا بعودتك، {{name}}!"
```
```tsx
t("welcomeBack", { name: user.FullName })
```

When the API returns `null` for a resolved name (deleted user/course/department) use the `common` placeholders:
`t("common:deletedUser")`, `deletedCourse`, `deletedDepartment`, `deletedEntity`, e.g.
`{row.userName ?? t("common:deletedUser")}`.

### Plurals

Provide `_one` / `_other` for English and `_zero/_one/_two/_few/_many/_other` for Arabic, and pass `count`:

```json
// en
"lessons_one": "{{count}} lesson",  "lessons_other": "{{count}} lessons"
// ar
"lessons_zero": "لا دروس", "lessons_one": "درس واحد", "lessons_two": "درسان",
"lessons_few": "{{count}} دروس", "lessons_many": "{{count}} درسًا", "lessons_other": "{{count}} درس"
```
```tsx
t("lessons", { count: n })
```
English must also be complete for `_one` and `_other`; the parity test enforces all forms for Arabic.
Arabic forms: 0 = zero, 1 = one, 2 = two, 3-10 = few, 11-99 = many, 100+ = other.

### Validation messages (zod)

Build the schema inside the handler so messages use the language active at validation time
(see `src/pages/Auth.tsx`): `z.string().email(t("auth:validation.emailInvalid"))`.

### API errors

`getApiError(error, fallback?)` returns translated messages for network / 403 / 404 / 409 / 429 / 5xx and the
generic fallback. Server-provided messages are passed through as-is. When passing your own `fallback`,
translate it: `getApiError(err, t("courses:loadFailed"))`. Every request also sends `Accept-Language: en|ar`.

## Formatting numbers and dates

Never use `toLocaleString()`, `toLocaleDateString()` or hard-coded `en-US`. Use the helpers so Arabic keeps Latin digits:

```tsx
const { formatNumber, formatPercent, formatDate, formatDateTime, formatTime,
        formatRelativeTime, formatCurrency, formatDuration } = useFormatters();

formatNumber(1234.5)                 // "1,234.5"
formatPercent(42)                    // "42%"  (input is 0-100)
formatDate(iso)                      // "Mar 9, 2025" / "9 مارس 2025"
formatDate(iso, { month: "long" })   // custom Intl options
formatRelativeTime(iso)              // "3 hours ago" / "قبل 3 ساعات"
formatCurrency(19.99, "USD")
formatDuration(3900)                 // "1 hr 5 min"
```

`useFormatters()` re-renders on language change. The plain functions in `@/lib/format` take an optional trailing
`lang` and default to the active language (fine in non-React code).

## RTL rules

- Use **logical** Tailwind classes: `ms-*` / `me-*` (not `ml`/`mr`), `ps-*` / `pe-*`, `start-*` / `end-*`
  (not `left`/`right`), `text-start` / `text-end`, `border-s` / `border-e`, `rounded-s-*` / `rounded-e-*`.
- For anything without a logical form use the `rtl:` variant (`rtl:space-x-reverse`, `rtl:-scale-x-100`).
- Mirror **directional** icons (chevrons, arrows, "back") with `rtl:rotate-180`. Do not mirror logos, media controls
  or icons without direction.
- Numbers, emails, URLs and code stay LTR: wrap in `<bdi>` or `dir="ltr"` if they get scrambled inside Arabic text.
- `src/index.css` already resets `uppercase`, `tracking-*` and `italic` for `html[lang="ar"]` (they break Arabic).
- Toggle with `LanguageSwitcher`; `document.documentElement.lang` / `dir` update automatically.

## Tooling

`npm run i18n:check` runs the parity test (also part of `npm run test:run`). In development, a missing key logs
`[i18n] missing key "ns:key"` to the console. Tests load all locales eagerly and reset the language to `en`
after every test (see `src/test/setup.ts`); use `await i18n.changeLanguage("ar")` to test Arabic.
