import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import TrainerAssignments from "./TrainerAssignments";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const assignment = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: id,
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  Title: "Week 1 Homework",
  Description: "Complete the exercises.",
  DueAt: "2099-05-01T10:00:00Z",
  MaxScore: 100,
  AllowLate: true,
  Attachments: [],
  CreatedBy: "u-instructor",
  CreatedByName: "Jane Instructor",
  CreatedAt: "2026-04-01T00:00:00Z",
  MySubmission: null,
  SubmissionCount: null,
  EnrolledCount: null,
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "t1", Role: "Trainer", Permissions: ["assignments.submit", "materials.view"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

describe("TrainerAssignments", () => {
  it("lists assignments from enrolled courses", async () => {
    mock.onGet("/Assignments").reply(200, [assignment("a1")]);
    renderWithProviders(<TrainerAssignments />);
    expect(await screen.findByText("Week 1 Homework")).toBeInTheDocument();
    expect(screen.getByText("Intro to Testing")).toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mock.onGet("/Assignments").reply(200, []);
    renderWithProviders(<TrainerAssignments />);
    expect(await screen.findByText(/no assignments yet/i)).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/Assignments").reply(500);
    renderWithProviders(<TrainerAssignments />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("shows the grade and feedback once an assignment has been graded", async () => {
    mock.onGet("/Assignments").reply(200, [
      assignment("a1", {
        MySubmission: {
          Id: "s1", AssignmentId: "a1", TrainerId: "t1", TrainerName: "Sam Trainer", Text: "My answer", Files: [],
          SubmittedAt: "2026-04-10T00:00:00Z", Score: 88, Feedback: "Well done", GradedAt: "2026-04-12T00:00:00Z", Status: "graded",
        },
      }),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<TrainerAssignments />);

    await user.click(await screen.findByText("Week 1 Homework"));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText((_, node) => node?.textContent === "88/100" && node?.tagName === "BDI")).toBeInTheDocument();
    expect(within(dialog).getByText("Well done")).toBeInTheDocument();
  });

  it("submits a text answer", async () => {
    mock.onGet("/Assignments").reply(200, [assignment("a1")]);
    mock.onPost("/Assignments/a1/submissions").reply(200, {
      Id: "s1", AssignmentId: "a1", TrainerId: "t1", TrainerName: "Sam Trainer", Text: "Here is my work", Files: [],
      SubmittedAt: new Date().toISOString(), Score: null, Feedback: null, GradedAt: null, Status: "submitted",
    });
    const user = userEvent.setup();
    renderWithProviders(<TrainerAssignments />);

    await user.click(await screen.findByText("Week 1 Homework"));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Write your answer..."), "Here is my work");
    await user.click(within(dialog).getByRole("button", { name: /submit assignment/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/Assignments/a1/submissions")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Text: "Here is my work", Files: [] });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Submission received" }));
  });
});
