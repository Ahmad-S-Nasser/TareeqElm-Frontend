/** Side-effect-free i18n constants (safe to import anywhere, including tests and tooling). */

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const RTL_LANGUAGES: readonly AppLanguage[] = ['ar'];

/** localStorage key holding the user's chosen language. */
export const LANGUAGE_STORAGE_KEY = 'tareeqelm_lang';

/**
 * Every namespace = one JSON file per language in src/locales/<lng>/<ns>.json.
 * Namespaces are lazy-loaded: a namespace is only fetched when a component calls useTranslation('<ns>').
 */
export const NAMESPACES = [
  'common',
  'roles',
  'errors',
  'auth',
  'nav',
  'dashboard',
  'courses',
  'learning',
  'quizzes',
  'instructor',
  'organization',
  'admin',
  'rbac',
  'profile',
  'errorBoundary',
  'notifications',
  'billing',
  'certificates',
] as const;
export type AppNamespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE: AppNamespace = 'common';

/**
 * Loaded at start-up (small, needed outside React or before any Suspense boundary):
 * `errors` is used by getApiError(), `errorBoundary` by PageLoader/AppErrorBoundary.
 */
export const PRELOADED_NAMESPACES: readonly AppNamespace[] = ['common', 'errors', 'errorBoundary'];

/** Maps any tag ("ar-EG", "en-GB", "AR") to a supported language. */
export const normalizeLanguage = (lng: string | undefined | null): AppLanguage =>
  typeof lng === 'string' && lng.toLowerCase().startsWith('ar') ? 'ar' : 'en';

export const isRtl = (lng: string | undefined | null): boolean =>
  RTL_LANGUAGES.includes(normalizeLanguage(lng));

/** Locale tag handed to Intl. Arabic uses Latin digits (0-9) via the `nu-latn` extension. */
export const INTL_LOCALES: Readonly<Record<AppLanguage, string>> = {
  en: 'en-US',
  ar: 'ar-u-nu-latn',
};

/**
 * Language detection: a `?lng=ar` URL parameter (e.g. a link from the marketing site) wins over the stored choice,
 * which wins over the browser language. The detected language is persisted by `applyLanguage` in ./index.ts.
 */
export const LANGUAGE_QUERY_PARAM = 'lng';
export const LANGUAGE_DETECTION = {
  order: ['querystring', 'localStorage', 'navigator'],
  lookupQuerystring: LANGUAGE_QUERY_PARAM,
  lookupLocalStorage: LANGUAGE_STORAGE_KEY,
  caches: [] as string[], // persistence is done in applyLanguage
};
