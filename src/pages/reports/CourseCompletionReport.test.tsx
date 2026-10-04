/**
 * Course Completion report: completion / dropout / avg-time-to-complete rates by course, gated on reports.view, loaded
 * only after "Generate report" from GET /organization/reports/course-completion.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import CourseCompletionReport from "./CourseCompletionReport";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const REPORT = {
  EnrollmentCount: 20,
  CompletedCount: 14,
  DroppedCount: 2,
  CompletionRate: 0.7,
  AverageDaysToComplete: 12.5,
  DropoutRate: 0.1,
  Rows: [
    { CourseId: "c1", CourseTitle: "Algebra I", EnrollmentCount: 20, CompletedCount: 14, DroppedCount: 2, CompletionRate: 0.7, AverageDaysToComplete: 12.5, DropoutRate: 0.1 },
  ],
};

const EMPTY_REPORT = { ...REPORT, EnrollmentCount: 0, CompletedCount: 0, DroppedCount: 0, CompletionRate: 0, AverageDaysToComplete: null, DropoutRate: 0, Rows: [] };

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

const reportCalls = () => mock.history.get.filter((r) => r.url === "/organization/reports/course-completion");

describe("CourseCompletionReport", () => {
  it("loads nothing until Generate, then shows KPIs and the per-course breakdown", async () => {
    signIn(["reports.view"]);
    mock.onGet("/organization/reports/course-completion").reply(200, REPORT);
    const user = userEvent.setup();
    renderWithProviders(<CourseCompletionReport />);

    expect(await screen.findByTestId("report-prompt")).toBeInTheDocument();
    expect(reportCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Generate report" }));

    expect((await screen.findAllByText("70%")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("course-completion-rows")).toHaveTextContent("Algebra I");
    expect(reportCalls()).toHaveLength(1);
  });

  it("shows the empty state when nothing matches the filters", async () => {
    signIn(["reports.view"]);
    mock.onGet("/organization/reports/course-completion").reply(200, EMPTY_REPORT);
    const user = userEvent.setup();
    renderWithProviders(<CourseCompletionReport />);

    await user.click(await screen.findByRole("button", { name: "Generate report" }));

    expect(await screen.findByTestId("report-empty")).toBeInTheDocument();
  });

  it("is refused without reports.view", async () => {
    signIn([]);
    renderWithProviders(<CourseCompletionReport />);

    expect(await screen.findByTestId("report-no-access")).toBeInTheDocument();
    expect(reportCalls()).toHaveLength(0);
  });
});
