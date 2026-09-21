import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_NAMESPACE,
  LANGUAGE_DETECTION,
  LANGUAGE_STORAGE_KEY,
  NAMESPACES,
  PRELOADED_NAMESPACES,
  SUPPORTED_LANGUAGES,
  isRtl,
  normalizeLanguage,
} from './config';

/** Keeps <html lang dir> in sync with the active language and remembers the choice. */
export const applyLanguage = (lng: string) => {
  const language = normalizeLanguage(lng);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr';
  }
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* storage unavailable (private mode): the choice just is not remembered */
  }
};

// Registered before init() so the very first (detected) language is applied too.
i18n.on('languageChanged', applyLanguage);

/** Resolves when the initial language and preloaded namespaces are ready. */
export const i18nReady = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(resourcesToBackend((language: string, namespace: string) => import(`../locales/${language}/${namespace}.json`)))
  .init({
    supportedLngs: [...SUPPORTED_LANGUAGES],
    fallbackLng: DEFAULT_LANGUAGE,
    load: 'languageOnly',
    ns: [...PRELOADED_NAMESPACES],
    defaultNS: DEFAULT_NAMESPACE,
    fallbackNS: DEFAULT_NAMESPACE,
    detection: LANGUAGE_DETECTION,
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: true },
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (lngs, ns, key) => {
      if (import.meta.env.DEV) console.warn(`[i18n] missing key "${ns}:${key}" for ${lngs.join(', ')}`);
    },
  });

export { NAMESPACES };
export default i18n;
