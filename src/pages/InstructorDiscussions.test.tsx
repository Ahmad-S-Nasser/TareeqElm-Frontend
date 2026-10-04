import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import InstructorDiscussions from "./InstructorDiscussions";
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

const thread = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: id,
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  Title: "How do I get started?",
  Body: "Any tips for week 1?",
  AuthorId: "t1",
  AuthorName: "Sam Trainer",
  Pinned: false,
  Locked: false,
  CreatedAt: new Date().toISOString(),
  ReplyCount: 1,
  ...overrides,
});

const threadDetail = (t: ReturnType<typeof thread>) => ({
  Thread: t,
  Replies: [
    { Id: "r1", ThreadId: t.Id, AuthorId: "t1", AuthorName: "Sam Trainer", Body: "Following up on my question.", CreatedAt: new Date().toISOString() },
  ],
});

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Instructor", Permissions: ["discussions.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses/mine").reply(200, courses);
});
afterEach(() => mock.restore());

describe("InstructorDiscussions", () => {
  it("lists discussions scoped to the caller", async () => {
    mock.onGet("/Discussions").reply(200, [thread("d1")]);
    renderWithProviders(<InstructorDiscussions />);
    expect(await screen.findByText("How do I get started?")).toBeInTheDocument();
    expect(screen.getByText("Sam Trainer")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mock.onGet("/Discussions").reply(200, []);
    renderWithProviders(<InstructorDiscussions />);
    expect(await screen.findByText(/no discussions yet/i)).toBeInTheDocument();
  });

  it("creates a discussion thread for a chosen course", async () => {
    mock.onGet("/Discussions").reply(200, []);
    mock.onPost("/Discussions").reply(200, thread("d2"));
    const user = userEvent.setup();
    renderWithProviders(<InstructorDiscussions />);

    await user.click(await screen.findByRole("button", { name: /new thread/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "Welcome thread");
    await user.type(within(dialog).getByLabelText("Message"), "Say hello here.");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByText("Intro to Testing"));
    await user.click(within(dialog).getByRole("button", { name: /create thread/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/Discussions")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ CourseId: "c1", Title: "Welcome thread", Body: "Say hello here." });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Thread created" }));
  });

  it("opens a thread, pins it and posts a reply", async () => {
    const t = thread("d1");
    mock.onGet("/Discussions").reply(200, [t]);
    mock.onGet("/Discussions/d1").reply(200, threadDetail(t));
    mock.onPut("/Discussions/d1/state").reply(200, { ...t, Pinned: true });
    mock.onPost("/Discussions/d1/replies").reply(200, { Id: "r2", ThreadId: "d1", AuthorId: "u1", AuthorName: "Jane Instructor", Body: "Glad to help!", CreatedAt: new Date().toISOString() });
    const user = userEvent.setup();
    renderWithProviders(<InstructorDiscussions />);

    await user.click(await screen.findByText("How do I get started?"));
    expect(await screen.findByText("Following up on my question.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^pin$/i }));
    await waitFor(() => expect(mock.history.put.filter((r) => r.url === "/Discussions/d1/state")).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ Pinned: true });

    await user.type(screen.getByPlaceholderText("Write a reply..."), "Glad to help!");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/Discussions/d1/replies")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Body: "Glad to help!" });
  });

  it("deletes a thread after confirmation", async () => {
    const t = thread("d1");
    mock.onGet("/Discussions").reply(200, [t]);
    mock.onGet("/Discussions/d1").reply(200, threadDetail(t));
    mock.onDelete("/Discussions/d1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<InstructorDiscussions />);

    await user.click(await screen.findByText("How do I get started?"));
    await screen.findByText("Following up on my question.");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(mock.history.delete.filter((r) => r.url === "/Discussions/d1")).toHaveLength(1));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Thread deleted" }));
  });
});
