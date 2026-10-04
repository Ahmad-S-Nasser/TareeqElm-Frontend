import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { SessionScheduler } from "./SessionScheduler";
import { renderWithProviders } from "@/test/renderWithProviders";

const courses = [{ Id: "c1", Title: "Intro to Testing" }];

const curriculum = [
  { Id: "ch1", Title: "Chapter 1", Lessons: [
    { Id: "l-pre", Title: "Recorded intro", DeliveryMode: "PreRecorded" },
    { Id: "l-live", Title: "Live Q&A", DeliveryMode: "LiveOnline" },
    { Id: "l-offline", Title: "Lab session", DeliveryMode: "Offline" },
  ] },
];

const buildings = [{ Id: "b1", Name: "Main Building", RoomsCount: 1 }];
const rooms = { b1: [{ Id: "r1", BuildingId: "b1", Name: "3/2" }] };

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet("/Courses/c1/curriculum").reply(200, curriculum);
  mock.onGet("/facilities/buildings").reply(200, buildings);
  mock.onGet("/facilities/buildings/b1/rooms").reply(200, rooms.b1);
});
afterEach(() => mock.restore());

const openWithCourse = async (user: ReturnType<typeof userEvent.setup>) => {
  renderWithProviders(
    <SessionScheduler open onOpenChange={vi.fn()} courses={courses} onSaved={vi.fn()} />,
    { withAuth: false }
  );
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getAllByRole("combobox")[0]); // course
  await user.click(await screen.findByText("Intro to Testing"));
  return dialog;
};

describe("SessionScheduler", () => {
  it("shows a room picker only once an Offline lesson is selected", async () => {
    const user = userEvent.setup();
    const dialog = await openWithCourse(user);

    await user.click(within(dialog).getAllByRole("combobox")[1]);
    await user.click(await screen.findByText(/Lab session/));

    expect(await within(dialog).findByText("Room")).toBeInTheDocument();
    // Combobox order: course, lesson, time zone, room; open the room one and confirm the fetched room is offered.
    await user.click(within(dialog).getAllByRole("combobox")[3]);
    expect(await screen.findByText("Main Building / 3/2")).toBeInTheDocument();
  });

  it("shows the meeting provider toggle only once a Live-online lesson is selected, and no room picker", async () => {
    const user = userEvent.setup();
    const dialog = await openWithCourse(user);

    await user.click(within(dialog).getAllByRole("combobox")[1]);
    await user.click(await screen.findByText(/Live Q&A/));

    expect(within(dialog).getByText("Meeting provider")).toBeInTheDocument();
    expect(within(dialog).queryByText("Room")).not.toBeInTheDocument();
  });

  it("converts the chosen local time and zone to the correct UTC instant before submitting", async () => {
    mock.onPost("/courses/c1/sessions").reply(200, {});
    const user = userEvent.setup();
    const dialog = await openWithCourse(user);

    await user.click(within(dialog).getAllByRole("combobox")[1]); // lesson
    await user.click(await screen.findByText(/Live Q&A/));

    const startInput = within(dialog).getByLabelText("Starts at");
    await user.clear(startInput);
    await user.type(startInput, "2026-06-15T10:00");

    // Time zone defaults to UTC; switch it to Asia/Riyadh.
    await user.click(within(dialog).getAllByRole("combobox")[2]);
    await user.click(await screen.findByText("Asia/Riyadh"));

    await user.click(within(dialog).getByRole("button", { name: "Schedule session" }));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    const body = JSON.parse(mock.history.post[0].data);
    expect(body.startsAt).toBe("2026-06-15T07:00:00.000Z"); // 10:00 Asia/Riyadh (UTC+3) -> 07:00 UTC
  });
});
