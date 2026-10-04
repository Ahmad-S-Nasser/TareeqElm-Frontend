import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/api";
import type { PerformanceReportFilters } from "@/hooks/usePerformanceReports";

/**
 * The filter controls the trainee performance and course completion reports share: a date range, a course and a
 * department. Purely controlled — it edits the report builder's live filters and never fetches a report itself.
 *
 * The course and department option lists reuse the exact queries (and cache keys) OrganizationExams already uses, so
 * moving between those screens never re-downloads them.
 */
const ALL = "all";

interface CourseOption { Id: string; Title: string }
interface DepartmentOption { Id: string; Name: string }

export interface PerformanceReportFilterFieldsProps {
    filters: PerformanceReportFilters;
    onChange: <K extends keyof PerformanceReportFilters>(key: K, value: PerformanceReportFilters[K]) => void;
    /** Shown under the dates when the range is backwards. */
    rangeInvalid?: boolean;
}

export const PerformanceReportFilterFields = ({ filters, onChange, rangeInvalid = false }: PerformanceReportFilterFieldsProps) => {
    const { t } = useTranslation("organization");

    const { data: courses = [] } = useQuery({
        queryKey: ["enrollment-courses"],
        queryFn: async () => (await api.get<CourseOption[]>("/Courses", { params: { status: "Published", pageSize: 100 } })).data,
    });
    const { data: departments = [] } = useQuery({
        queryKey: ["organization-departments"],
        queryFn: async () => (await api.get<DepartmentOption[]>("/Departments")).data,
    });

    return (
        <div className="space-y-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                    <Label htmlFor="perf-report-from">{t("reports.performanceFilters.from")}</Label>
                    <Input
                        id="perf-report-from"
                        type="date"
                        value={filters.from ?? ""}
                        max={filters.to || undefined}
                        onChange={(e) => onChange("from", e.target.value || undefined)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="perf-report-to">{t("reports.performanceFilters.to")}</Label>
                    <Input
                        id="perf-report-to"
                        type="date"
                        value={filters.to ?? ""}
                        min={filters.from || undefined}
                        onChange={(e) => onChange("to", e.target.value || undefined)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>{t("reports.performanceFilters.course")}</Label>
                    <Select value={filters.courseId ?? ALL} onValueChange={(v) => onChange("courseId", v === ALL ? undefined : v)}>
                        <SelectTrigger aria-label={t("reports.performanceFilters.course")}>
                            <SelectValue placeholder={t("reports.performanceFilters.allCourses")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t("reports.performanceFilters.allCourses")}</SelectItem>
                            {courses.map((c) => <SelectItem key={c.Id} value={c.Id}>{c.Title}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>{t("reports.performanceFilters.department")}</Label>
                    <Select value={filters.departmentId ?? ALL} onValueChange={(v) => onChange("departmentId", v === ALL ? undefined : v)}>
                        <SelectTrigger aria-label={t("reports.performanceFilters.department")}>
                            <SelectValue placeholder={t("reports.performanceFilters.allDepartments")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t("reports.performanceFilters.allDepartments")}</SelectItem>
                            {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {rangeInvalid && (
                <p role="alert" className="text-sm text-destructive">{t("reports.performanceFilters.invalidRange")}</p>
            )}
        </div>
    );
};

export default PerformanceReportFilterFields;
