import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationExams from "./OrganizationExams";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const courses = [{ Id: "c1", Title: "Intro to Testing" }];
const departments = [{ Id: "d1", Name: "Engineering" }];

const exam = (overrides: Partial<Record<string, unknown>> = {}) => ({
  QuizId: "q1",
  QuizTitle: "Midterm",
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  DepartmentId: "d1",
  DepartmentName: "Engineering",
  QuestionCount: 10,
  PassingScore: 70,
  AttemptCount: 5,
  AverageScore: 72.5,
  PassRate: 80,
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Organization", Permissions: ["exams.view"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses").reply(200, courses);
  mock.onGet("/Departments").reply(200, departments);
});
afterEach(() => mock.restore());

describe("OrganizationExams", () => {
  it("lists exams with resolved course/department names and pass rate", async () => {
    mock.onGet("/organization/exams").reply(200, [exam()]);
    renderWithProviders(<OrganizationExams />);
    expect(await screen.findByText("Midterm")).toBeInTheDocument();
    expect(screen.getByText("Intro to Testing")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("shows the empty state when there are no quizzes", async () => {
    mock.onGet("/organization/exams").reply(200, []);
    renderWithProviders(<OrganizationExams />);
    expect(await screen.findByText("No quizzes match your filters.")).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/organization/exams").reply(500);
    renderWithProviders(<OrganizationExams />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("re-queries with the chosen course filter", async () => {
    mock.onGet("/organization/exams").reply(200, [exam()]);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationExams />);
    await screen.findByText("Midterm");

    await user.click(screen.getByRole("combobox", { name: "Course" }));
    await user.click(await screen.findByRole("option", { name: "Intro to Testing" }));

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/organization/exams").pop();
      expect(call?.params?.courseId).toBe("c1");
    });
  });

  it("opens the results drawer and shows resolved trainer names", async () => {
    mock.onGet("/organization/exams").reply(200, [exam()]);
    mock.onGet("/Quizzes/q1/results").reply(200, [
      { Id: "r1", QuizId: "q1", QuizTitle: "Midterm", CourseId: "c1", CourseTitle: "Intro to Testing", TrainerId: "t1", TrainerName: "Jane Doe", Score: 8, TotalPoints: 10, Percentage: 80, Passed: true, TimeTakenSeconds: 300, TakenAt: "2026-01-05T10:00:00Z" },
    ]);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationExams />);
    await screen.findByText("Midterm");

    await user.click(screen.getByRole("button", { name: /view results/i }));
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
  });

  it("shows an error when the results fail to load", async () => {
    mock.onGet("/organization/exams").reply(200, [exam()]);
    mock.onGet("/Quizzes/q1/results").reply(500);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationExams />);
    await screen.findByText("Midterm");

    await user.click(screen.getByRole("button", { name: /view results/i }));
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });
});
