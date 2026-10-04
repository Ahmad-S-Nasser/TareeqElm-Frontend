import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { JoinSessionButton } from "./JoinSessionButton";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";
import type { JoinTokenResponseDto } from "@/lib/courseSessionTime";

const callRoomPropsMock = vi.hoisted(() => vi.fn());
vi.mock("coon-meeting-sdk", () => ({
    CallRoom: (props: unknown) => { callRoomPropsMock(props); return <div data-testid="call-room" />; },
}));

let mock: MockAdapter;
beforeEach(() => {
    callRoomPropsMock.mockClear();
    mock = new MockAdapter(api);
    const user = makeUser({ Id: "u1", Role: "Trainer", FullName: "Sam Trainer", Permissions: [] });
    seedSession(user);
    mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

describe("JoinSessionButton", () => {
    it("opens the manual meeting link directly for a ManualLink session", async () => {
        const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
        mock.onPost("/courses/c1/sessions/s1/join-token").reply(200, {
            Provider: "ManualLink", ManualMeetingLink: "https://meet.example.com/x", Token: null, ApiBaseUrl: null, MeetingId: null,
        } satisfies JoinTokenResponseDto);
        const user = userEvent.setup();
        renderWithProviders(<JoinSessionButton courseId="c1" sessionId="s1" />);

        await user.click(await screen.findByRole("button", { name: "Join" }));

        await waitFor(() => expect(openSpy).toHaveBeenCalledWith("https://meet.example.com/x", "_blank", "noopener,noreferrer"));
        expect(screen.queryByTestId("call-room")).not.toBeInTheDocument();
    });

    it("mints a token and renders CallRoom with the right props for a CoonMeeting session", async () => {
        mock.onPost("/courses/c1/sessions/s1/join-token").reply(200, {
            Provider: "CoonMeeting", ManualMeetingLink: null, Token: "tok-abc", ApiBaseUrl: "https://coon.example.com", MeetingId: "ext-123",
        } satisfies JoinTokenResponseDto);
        const user = userEvent.setup();
        renderWithProviders(<JoinSessionButton courseId="c1" sessionId="s1" />);

        await user.click(await screen.findByRole("button", { name: "Join" }));

        expect(await screen.findByTestId("call-room")).toBeInTheDocument();
        expect(callRoomPropsMock).toHaveBeenCalledWith(expect.objectContaining({
            apiBaseUrl: "https://coon.example.com", meetingId: "ext-123", participantToken: "tok-abc", participantName: "Sam Trainer",
        }));
    });
});
