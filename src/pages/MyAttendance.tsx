import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Loader2 } from "lucide-react";
import api, { getApiError } from "@/lib/api";
import { useFormatters } from "@/lib/format";
import { JoinSessionButton } from "@/components/organization/JoinSessionButton";
import type { MyAttendanceRowDto } from "@/lib/courseSessionTime";

const statusBadgeClass: Record<string, string> = {
    Present: "bg-emerald-500/10 text-emerald-600",
    Absent: "bg-destructive/10 text-destructive",
    Late: "bg-amber-500/10 text-amber-600",
    Excused: "bg-muted text-muted-foreground",
};

const MyAttendance = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { t } = useTranslation(["learning", "common"]);
    const { formatDateTime } = useFormatters();

    const { data: rows = [], isLoading, isError, error } = useQuery({
        queryKey: ["my-attendance"],
        queryFn: async () => (await api.get<MyAttendanceRowDto[]>("/trainer/attendance")).data,
    });

    return (
        <div className="min-h-screen bg-background text-foreground">
            <ApplicantSidebar onCollapse={setSidebarCollapsed} />
            <Header sidebarCollapsed={sidebarCollapsed} userRole="Trainer" mobileSidebar={<ApplicantSidebarContent />} />

            <main className={cn("pt-20 pb-8 px-4 sm:px-6 transition-all duration-300", sidebarCollapsed ? "lg:ms-20" : "lg:ms-64", "ms-0")}>
                <div className="max-w-5xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <CalendarClock className="w-7 h-7 text-primary" />
                            {t("myAttendance.title")}
                        </h1>
                        <p className="text-muted-foreground mt-1">{t("myAttendance.subtitle")}</p>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : isError ? (
                        <p className="text-center text-destructive py-12">{getApiError(error, t("myAttendance.loadFailed"))}</p>
                    ) : rows.length === 0 ? (
                        <p className="text-center text-muted-foreground py-12">{t("myAttendance.empty")}</p>
                    ) : (
                        <div className="space-y-3">
                            {rows.map((row) => (
                                <Card key={row.SessionId} className="border-border/50">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <CardTitle className="text-base">{row.LessonTitle ?? t("common:deletedEntity")}</CardTitle>
                                            {row.AttendanceStatus ? (
                                                <Badge className={statusBadgeClass[row.AttendanceStatus]}>{t(`myAttendance.status.${row.AttendanceStatus.toLowerCase()}`)}</Badge>
                                            ) : row.SessionStatus === "Cancelled" ? (
                                                <Badge variant="outline">{t("myAttendance.cancelled")}</Badge>
                                            ) : (
                                                <Badge variant="outline">{t("myAttendance.upcoming")}</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex items-center justify-between gap-3">
                                        <p className="text-sm text-muted-foreground">
                                            {row.CourseTitle ?? t("common:deletedCourse")} · {formatDateTime(row.StartsAt, { dateStyle: "medium", timeStyle: "short", timeZone: row.TimeZone })}
                                        </p>
                                        {row.SessionStatus === "Scheduled" && !row.AttendanceStatus && (
                                            <JoinSessionButton courseId={row.CourseId} sessionId={row.SessionId} />
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default MyAttendance;
