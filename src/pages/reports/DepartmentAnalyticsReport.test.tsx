/**
 * Department Analytics report: the department charts that used to be always-on on the Reports page now load only after
 * "Generate report", from GET /Organization/departments with the chosen from/to window. Gated on organization.view.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import DepartmentAnalyticsReport from "./DepartmentAnalyticsReport";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const DEPARTMENTS = [
  { Id: "d1", Name: "Engineering", Head: null, CoursesCount: 3, TrainersCount: 8, Performance: 70, Trend: 0 },
  { Id: "d2", Name: "Marketing", Head: null, CoursesCount: 1, TrainersCount: 2, Performance: 40, Trend: 0 },
];

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

const deptCalls = () => mock.history.get.filter((r) => r.url === "/Organization/departments");

describe("DepartmentAnalyticsReport", () => {
  it("loads nothing until Generate, then shows the department summary for the chosen window", async () => {
    signIn(["organization.view"]);
    mock.onGet("/Organization/departments").reply(200, DEPARTMENTS);
    const user = userEvent.setup();
    renderWithProviders(<DepartmentAnalyticsReport />);

    expect(await screen.findByTestId("report-prompt")).toBeInTheDocument();
    await user.type(screen.getByLabelText("From"), "2026-01-01");
    await user.type(screen.getByLabelText("To"), "2026-03-31");
    expect(deptCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Generate report" }));

    expect(await screen.findByTestId("dept-row-d1")).toHaveTextContent("Engineering");
    expect(screen.getByTestId("dept-row-d2")).toHaveTextContent("Marketing");
    expect(screen.getByText("Department performance")).toBeInTheDocument();
    expect(deptCalls()).toHaveLength(1);
    expect(deptCalls()[0].params).toEqual({ from: "2026-01-01", to: "2026-03-31" });
  });

  it("sends no window when the dates are left blank, and blocks an inverted range", async () => {
    signIn(["organization.view"]);
    mock.onGet("/Organization/departments").reply(200, DEPARTMENTS);
    const user = userEvent.setup();
    renderWithProviders(<DepartmentAnalyticsReport />);

    await user.click(await screen.findByRole("button", { name: "Generate report" }));
    await screen.findByTestId("dept-row-d1");
    expect(deptCalls()[0].params).toEqual({ from: undefined, to: undefined });

    await user.type(screen.getByLabelText("From"), "2026-05-01");
    await user.type(screen.getByLabelText("To"), "2026-04-01");
    expect(screen.getByRole("alert")).toHaveTextContent("The start date must be on or before the end date.");
    expect(screen.getByRole("button", { name: "Generate again" })).toBeDisabled();
  });

  it("is refused without organization.view", async () => {
    signIn([]);
    renderWithProviders(<DepartmentAnalyticsReport />);

    expect(await screen.findByTestId("report-no-access")).toBeInTheDocument();
    expect(deptCalls()).toHaveLength(0);
  });
});
