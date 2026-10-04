import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import MyAttendance from "./MyAttendance";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";
import type { MyAttendanceRowDto } from "@/lib/courseSessionTime";

vi.mock("coon-meeting-sdk", () => ({ CallRoom: () => <div data-testid="call-room" /> }));

const rows: MyAttendanceRowDto[] = [
    {
        SessionId: "s1", CourseId: "c1", CourseTitle: "Intro to Testing", LessonId: "l1", LessonTitle: "Live Q&A",
        InstructorName: "Jane Instructor", StartsAt: "2026-06-15T10:00:00Z", DurationMinutes: 60, TimeZone: "UTC",
        SessionStatus: "Scheduled", AttendanceStatus: null,
    },
    {
        SessionId: "s2", CourseId: "c1", CourseTitle: "Intro to Testing", LessonId: "l2", LessonTitle: "Lab session",
        InstructorName: "Jane Instructor", StartsAt: "2026-01-01T10:00:00Z", DurationMinutes: 60, TimeZone: "UTC",
        SessionStatus: "Completed", AttendanceStatus: "Present",
    },
];

let mock: MockAdapter;
beforeEach(() => {
    mock = new MockAdapter(api);
    const user = makeUser({ Id: "u1", Role: "Trainer", FullName: "Sam Trainer", Permissions: [] });
    seedSession(user);
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/trainer/attendance").reply(200, rows);
});
afterEach(() => mock.restore());

describe("MyAttendance", () => {
    it("shows a join action for an upcoming scheduled session and a status badge for a past one", async () => {
        renderWithProviders(<MyAttendance />);

        expect(await screen.findByText("Live Q&A")).toBeInTheDocument();
        expect(screen.getByText("Lab session")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
        expect(screen.getByText("Present")).toBeInTheDocument();
    });
});
