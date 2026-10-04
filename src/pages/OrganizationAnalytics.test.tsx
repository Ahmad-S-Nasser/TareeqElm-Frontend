/**
 * The Financial tab renders `FinancialAnalyticsPanel` (period-over-period comparison, revenue by department, the revenue
 * goal) behind a `revenue.view` check — deliberately NOT the `RevenueDashboard` body `/organization/revenue` already shows.
 * These tests focus on the tab wiring; the panel itself is covered by `FinancialAnalyticsPanel.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationAnalytics from "./OrganizationAnalytics";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const STATS = {
  Stats: { TotalTrainers: 12, ActiveInstructors: 3, TotalCourses: 5, AvgCompletion: 62 },
  Departments: [{ Id: "d1", Name: "Engineering", Head: null, CoursesCount: 3, TrainersCount: 8, Performance: 70, Trend: 0 }],
};

const SUMMARY = {
  GrossRevenue: 100, Discounts: 0, Refunds: 0, NetRevenue: 100, PlatformFees: 10, InstructorEarnings: 90,
  OrderCount: 2, PaidOrderCount: 2, AverageOrderValue: 50, RefundRate: 0, Currency: "USD",
  From: "2026-09-01T00:00:00Z", To: "2026-10-01T00:00:00Z",
};

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet("/Settings").reply(200, { Currency: "USD" });
  mock.onGet("/Organization/stats").reply(200, STATS);
});
afterEach(() => mock.restore());

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "u1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

describe("OrganizationAnalytics — financial tab", () => {
  it("renders the financial analytics panel, not the revenue dashboard, when the user holds revenue.view", async () => {
    signIn(["organization.view", "revenue.view"]);
    mock.onGet("/admin/revenue/summary").reply(200, SUMMARY);
    mock.onGet("/admin/revenue/by-department").reply(200, []);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationAnalytics />);

    await screen.findByText("62%");
    await user.click(screen.getByRole("tab", { name: "Financials" }));

    await waitFor(() => expect(screen.getByTestId("delta-GrossRevenue-value")).toHaveTextContent("$100.00"));
    expect(screen.getByTestId("financial-analytics-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("kpi-gross")).not.toBeInTheDocument();
    expect(mock.history.get.filter((r) => r.url === "/admin/revenue/top-items" || r.url === "/admin/revenue/by-instructor")).toHaveLength(0);
  });

  it("shows a no-access message instead of the dashboard when revenue.view is missing", async () => {
    signIn(["organization.view"]);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationAnalytics />);

    await screen.findByText("62%");
    await user.click(screen.getByRole("tab", { name: "Financials" }));

    expect(await screen.findByText("You don't have access to financial data.")).toBeInTheDocument();
    expect(mock.history.get.filter((r) => r.url?.startsWith("/admin/revenue"))).toHaveLength(0);
  });
});
