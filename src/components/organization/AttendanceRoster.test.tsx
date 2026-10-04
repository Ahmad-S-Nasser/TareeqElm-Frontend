import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { AttendanceRoster } from "./AttendanceRoster";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { AttendanceRowDto } from "@/lib/courseSessionTime";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const rows: AttendanceRowDto[] = [
    { TrainerId: "t1", TrainerName: "Sam Trainer", Status: null, Source: null, JoinedAt: null, LeftAt: null, DurationMinutes: null, MarkedByName: null, MarkedAt: null },
    { TrainerId: "t2", TrainerName: "Alex Attendee", Status: "Present", Source: "CoonMeetingWebhook", JoinedAt: "2026-01-01T10:00:00Z", LeftAt: null, DurationMinutes: null, MarkedByName: null, MarkedAt: null },
];

let mock: MockAdapter;
beforeEach(() => {
    toastMock.mockClear();
    mock = new MockAdapter(api);
    mock.onGet("/courses/c1/sessions/s1/attendance").reply(200, rows);
});
afterEach(() => mock.restore());

describe("AttendanceRoster", () => {
    it("renders enrolled trainers with their status and source badges", async () => {
        renderWithProviders(<AttendanceRoster open onOpenChange={vi.fn()} courseId="c1" sessionId="s1" />, { withAuth: false });

        expect(await screen.findByText("Sam Trainer")).toBeInTheDocument();
        expect(screen.getByText("Alex Attendee")).toBeInTheDocument();
        expect(screen.getByText("Auto")).toBeInTheDocument();
    });

    it("marking a trainer's status calls the mark endpoint", async () => {
        mock.onGet("/courses/c1/sessions/s1/attendance").reply(200, [rows[0]]); // only the unmarked trainer, to avoid an ambiguous "Present" match
        mock.onPost("/courses/c1/sessions/s1/attendance").reply(200, {});
        const user = userEvent.setup();
        renderWithProviders(<AttendanceRoster open onOpenChange={vi.fn()} courseId="c1" sessionId="s1" />, { withAuth: false });
        await screen.findByText("Sam Trainer");

        await user.click(screen.getByRole("combobox"));
        await user.click(await screen.findByText("Present"));

        await waitFor(() => expect(mock.history.post).toHaveLength(1));
        expect(JSON.parse(mock.history.post[0].data)).toMatchObject({ trainerId: "t1", status: "Present" });
    });

    it("shows an explanatory toast when a webhook-confirmed present cannot be marked absent", async () => {
        mock.onGet("/courses/c1/sessions/s1/attendance").reply(200, [rows[1]]); // only the webhook-confirmed trainer
        mock.onPost("/courses/c1/sessions/s1/attendance").reply(409, { title: "This trainer's attendance was already confirmed automatically by the meeting platform and cannot be marked absent by hand." });
        const user = userEvent.setup();
        renderWithProviders(<AttendanceRoster open onOpenChange={vi.fn()} courseId="c1" sessionId="s1" />, { withAuth: false });
        await screen.findByText("Alex Attendee");

        await user.click(screen.getByRole("combobox"));
        await user.click(await screen.findByText("Absent"));

        await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
    });
});
