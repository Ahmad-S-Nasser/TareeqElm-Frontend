import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES, normalizeLanguage, type AppLanguage } from '@/i18n/config';

/** Each language is always shown in its own script, whatever the active language is. */
const OWN_NAMES: Readonly<Record<AppLanguage, string>> = {
  en: 'EN',
  ar: 'العربية',
};
const FULL_OWN_NAMES: Readonly<Record<AppLanguage, string>> = {
  en: 'English',
  ar: 'العربية',
};

interface LanguageSwitcherProps {
  className?: string;
}

/** "EN | العربية" toggle. Works anywhere (header, auth page, sidebars). */
export const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
  const { t, i18n } = useTranslation('common');
  const active = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div
      role="group"
      aria-label={t('language.switcher')}
      dir="ltr"
      className={cn('inline-flex items-center rounded-lg border border-border/50 bg-muted/40 p-0.5 text-xs', className)}
    >
      {SUPPORTED_LANGUAGES.map((lng) => {
        const isActive = lng === active;
        return (
          <button
            key={lng}
            type="button"
            lang={lng}
            aria-pressed={isActive}
            aria-label={t('language.switchTo', { language: FULL_OWN_NAMES[lng] })}
            onClick={() => {
              if (!isActive) void i18n.changeLanguage(lng);
            }}
            className={cn(
              'rounded-md px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {OWN_NAMES[lng]}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
