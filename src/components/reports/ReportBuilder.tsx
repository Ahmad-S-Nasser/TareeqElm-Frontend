import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileSearch, Loader2, Play, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiError } from "@/lib/api";

/**
 * The shell every report page renders (Financial/Orders, Department Analytics, and the Phase 4-5 reports).
 *
 * The one structural difference from the reactive filter bars elsewhere in the app: the filter form does NOTHING on its
 * own. Results appear only after "Generate report" is clicked, and editing a filter afterwards leaves the shown results
 * untouched until Generate is clicked again. Pair it with `useReportBuilder` (hooks/useReportBuilder.ts), which owns the
 * `hasGenerated` flag and the applied-filters snapshot the page's query must key on.
 *
 * Results-area states, in order: not generated yet -> prompt; `isLoading` -> spinner; `isError` -> error message;
 * `isEmpty` -> empty message; otherwise `results`.
 */
export interface ReportBuilderProps {
    /** Page heading. Omit to render no header (e.g. when embedding the builder in another page). */
    title?: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    /** Where the "back to reports" link goes; omit for no link. */
    backTo?: string;
    /** The filter controls; the caller renders them bound to `useReportBuilder().filters`. */
    filters: ReactNode;
    /** Called when "Generate report" is clicked (or the filter form is submitted). Usually `useReportBuilder().generate`. */
    onGenerate: () => void;
    /** From `useReportBuilder().hasGenerated`: false shows the "run this report" prompt instead of any results. */
    hasGenerated: boolean;
    /** The rendered results; only mounted once generated and not loading/errored/empty. */
    results: ReactNode;
    isLoading?: boolean;
    /** True while a re-generate is fetching over existing results (shows a spinner on the button, keeps results). */
    isFetching?: boolean;
    isError?: boolean;
    error?: unknown;
    /** Fallback text for `error` when the API gave no message. */
    errorMessage?: string;
    /** True when the generated report has no rows; shows `emptyMessage` instead of `results`. */
    isEmpty?: boolean;
    emptyMessage?: ReactNode;
    /** Extra controls shown beside the results heading once results are showing (e.g. an Export button). */
    actions?: ReactNode;
    /** Disable the Generate button (e.g. an invalid date range). */
    canGenerate?: boolean;
}

export const ReportBuilder = ({
    title,
    description,
    icon: Icon,
    backTo,
    filters,
    onGenerate,
    hasGenerated,
    results,
    isLoading = false,
    isFetching = false,
    isError = false,
    error,
    errorMessage,
    isEmpty = false,
    emptyMessage,
    actions,
    canGenerate = true,
}: ReportBuilderProps) => {
    const { t } = useTranslation("organization");
    const busy = isLoading || isFetching;

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (canGenerate && !busy) onGenerate();
    };

    const showResults = hasGenerated && !isLoading && !isError && !isEmpty;

    return (
        <div className="space-y-6" data-testid="report-builder">
            {(title || backTo) && (
                <div className="space-y-2">
                    {backTo && (
                        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                            {t("reports.builder.back")}
                        </Link>
                    )}
                    {title && (
                        <div>
                            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                                {Icon && (
                                    <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                                    </span>
                                )}
                                {title}
                            </h1>
                            {description && <p className="text-muted-foreground mt-1">{description}</p>}
                        </div>
                    )}
                </div>
            )}

            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-primary" aria-hidden="true" />
                        {t("reports.builder.filters")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4" aria-label={t("reports.builder.filters")}>
                        {filters}
                        <div className="flex justify-end">
                            <Button type="submit" disabled={!canGenerate || busy} className="gap-2">
                                {busy ? (
                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Play className="w-4 h-4" aria-hidden="true" />
                                )}
                                {hasGenerated ? t("reports.builder.regenerate") : t("reports.builder.generate")}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <section aria-label={t("reports.builder.results")} aria-busy={busy} className="space-y-4">
                {!hasGenerated ? (
                    <Card className="border-dashed border-border/70">
                        <CardContent className="p-12 text-center" data-testid="report-prompt">
                            <FileSearch className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" aria-hidden="true" />
                            <p className="font-semibold">{t("reports.builder.promptTitle")}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t("reports.builder.promptDescription")}</p>
                        </CardContent>
                    </Card>
                ) : isLoading ? (
                    <div className="flex justify-center py-12" data-testid="report-loading">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
                        <span className="sr-only">{t("reports.builder.loading")}</span>
                    </div>
                ) : isError ? (
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center text-destructive" data-testid="report-error">
                            {getApiError(error, errorMessage ?? t("reports.builder.loadFailed"))}
                        </CardContent>
                    </Card>
                ) : isEmpty ? (
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center text-muted-foreground" data-testid="report-empty">
                            {emptyMessage ?? t("reports.builder.empty")}
                        </CardContent>
                    </Card>
                ) : null}

                {showResults && (
                    <>
                        {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
                        <div data-testid="report-results">{results}</div>
                    </>
                )}
            </section>
        </div>
    );
};

export default ReportBuilder;
