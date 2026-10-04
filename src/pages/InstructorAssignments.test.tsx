import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import InstructorAssignments from "./InstructorAssignments";
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

const assignment = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: id,
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  Title: "Week 1 Homework",
  Description: "Complete the exercises.",
  DueAt: "2026-05-01T10:00:00Z",
  MaxScore: 100,
  AllowLate: false,
  Attachments: [],
  CreatedBy: "u1",
  CreatedByName: "Jane Instructor",
  CreatedAt: "2026-04-01T00:00:00Z",
  MySubmission: null,
  SubmissionCount: 1,
  EnrolledCount: 3,
  ...overrides,
});

const submission = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: id,
  AssignmentId: "a1",
  TrainerId: "t1",
  TrainerName: "Sam Trainer",
  Text: "Here is my work.",
  Files: [],
  SubmittedAt: "2026-04-20T00:00:00Z",
  Score: null,
  Feedback: null,
  GradedAt: null,
  Status: "submitted",
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Instructor", Permissions: ["assignments.manage", "materials.view"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses/mine").reply(200, courses);
});
afterEach(() => mock.restore());

describe("InstructorAssignments", () => {
  it("lists assignments scoped to the caller", async () => {
    mock.onGet("/Assignments").reply(200, [assignment("a1")]);
    renderWithProviders(<InstructorAssignments />);
    expect(await screen.findByText("Week 1 Homework")).toBeInTheDocument();
    expect(screen.getByText("Intro to Testing")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mock.onGet("/Assignments").reply(200, []);
    renderWithProviders(<InstructorAssignments />);
    expect(await screen.findByText(/no assignments yet/i)).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/Assignments").reply(500);
    renderWithProviders(<InstructorAssignments />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("creates an assignment for a chosen course", async () => {
    mock.onGet("/Assignments").reply(200, []);
    mock.onPost("/Assignments").reply(200, assignment("a2"));
    const user = userEvent.setup();
    renderWithProviders(<InstructorAssignments />);

    await user.click(await screen.findByRole("button", { name: /create assignment/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "Guest lecture notes");
    await user.type(within(dialog).getByLabelText("Description"), "Summarize the lecture.");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByText("Intro to Testing"));
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: "2026-05-01T10:00" } });
    await user.click(within(dialog).getByRole("button", { name: /create assignment/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/Assignments")).toHaveLength(1));
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toMatchObject({ Title: "Guest lecture notes", Description: "Summarize the lecture.", CourseId: "c1", MaxScore: 100, AllowLate: false });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Assignment created" }));
  });

  it("shows a validation error instead of creating when required fields are missing", async () => {
    mock.onGet("/Assignments").reply(200, []);
    const user = userEvent.setup();
    renderWithProviders(<InstructorAssignments />);

    await user.click(await screen.findByRole("button", { name: /create assignment/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /create assignment/i }));

    expect(await within(dialog).findByText(/enter a title and a description/i)).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });

  it("deletes an assignment after confirmation", async () => {
    mock.onGet("/Assignments").reply(200, [assignment("a1")]);
    mock.onDelete("/Assignments/a1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<InstructorAssignments />);

    await screen.findByText("Week 1 Homework");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(mock.history.delete.filter((r) => r.url === "/Assignments/a1")).toHaveLength(1));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Assignment deleted" }));
  });

  it("views and grades submissions", async () => {
    mock.onGet("/Assignments").reply(200, [assignment("a1")]);
    mock.onGet("/Assignments/a1/submissions").reply(200, [submission("s1")]);
    mock.onPost("/Assignments/a1/submissions/s1/grade").reply(200, submission("s1", { Score: 90, Feedback: "Great job", Status: "graded" }));
    const user = userEvent.setup();
    renderWithProviders(<InstructorAssignments />);

    await screen.findByText("Week 1 Homework");
    await user.click(screen.getAllByRole("button", { name: /view submissions/i })[0]);
    expect(await screen.findByText("Sam Trainer")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Score"), "90");
    await user.type(screen.getByLabelText("Feedback"), "Great job");
    await user.click(screen.getByRole("button", { name: /save grade/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/Assignments/a1/submissions/s1/grade")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Score: 90, Feedback: "Great job" });
  });
});
