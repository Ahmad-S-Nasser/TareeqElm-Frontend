import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import InstructorAnnouncements from "./InstructorAnnouncements";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/InstructorSidebar", () => ({
  InstructorSidebar: () => null,
  InstructorSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const courses = [
  { Id: "c1", Title: "Intro to Testing", InstructorId: "u1", Status: "Published", LessonsCount: 4, CreatedAt: "", UpdatedAt: "" },
];

const announcement = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: id,
  Title: "Midterm schedule",
  Body: "The midterm is next week.",
  Audience: "course",
  AudienceDetail: null,
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  Pinned: false,
  AuthorId: "u1",
  AuthorName: "Jane Instructor",
  CreatedAt: new Date().toISOString(),
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Instructor", Permissions: ["announcements.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses/mine").reply(200, courses);
});
afterEach(() => mock.restore());

describe("InstructorAnnouncements", () => {
  it("lists announcements scoped to the caller", async () => {
    mock.onGet("/Announcements").reply(200, [announcement("a1")]);
    renderWithProviders(<InstructorAnnouncements />);
    expect(await screen.findByText("Midterm schedule")).toBeInTheDocument();
    expect(screen.getByText("Jane Instructor")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mock.onGet("/Announcements").reply(200, []);
    renderWithProviders(<InstructorAnnouncements />);
    expect(await screen.findByText(/no announcements yet/i)).toBeInTheDocument();
  });

  it("creates an announcement for a chosen course", async () => {
    mock.onGet("/Announcements").reply(200, []);
    mock.onPost("/Announcements").reply(200, announcement("a2"));
    const user = userEvent.setup();
    renderWithProviders(<InstructorAnnouncements />);

    await user.click(await screen.findByRole("button", { name: /new announcement/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "Guest lecture");
    await user.type(within(dialog).getByLabelText("Message"), "Join us Friday.");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByText("Intro to Testing"));
    await user.click(within(dialog).getByRole("button", { name: /post announcement/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/Announcements")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      Title: "Guest lecture", Body: "Join us Friday.", Audience: "course", CourseId: "c1",
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Announcement posted" }));
  });

  it("shows a validation error instead of posting when required fields are missing", async () => {
    mock.onGet("/Announcements").reply(200, []);
    const user = userEvent.setup();
    renderWithProviders(<InstructorAnnouncements />);

    await user.click(await screen.findByRole("button", { name: /new announcement/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /post announcement/i }));

    expect(await within(dialog).findByText(/enter a title and a message/i)).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });

  it("pins and deletes an announcement", async () => {
    mock.onGet("/Announcements").reply(200, [announcement("a1")]);
    mock.onPut("/Announcements/a1/pin").reply(204);
    mock.onDelete("/Announcements/a1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<InstructorAnnouncements />);

    await screen.findByText("Midterm schedule");
    await user.click(screen.getByRole("button", { name: /^pin$/i }));
    await waitFor(() => expect(mock.history.put.filter((r) => r.url === "/Announcements/a1/pin")).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ Pinned: true });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(mock.history.delete.filter((r) => r.url === "/Announcements/a1")).toHaveLength(1));
  });
});
