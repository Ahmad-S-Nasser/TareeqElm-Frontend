import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import TrainerDiscussions from "./TrainerDiscussions";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const enrollment = {
  Id: "e1", TrainerId: "t1", CourseId: "c1", EnrolledAt: "2026-01-01T00:00:00Z", ProgressPercentage: 40, CompletedAt: null,
  CourseTitle: "Intro to Testing",
  Course: { Id: "c1", Title: "Intro to Testing", Description: null, Category: null, Level: null, ImageUrl: null, InstructorId: "u-instructor", InstructorName: "Jane Instructor", Status: "Published", LessonsCount: 4, EnrolledCount: 10, IsFeatured: false, DurationHours: null },
};

const thread = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: id,
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  Title: "How do I get started?",
  Body: "Any tips for week 1?",
  AuthorId: "u-instructor",
  AuthorName: "Jane Instructor",
  Pinned: false,
  Locked: false,
  CreatedAt: new Date().toISOString(),
  ReplyCount: 0,
  ...overrides,
});

const threadDetail = (t: ReturnType<typeof thread>) => ({ Thread: t, Replies: [] });

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "t1", Role: "Trainer", Permissions: ["discussions.participate"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Enrollments/me").reply(200, [enrollment]);
});
afterEach(() => mock.restore());

describe("TrainerDiscussions", () => {
  it("lists discussions from enrolled courses", async () => {
    mock.onGet("/Discussions").reply(200, [thread("d1")]);
    renderWithProviders(<TrainerDiscussions />);
    expect(await screen.findByText("How do I get started?")).toBeInTheDocument();
    expect(screen.getByText("Jane Instructor")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mock.onGet("/Discussions").reply(200, []);
    renderWithProviders(<TrainerDiscussions />);
    expect(await screen.findByText(/no discussions yet/i)).toBeInTheDocument();
  });

  it("hides the new-thread button without discussions.manage", async () => {
    mock.onGet("/Discussions").reply(200, []);
    renderWithProviders(<TrainerDiscussions />);
    await screen.findByText(/no discussions yet/i);
    expect(screen.queryByRole("button", { name: /new thread/i })).not.toBeInTheDocument();
  });

  it("opens a thread and posts a reply", async () => {
    const t = thread("d1");
    mock.onGet("/Discussions").reply(200, [t]);
    mock.onGet("/Discussions/d1").reply(200, threadDetail(t));
    mock.onPost("/Discussions/d1/replies").reply(200, { Id: "r1", ThreadId: "d1", AuthorId: "t1", AuthorName: "Sam Trainer", Body: "Thanks!", CreatedAt: new Date().toISOString() });
    const user = userEvent.setup();
    renderWithProviders(<TrainerDiscussions />);

    await user.click(await screen.findByText("How do I get started?"));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Write a reply..."), "Thanks!");
    await user.click(within(dialog).getByRole("button", { name: /send/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/Discussions/d1/replies")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Body: "Thanks!" });
  });

  it("shows a locked notice instead of the reply form when the thread is locked", async () => {
    const t = thread("d1", { Locked: true });
    mock.onGet("/Discussions").reply(200, [t]);
    mock.onGet("/Discussions/d1").reply(200, threadDetail(t));
    const user = userEvent.setup();
    renderWithProviders(<TrainerDiscussions />);

    await user.click(await screen.findByText("How do I get started?"));
    expect(await screen.findByText(/this thread is locked/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write a reply...")).not.toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/Discussions").reply(500);
    renderWithProviders(<TrainerDiscussions />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });
});
