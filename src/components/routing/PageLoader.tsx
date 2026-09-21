import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Full-page loading indicator used for auth restoration and lazy route chunks. */
export const PageLoader = () => {
  // useSuspense: false because this component IS the Suspense fallback and must never suspend itself.
  const { t } = useTranslation("errorBoundary", { useSuspense: false });
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-muted-foreground">{t("pageLoader.loading", { defaultValue: "Loading..." })}</p>
      </div>
    </div>
  );
};

export default PageLoader;
