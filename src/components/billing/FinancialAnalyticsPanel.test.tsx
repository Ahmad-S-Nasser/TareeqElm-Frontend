/**
 * Phase 2 — the Analytics Financial tab's own view. These tests prove three things: the period-over-period cards diff the
 * selected window against the equal-length window just before it; the department breakdown renders the server's rows
 * (the Unassigned bucket localized, never an id); and the goal widget reads, projects and saves a target. They also
 * assert what is NOT here — the revenue dashboard's KPIs, exports and top-items/by-instructor tables — because the whole
 * point of this panel is to stop duplicating `/organization/revenue`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { FinancialAnalyticsPanel } from "./FinancialAnalyticsPanel";
import { presetRange, DEFAULT_REVENUE_PRESET } from "@/hooks/useRevenue";
import { percentChange, previousRange } from "@/hooks/useFinancialAnalytics";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }), toast: (...args: unknown[]) => toast(...args) }));

const summary = (overrides: Record<string, number>) => ({
  GrossRevenue: 0, Discounts: 0, Refunds: 0, NetRevenue: 0, PlatformFees: 0, InstructorEarnings: 0,
  OrderCount: 0, PaidOrderCount: 0, AverageOrderValue: 0, RefundRate: 0, Currency: "USD",
  From: "2026-09-01T00:00:00Z", To: "2026-10-01T00:00:00Z",
  ...overrides,
});

const CURRENT = summary({ GrossRevenue: 1200, NetRevenue: 1100, PaidOrderCount: 8, AverageOrderValue: 150 });
const PREVIOUS = summary({ GrossRevenue: 1000, NetRevenue: 1250, PaidOrderCount: 8, AverageOrderValue: 0 });

const DEPARTMENTS = [
  { DepartmentId: "d1", DepartmentName: "Engineering", Unassigned: false, Gross: 800, Discounts: 50, Charged: 750, Units: 5 },
  { DepartmentId: null, DepartmentName: null, Unassigned: true, Gross: 300, Discounts: 0, Charged: 300, Units: 2 },
  { DepartmentId: "d-gone", DepartmentName: null, Unassigned: false, Gross: 100, Discounts: 0, Charged: 100, Units: 1 },
];

const selected = presetRange(DEFAULT_REVENUE_PRESET)!;
const prior = previousRange(selected.from, selected.to);

const GOAL = {
  Id: "g1", OrganizationId: "org1", PeriodStart: `${selected.from}T00:00:00Z`, PeriodEnd: `${selected.to}T00:00:00Z`,
  TargetAmount: 5000, Currency: "USD", CreatedBy: "u1", CreatedAt: "2026-09-01T00:00:00Z", UpdatedAt: "2026-09-01T00:00:00Z",
  ActualToDate: 1100, DaysElapsed: 10, TotalDays: 30, ProjectedTotal: 3300, PercentOfTarget: 22,
};

let mock: MockAdapter;

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "u1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

const seed = ({ goal = GOAL as unknown, departments = DEPARTMENTS as unknown[] } = {}) => {
  mock.onGet("/admin/revenue/summary").reply((config) =>
    config.params?.from === prior.from ? [200, PREVIOUS] : [200, CURRENT]
  );
  mock.onGet("/admin/revenue/by-department").reply(200, departments);
  if (goal) mock.onGet("/organization/financial-goals").reply(200, goal);
  else mock.onGet("/organization/financial-goals").reply(404, { code: "not_found", title: "Not found" });
};

const summaryCalls = () => mock.history.get.filter((r) => r.url === "/admin/revenue/summary").map((r) => r.params);

beforeEach(() => {
  toast.mockClear();
  mock = new MockAdapter(api);
  mock.onGet("/Settings").reply(200, { Currency: "USD" });
});
afterEach(() => mock.restore());

describe("previousRange / percentChange", () => {
  it("is the equal-length window ending the day before", () => {
    expect(previousRange("2026-09-01", "2026-09-30")).toEqual({ from: "2026-08-02", to: "2026-08-31" });
    expect(previousRange("2026-03-01", "2026-03-01")).toEqual({ from: "2026-02-28", to: "2026-02-28" });
    // Across a year boundary and a leap day.
    expect(previousRange("2024-03-01", "2024-03-07")).toEqual({ from: "2024-02-23", to: "2024-02-29" });
    expect(previousRange("2026-01-01", "2026-01-31")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("is null when there is nothing to compare against and 0 when both are zero", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(50, -100)).toBe(150);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });
});

describe("FinancialAnalyticsPanel", () => {
  it("compares the selected window with the equal-length window before it", async () => {
    signIn(["revenue.view", "pricing.manage"]);
    seed();
    renderWithProviders(<FinancialAnalyticsPanel />);

    await waitFor(() => expect(screen.getByTestId("delta-GrossRevenue-value")).toHaveTextContent("$1,200.00"));
    expect(screen.getByTestId("delta-GrossRevenue-change")).toHaveTextContent("+20% vs previous period");
    expect(screen.getByTestId("delta-NetRevenue-change")).toHaveTextContent("−12% vs previous period");
    expect(screen.getByTestId("delta-NetRevenue")).toHaveTextContent("Previous: $1,250.00");
    expect(screen.getByTestId("delta-PaidOrderCount-change")).toHaveTextContent("0% vs previous period");
    // The previous window had no average order value at all: no fake "+∞%".
    expect(screen.getByTestId("delta-AverageOrderValue-change")).toHaveTextContent("Nothing in the previous period to compare with");

    // Exactly two summary windows were asked for: the selected one and the one before it.
    const windows = summaryCalls();
    expect(windows).toContainEqual(expect.objectContaining({ from: selected.from, to: selected.to }));
    expect(windows).toContainEqual(expect.objectContaining({ from: prior.from, to: prior.to }));
  });

  it("changing the range re-queries both windows", async () => {
    signIn(["revenue.view"]);
    seed();
    renderWithProviders(<FinancialAnalyticsPanel />);
    await screen.findByTestId("delta-GrossRevenue");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-30" } });

    await waitFor(() => expect(summaryCalls()).toContainEqual(expect.objectContaining({ from: "2026-08-02", to: "2026-08-31" })));
    expect(summaryCalls()).toContainEqual(expect.objectContaining({ from: "2026-09-01", to: "2026-09-30" }));
    expect(mock.history.get.filter((r) => r.url === "/admin/revenue/by-department").at(-1)?.params).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("lists every department with a localized Unassigned row and never prints an id", async () => {
    signIn(["revenue.view"]);
    seed();
    renderWithProviders(<FinancialAnalyticsPanel />);

    const rows = await screen.findAllByTestId("department-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Engineering");
    expect(rows[0]).toHaveTextContent("$750.00");
    expect(rows[0]).toHaveTextContent("5 sold");
    expect(rows[1]).toHaveTextContent("Unassigned");
    expect(rows[1]).toHaveTextContent("$300.00");
    expect(rows[2]).toHaveTextContent("Deleted department");
    expect(screen.queryByText(/d-gone/)).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing sold in the range", async () => {
    signIn(["revenue.view"]);
    seed({ departments: [] });
    renderWithProviders(<FinancialAnalyticsPanel />);

    expect(await screen.findByTestId("departments-empty")).toHaveTextContent("No sales in this range yet.");
  });

  it("shows the goal's progress and linear projection", async () => {
    signIn(["revenue.view", "pricing.manage"]);
    seed();
    renderWithProviders(<FinancialAnalyticsPanel />);

    const widget = await screen.findByTestId("goal-widget");
    await waitFor(() => expect(within(widget).getByTestId("goal-actual")).toHaveTextContent("$1,100.00"));
    expect(within(widget).getByTestId("goal-target")).toHaveTextContent("$5,000.00");
    expect(within(widget).getByTestId("goal-percent")).toHaveTextContent("22% of target");
    expect(within(widget).getByTestId("goal-projection")).toHaveTextContent("On pace for $3,300.00");
    expect(within(widget).getByText("Day 10 of 30")).toBeInTheDocument();
    expect(mock.history.get.find((r) => r.url === "/organization/financial-goals")?.params).toEqual({
      periodStart: selected.from,
      periodEnd: selected.to,
    });
  });

  it("sets a target for the selected period when none exists yet", async () => {
    signIn(["revenue.view", "pricing.manage"]);
    seed({ goal: null });
    mock.onPut("/organization/financial-goals").reply(200, { ...GOAL, TargetAmount: 4000, PercentOfTarget: 27.5 });
    const user = userEvent.setup();
    renderWithProviders(<FinancialAnalyticsPanel />);

    expect(await screen.findByTestId("goal-none")).toHaveTextContent("No target set for this period yet.");
    await user.click(screen.getByRole("button", { name: "Set target" }));

    // A zero target is refused on the client before any request is made.
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a target greater than zero.")).toBeInTheDocument();
    expect(mock.history.put).toHaveLength(0);

    await user.type(screen.getByLabelText("Target amount"), "4000");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ periodStart: selected.from, periodEnd: selected.to, targetAmount: 4000 });
    await waitFor(() => expect(screen.getByTestId("goal-target")).toHaveTextContent("$4,000.00"));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Revenue target saved" }));
  });

  it("hides the goal widget (and never calls its endpoint) without pricing.manage", async () => {
    signIn(["revenue.view"]);
    seed();
    renderWithProviders(<FinancialAnalyticsPanel />);

    await screen.findAllByTestId("department-row");
    expect(screen.queryByTestId("goal-widget")).not.toBeInTheDocument();
    expect(mock.history.get.filter((r) => r.url === "/organization/financial-goals")).toHaveLength(0);
  });

  it("is a different view from the revenue dashboard: no KPIs, exports, series or top-items/instructor tables", async () => {
    signIn(["revenue.view", "pricing.manage"]);
    seed();
    renderWithProviders(<FinancialAnalyticsPanel />);
    await screen.findAllByTestId("department-row");

    for (const id of ["kpi-gross", "kpi-net", "kpi-refunds", "kpi-orders", "kpi-aov", "kpi-refund-rate", "split-discounts", "split-platform-fees", "split-instructor-earnings"])
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    expect(screen.queryByText("Export")).not.toBeInTheDocument();
    for (const name of [/orders/i, /items/i, /instructors/i])
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    for (const url of ["/admin/revenue/series", "/admin/revenue/top-items", "/admin/revenue/by-instructor", "/admin/revenue/export"])
      expect(mock.history.get.filter((r) => r.url === url)).toHaveLength(0);
  });
});
