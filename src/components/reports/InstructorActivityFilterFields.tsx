import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";
import type { InstructorActivityFilters } from "@/hooks/useInstructorActivityReport";

/**
 * The instructor activity report's filters: a date range and an instructor. Purely controlled — it edits the report
 * builder's live filters and never fetches a report itself. A separate component from `PerformanceReportFilterFields`
 * because this report filters by instructor rather than by course/department.
 *
 * The instructor list reuses the exact query (and cache key) the Organization Instructors page already uses, so moving
 * between those screens never re-downloads it.
 */
const ALL = "all";

interface InstructorOption { Id: string; FullName: string }

export interface InstructorActivityFilterFieldsProps {
    filters: InstructorActivityFilters;
    onChange: <K extends keyof InstructorActivityFilters>(key: K, value: InstructorActivityFilters[K]) => void;
    /** Shown under the dates when the range is backwards. */
    rangeInvalid?: boolean;
}

export const InstructorActivityFilterFields = ({ filters, onChange, rangeInvalid = false }: InstructorActivityFilterFieldsProps) => {
    const { t } = useTranslation("organization");

    const { data: instructors = [] } = useQuery({
        queryKey: ["organization-instructors"],
        queryFn: async () => (await api.get<InstructorOption[]>("/Organization/instructors")).data,
    });

    return (
        <div className="space-y-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                    <Label htmlFor="instructor-report-from">{t("reports.performanceFilters.from")}</Label>
                    <Input
                        id="instructor-report-from"
                        type="date"
                        value={filters.from ?? ""}
                        max={filters.to || undefined}
                        onChange={(e) => onChange("from", e.target.value || undefined)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="instructor-report-to">{t("reports.performanceFilters.to")}</Label>
                    <Input
                        id="instructor-report-to"
                        type="date"
                        value={filters.to ?? ""}
                        min={filters.from || undefined}
                        onChange={(e) => onChange("to", e.target.value || undefined)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>{t("reports.instructorActivity.instructor")}</Label>
                    <Select value={filters.instructorId ?? ALL} onValueChange={(v) => onChange("instructorId", v === ALL ? undefined : v)}>
                        <SelectTrigger aria-label={t("reports.instructorActivity.instructor")}>
                            <SelectValue placeholder={t("reports.instructorActivity.allInstructors")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t("reports.instructorActivity.allInstructors")}</SelectItem>
                            {instructors.map((i) => <SelectItem key={i.Id} value={i.Id}>{i.FullName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {rangeInvalid && (
                <p role="alert" className="text-sm text-destructive">{t("reports.performanceFilters.invalidRange")}</p>
            )}
            <p className="text-xs text-muted-foreground">{t("reports.instructorActivity.windowNote")}</p>
        </div>
    );
};

export default InstructorActivityFilterFields;
