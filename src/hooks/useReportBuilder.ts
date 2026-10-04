import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * The state behind every report page (see `components/reports/ReportBuilder.tsx`).
 *
 * Unlike the reactive filter bars elsewhere (AdminOrders, OrganizationEnrollment), a report does nothing until the user
 * clicks "Generate report". The page edits `filters` freely; `generate()` snapshots them into `appliedFilters` and flips
 * `hasGenerated` on. The page's query hook must key on `appliedFilters` (never on the live `filters`) and gate its
 * `enabled` on `hasGenerated`, so:
 *   - nothing is fetched before the first Generate;
 *   - editing a filter afterwards leaves the shown results alone (they keep matching the filters they were run with);
 *   - clicking Generate again re-runs with the new filters. Generating again with UNCHANGED filters bumps `runId`, which
 *     the page should include in its query key (or pass to `refetch`) so the click visibly re-fires the request.
 */
export interface ReportBuilderState<TFilters> {
  /** The live, editable filter values bound to the filter form. */
  filters: TFilters;
  setFilters: Dispatch<SetStateAction<TFilters>>;
  /** Convenience: set one filter field. */
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  /** The filters as of the last Generate click; `null` until the first one. Key the results query on this. */
  appliedFilters: TFilters | null;
  /** True once Generate has been clicked at least once. Gate the results query's `enabled` on this. */
  hasGenerated: boolean;
  /** Increments on every Generate click (0 before the first). */
  runId: number;
  /** Snapshot the current filters and run (or re-run) the report. */
  generate: () => void;
  /** Back to the pre-generate state (initial filters, nothing applied). */
  reset: () => void;
}

export const useReportBuilder = <TFilters>(initialFilters: TFilters): ReportBuilderState<TFilters> => {
  // The first render's initial filters are what reset() returns to (callers usually pass a fresh literal every render).
  const initialRef = useRef(initialFilters);
  const [filters, setFilters] = useState<TFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<TFilters | null>(null);
  const [runId, setRunId] = useState(0);

  const setFilter = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const generate = useCallback(() => {
    setAppliedFilters(filters);
    setRunId((n) => n + 1);
  }, [filters]);

  const reset = useCallback(() => {
    setFilters(initialRef.current);
    setAppliedFilters(null);
    setRunId(0);
  }, []);

  return { filters, setFilters, setFilter, appliedFilters, hasGenerated: runId > 0, runId, generate, reset };
};

export default useReportBuilder;
