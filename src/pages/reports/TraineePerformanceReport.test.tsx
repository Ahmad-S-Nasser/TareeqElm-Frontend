/**
 * Trainee Performance report: grade distribution / pass-fail over quiz attempts, gated on reports.view, loaded only
 * after "Generate report" from GET /organization/reports/trainee-performance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import TraineePerformanceReport from "./TraineePerformanceReport";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const REPORT = {
  Summary: {
    AttemptCount: 12,
    PassCount: 9,
    PassRate: 0.75,
    AverageScore: 81.4,
    DistributionBuckets: [
      { Label: "0-59", Min: 0, Max: 59, Count: 1 },
      { Label: "60-69", Min: 60, Max: 69, Count: 2 },
      { Label: "70-79", Min: 70, Max: 79, Count: 3 },
      { Label: "80-89", Min: 80, Max: 89, Count: 4 },
      { Label: "90-100", Min: 90, Max: 100, Count: 2 },
    ],
    Courses: [{ CourseId: "c1", CourseTitle: "Algebra I", AttemptCount: 12, PassCount: 9, PassRate: 0.75, AverageScore: 81.4 }],
  },
  Rows: {
    Items: [
      { ResultId: "r1", TrainerId: "t1", TrainerName: "Jane Doe", CourseId: "c1", CourseTitle: "Algebra I", QuizId: "q1", QuizTitle: "Quiz 1", Percentage: 90, Passed: true, TakenAt: "2026-02-01T00:00:00Z" },
    ],
    Total: 12,
  },
  Page: 1,
  PageSize: 20,
};

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
});
afterEach(() => mock.restore());

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "u1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

const reportCalls = () => mock.history.get.filter((r) => r.url === "/organization/reports/trainee-performance");

describe("TraineePerformanceReport", () => {
  it("loads nothing until Generate, then shows KPIs, distribution and the attempt drill-down", async () => {
    signIn(["reports.view"]);
    mock.onGet("/organization/reports/trainee-performance").reply(200, REPORT);
    const user = userEvent.setup();
    renderWithProviders(<TraineePerformanceReport />);

    expect(await screen.findByTestId("report-prompt")).toBeInTheDocument();
    expect(reportCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Generate report" }));

    expect((await screen.findAllByText("75%")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("score-distribution")).toBeInTheDocument();
    expect(screen.getByTestId("trainee-performance-rows")).toHaveTextContent("Jane Doe");
    expect(screen.getByTestId("trainee-performance-rows")).toHaveTextContent("Algebra I");
    expect(reportCalls()).toHaveLength(1);
  });

  it("is refused without reports.view", async () => {
    signIn([]);
    renderWithProviders(<TraineePerformanceReport />);

    expect(await screen.findByTestId("report-no-access")).toBeInTheDocument();
    expect(reportCalls()).toHaveLength(0);
  });

  it("blocks an inverted date range", async () => {
    signIn(["reports.view"]);
    const user = userEvent.setup();
    renderWithProviders(<TraineePerformanceReport />);

    await user.type(await screen.findByLabelText("From"), "2026-05-01");
    await user.type(screen.getByLabelText("To"), "2026-04-01");

    expect(screen.getByRole("alert")).toHaveTextContent("The start date must be on or before the end date.");
    expect(screen.getByRole("button", { name: "Generate report" })).toBeDisabled();
    expect(reportCalls()).toHaveLength(0);
  });
});
