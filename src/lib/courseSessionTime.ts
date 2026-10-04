export interface CourseSessionDto {
    Id: string;
    LessonId: string;
    LessonTitle: string | null;
    CourseId: string;
    InstructorId: string;
    InstructorName: string | null;
    StartsAt: string;
    DurationMinutes: number;
    TimeZone: string;
    RoomId: string | null;
    RoomName: string | null;
    LocationNote: string | null;
    DeliveryMode: "LiveOnline" | "Offline" | "PreRecorded";
    MeetingProvider: "ManualLink" | "CoonMeeting";
    ManualMeetingLink: string | null;
    SectionId: string | null;
    Status: "Scheduled" | "Cancelled" | "Completed";
}

export interface AttendanceRowDto {
    TrainerId: string;
    TrainerName: string | null;
    Status: "Present" | "Absent" | "Late" | "Excused" | null;
    Source: "Manual" | "CoonMeetingWebhook" | null;
    JoinedAt: string | null;
    LeftAt: string | null;
    DurationMinutes: number | null;
    MarkedByName: string | null;
    MarkedAt: string | null;
}

export interface MyAttendanceRowDto {
    SessionId: string;
    CourseId: string;
    CourseTitle: string | null;
    LessonId: string;
    LessonTitle: string | null;
    InstructorName: string | null;
    StartsAt: string;
    DurationMinutes: number;
    TimeZone: string;
    SessionStatus: "Scheduled" | "Cancelled" | "Completed";
    AttendanceStatus: "Present" | "Absent" | "Late" | "Excused" | null;
}

export interface JoinTokenResponseDto {
    Provider: "ManualLink" | "CoonMeeting";
    ManualMeetingLink: string | null;
    Token: string | null;
    ApiBaseUrl: string | null;
    MeetingId: string | null;
}

// A short curated list, not a full IANA-zone picker (no such precedent exists elsewhere in this app).
export const TIME_ZONES = ["Asia/Riyadh", "Asia/Dubai", "Africa/Cairo", "Europe/London", "UTC"];

/** The wall-clock offset (minutes) of `timeZone` at `date`, e.g. +180 for Asia/Riyadh. */
const zoneOffsetMinutes = (date: Date, timeZone: string): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as Record<string, string>);
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return (asUtc - date.getTime()) / 60000;
};

/** "2026-01-01T10:00" wall time in `timeZone` -> a UTC ISO string. */
export const zonedInputToUtcIso = (input: string, timeZone: string): string => {
    const [datePart, timePart] = input.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = (timePart ?? "00:00").split(":").map(Number);
    const naiveUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);
    // One correction pass is enough in practice: DST offsets don't shift the naive guess across another boundary.
    const offset = zoneOffsetMinutes(new Date(naiveUtcMs), timeZone);
    return new Date(naiveUtcMs - offset * 60000).toISOString();
};

/** A UTC ISO string -> "2026-01-01T10:00" wall time in `timeZone`, for a datetime-local input. */
export const utcIsoToZonedInput = (iso: string, timeZone: string): string => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(iso)).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as Record<string, string>);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
