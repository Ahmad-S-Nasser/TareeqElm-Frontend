/**
 * Wave F2a — the revenue dashboard.
 *
 * `AdminRevenue` and `OrganizationRevenue` are two shells around one `RevenueDashboard` body, so this file tests the
 * body through both pages and asserts explicitly that the Admin-flavoured and Organization-flavoured renders produce
 * the same figures. `revenue.view` is an Organization default as well as an Admin one (single-tenant platform), and if
 * those two screens ever stop matching, that is the bug this file is here to catch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminRevenue from "./AdminRevenue";
import OrganizationRevenue from "./OrganizationRevenue";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }), toast: (...args: unknown[]) => toast(...args) }));

// ---------------------------------------------------------------------------
// Fixtures — the real figures GET /api/admin/revenue/* returns for the seeded database.
// ---------------------------------------------------------------------------

const SUMMARY = {
  GrossRevenue: 226.99,
  Discounts: 32.25,
  Refunds: 79.0,
  NetRevenue: 115.74,
  PlatformFees: 58.43,
  InstructorEarnings: 136.31,
  OrderCount: 6,
  PaidOrderCount: 4,
  AverageOrderValue: 48.69,
  RefundRate: 0.4057,
  Currency: "USD",
  From: "2026-09-01T00:00:00Z",
  To: "2026-10-01T00:00:00Z",
};

const EMPTY_SUMMARY = {
  ...SUMMARY,
  GrossRevenue: 0,
  Discounts: 0,
  Refunds: 0,
  NetRevenue: 0,
  PlatformFees: 0,
  InstructorEarnings: 0,
  OrderCount: 0,
  PaidOrderCount: 0,
  AverageOrderValue: 0,
  RefundRate: 0,
};

const SERIES = [
  { Bucket: "2026-09-21", Start: "2026-09-21T00:00:00Z", Gross: 0, Net: 0, Refunds: 0, Orders: 0 },
  { Bucket: "2026-09-22", Start: "2026-09-22T00:00:00Z", Gross: 147.99, Net: 56.49, Refunds: 79, Orders: 3 },
  { Bucket: "2026-09-23", Start: "2026-09-23T00:00:00Z", Gross: 79.0, Net: 59.25, Refunds: 0, Orders: 1 },
];

const TOP_ITEMS = [
  {
    ItemType: "Course",
    ItemId: "6ab466dfaa0a61b3a3f812c5",
    Title: "Cloud Architecture Essentials",
    TitleSnapshot: "Cloud Architecture Essentials",
    Units: 2,
    Gross: 158.0,
    Discounts: 19.75,
    Charged: 138.25,
  },
  {
    ItemType: "Chapter",
    ItemId: "6ab466dfaa0a61b3a3f812ca",
    // Deleted since it sold: the resolved title is null, so the snapshot of what was bought must show instead.
    Title: null,
    TitleSnapshot: "Designing for failure",
    Units: 1,
    Gross: 19.0,
    Discounts: 0,
    Charged: 19.0,
  },
];

const BY_INSTRUCTOR = [
  {
    InstructorId: "6ab086672049654d9b831001",
    InstructorName: "Instructor One",
    Units: 4,
    Gross: 226.99,
    Discounts: 32.25,
    PlatformFee: 58.43,
    InstructorNet: 136.31,
  },
  {
    InstructorId: "6ab086672049654d9b831002",
    // A deleted account resolves to null; the table must say so rather than print the id.
    InstructorName: null,
    Units: 1,
    Gross: 19.0,
    Discounts: 0,
    PlatformFee: 5.7,
    InstructorNet: 13.3,
  },
];

let mock: MockAdapter;

const seedRevenue = (overrides: { summary?: unknown; series?: unknown[]; items?: unknown[]; instructors?: unknown[] } = {}) => {
  mock.onGet("/admin/revenue/summary").reply(200, overrides.summary ?? SUMMARY);
  mock.onGet("/admin/revenue/series").reply(200, overrides.series ?? SERIES);
  mock.onGet("/admin/revenue/top-items").reply(200, overrides.items ?? TOP_ITEMS);
  mock.onGet("/admin/revenue/by-instructor").reply(200, overrides.instructors ?? BY_INSTRUCTOR);
};

/** Signs in; `permissions` decides whether the dashboard body renders at all. */
const signIn = (role: string, permissions: string[] = ["revenue.view"]) => {
  const user = makeUser({ Id: `${role}-1`, Role: role, Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  return user;
};

const lastParams = (url: string) =>
  mock.history.get.filter((r) => r.url === url).at(-1)?.params as Record<string, unknown> | undefined;

beforeEach(() => {
  toast.mockClear();
  mock = new MockAdapter(api);
  mock.onGet("/Settings").reply(200, { Currency: "USD" });
});
afterEach(() => mock.restore());

describe("AdminRevenue", () => {
  it("renders every KPI with the server's real figures", async () => {
    signIn("Admin");
    seedRevenue();
    renderWithProviders(<AdminRevenue />);

    await waitFor(() => expect(screen.getByTestId("kpi-gross")).toHaveTextContent("$226.99"));
    expect(screen.getByTestId("kpi-net")).toHaveTextContent("$115.74");
    expect(screen.getByTestId("kpi-refunds")).toHaveTextContent("$79.00");
    expect(screen.getByTestId("kpi-orders")).toHaveTextContent("6");
    expect(screen.getByTestId("kpi-aov")).toHaveTextContent("$48.69");
    // The server sends 0..1; the card must print a percentage, not "0.4057".
    expect(screen.getByTestId("kpi-refund-rate")).toHaveTextContent("40.6%");

    expect(screen.getByText("Orders paid: 4")).toBeInTheDocument();
    expect(screen.getByTestId("split-discounts")).toHaveTextContent("$32.25");
    expect(screen.getByTestId("split-platform-fees")).toHaveTextContent("$58.43");
    expect(screen.getByTestId("split-instructor-earnings")).toHaveTextContent("$136.31");
  });

  it("asks all four endpoints for the same window and bucket size", async () => {
    signIn("Admin");
    seedRevenue();
    renderWithProviders(<AdminRevenue />);
    await screen.findByTestId("kpi-gross");

    const summary = lastParams("/admin/revenue/summary")!;
    expect(summary.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(summary.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(lastParams("/admin/revenue/series")).toMatchObject({
      from: summary.from,
      to: summary.to,
      granularity: "day",
    });
    expect(lastParams("/admin/revenue/top-items")).toMatchObject({ from: summary.from, to: summary.to, limit: 10 });
    expect(lastParams("/admin/revenue/by-instructor")).toMatchObject({ from: summary.from, to: summary.to, limit: 10 });
  });

  it("changing the date range re-queries every endpoint with the new window", async () => {
    signIn("Admin");
    seedRevenue();
    renderWithProviders(<AdminRevenue />);
    await screen.findByTestId("kpi-gross");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-31" } });

    await waitFor(() =>
      expect(lastParams("/admin/revenue/summary")).toMatchObject({ from: "2026-01-01", to: "2026-03-31" })
    );
    expect(lastParams("/admin/revenue/series")).toMatchObject({ from: "2026-01-01", to: "2026-03-31" });
    expect(lastParams("/admin/revenue/top-items")).toMatchObject({ from: "2026-01-01", to: "2026-03-31" });
    expect(lastParams("/admin/revenue/by-instructor")).toMatchObject({ from: "2026-01-01", to: "2026-03-31" });
    // Editing a date leaves the preset select on "Custom range" rather than silently disagreeing with the inputs.
    expect(screen.getByRole("combobox", { name: "Date range" })).toHaveTextContent("Custom range");
  });

  it("refuses to query a backwards window and says why instead of erroring", async () => {
    signIn("Admin");
    seedRevenue();
    renderWithProviders(<AdminRevenue />);
    await screen.findByTestId("kpi-gross");
    const before = mock.history.get.filter((r) => r.url === "/admin/revenue/summary").length;

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-01" } });

    expect(await screen.findByText("Pick a start date that comes before the end date.")).toBeInTheDocument();
    expect(mock.history.get.filter((r) => r.url === "/admin/revenue/summary")).toHaveLength(before);
  });

  it("the currency filter is sent to the server and never mixes currencies", async () => {
    signIn("Admin");
    seedRevenue({ summary: { ...SUMMARY, Currency: "EUR" } });
    const user = userEvent.setup();
    renderWithProviders(<AdminRevenue />);
    await screen.findByTestId("kpi-gross");

    // The default asks for nothing and lets the server resolve the platform currency.
    expect(lastParams("/admin/revenue/summary")?.currency).toBeUndefined();

    await user.click(screen.getByRole("combobox", { name: "Currency" }));
    await user.click(await screen.findByRole("option", { name: "EUR" }));

    await waitFor(() => expect(lastParams("/admin/revenue/summary")).toMatchObject({ currency: "EUR" }));
    // Every amount then follows the currency the summary came back in.
    expect(await screen.findByTestId("kpi-gross")).toHaveTextContent("€226.99");
  });

  it("changing the granularity re-buckets the series", async () => {
    signIn("Admin");
    seedRevenue();
    const user = userEvent.setup();
    renderWithProviders(<AdminRevenue />);
    await screen.findByTestId("kpi-gross");

    await user.click(screen.getByRole("combobox", { name: "Group by" }));
    await user.click(await screen.findByRole("option", { name: "Month" }));

    await waitFor(() => expect(lastParams("/admin/revenue/series")).toMatchObject({ granularity: "month" }));
  });

  it("renders the over-time chart with its three series", async () => {
    signIn("Admin");
    seedRevenue();
    renderWithProviders(<AdminRevenue />);

    const chart = await screen.findByTestId("revenue-chart");
    expect(chart).toHaveAttribute("aria-label", "Revenue over time");
    expect(within(chart).getByText("Gross")).toBeInTheDocument();
    expect(within(chart).getByText("Net")).toBeInTheDocument();
    expect(within(chart).getByText("Refunds")).toBeInTheDocument();
  });

  it("lists best sellers and instructors by resolved name, never by id", async () => {
    signIn("Admin");
    seedRevenue();
    renderWithProviders(<AdminRevenue />);

    expect(await screen.findByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByText("$138.25")).toBeInTheDocument();
    // Deleted item: the snapshot of what was bought stands in for the missing resolved title.
    expect(screen.getByText("Designing for failure")).toBeInTheDocument();

    expect(screen.getByText("Instructor One")).toBeInTheDocument();
    // $136.31 is both the platform-wide instructor share and this one instructor's net.
    expect(screen.getAllByText("$136.31")).toHaveLength(2);
    // Deleted account: named as such, with no id anywhere on the screen.
    expect(screen.getByText("Deleted account")).toBeInTheDocument();
    expect(screen.queryByText(/6ab086672049654d9b8310/)).not.toBeInTheDocument();
    expect(screen.queryByText(/6ab466dfaa0a61b3a3f812/)).not.toBeInTheDocument();
  });

  it.each([
    ["Orders", "orders"],
    ["Items", "items"],
    ["Instructors", "instructors"],
  ])("the %s export button downloads that CSV kind", async (label, kind) => {
    signIn("Admin");
    seedRevenue();
    // jsdom has neither of these two statics.
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    (URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectURL }).revokeObjectURL = revokeObjectURL;
    mock.onGet("/admin/revenue/export").reply(200, new Blob(["ItemType,Units\nCourse,2"]), {
      "content-disposition": `attachment; filename="revenue-${kind}-20260924.csv"`,
    });

    const realCreateElement = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === "a") {
        el.click = vi.fn();
        anchor = el as HTMLAnchorElement;
      }
      return el;
    });

    const user = userEvent.setup();
    renderWithProviders(<AdminRevenue />);
    await screen.findByTestId("kpi-gross");
    await user.click(screen.getByRole("button", { name: label }));

    await waitFor(() => expect(lastParams("/admin/revenue/export")).toMatchObject({ kind }));
    // The window on the export is the one the dashboard is showing, not a fresh "everything".
    expect(lastParams("/admin/revenue/export")?.from).toBe(lastParams("/admin/revenue/summary")?.from);
    expect(anchor?.download).toBe(`revenue-${kind}-20260924.csv`);
    expect(createObjectURL).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Your CSV is downloading." }));

    createElementSpy.mockRestore();
  });

  it("an empty window shows zeros and empty states, not an error", async () => {
    signIn("Admin");
    seedRevenue({ summary: EMPTY_SUMMARY, series: [], items: [], instructors: [] });
    renderWithProviders(<AdminRevenue />);

    await waitFor(() => expect(screen.getByTestId("kpi-gross")).toHaveTextContent("$0.00"));
    expect(screen.getByTestId("kpi-net")).toHaveTextContent("$0.00");
    expect(screen.getByTestId("kpi-refunds")).toHaveTextContent("$0.00");
    expect(screen.getByTestId("kpi-orders")).toHaveTextContent("0");
    expect(screen.getByTestId("kpi-refund-rate")).toHaveTextContent("0%");

    expect(screen.getByTestId("revenue-chart-empty")).toBeInTheDocument();
    // Two tables plus the chart all say the same thing; none of them shouts.
    expect(screen.getAllByText("Nothing was sold in this period.")).toHaveLength(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces a server 403 instead of rendering half a dashboard", async () => {
    signIn("Admin");
    seedRevenue();
    mock.onGet("/admin/revenue/summary").reply(403, { code: "forbidden" });
    renderWithProviders(<AdminRevenue />);

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to do that.");
  });

  it("shows the server's own message when the figures fail to load", async () => {
    signIn("Admin");
    seedRevenue();
    mock.onGet("/admin/revenue/summary").reply(400, {
      code: "revenue.invalid_range",
      title: "Use a valid date range with the end after the start.",
    });
    renderWithProviders(<AdminRevenue />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Use a valid date range with the end after the start.");
  });

  it.each(["Trainer", "Instructor"])("hides the whole dashboard from a %s without revenue.view", async (role) => {
    signIn(role, []);
    seedRevenue();
    renderWithProviders(<AdminRevenue />);

    expect(await screen.findByText("You do not have permission to see revenue figures.")).toBeInTheDocument();
    expect(screen.queryByTestId("kpi-gross")).not.toBeInTheDocument();
    // Nothing is even asked for — the guard is not a cosmetic overlay on a loaded page.
    expect(mock.history.get.filter((r) => r.url?.startsWith("/admin/revenue"))).toHaveLength(0);
  });
});

describe("OrganizationRevenue", () => {
  it("renders the same shared body under the Organization shell", async () => {
    signIn("Organization");
    seedRevenue();
    renderWithProviders(<OrganizationRevenue />);

    await waitFor(() => expect(screen.getByTestId("kpi-gross")).toHaveTextContent("$226.99"));
    expect(screen.getByTestId("kpi-refund-rate")).toHaveTextContent("40.6%");
    expect(screen.getByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByText("Instructor One")).toBeInTheDocument();
    expect(screen.getByTestId("revenue-chart")).toBeInTheDocument();
  });

  it("hides the dashboard from an Organization account that lacks revenue.view", async () => {
    signIn("Organization", []);
    seedRevenue();
    renderWithProviders(<OrganizationRevenue />);

    expect(await screen.findByText("You do not have permission to see revenue figures.")).toBeInTheDocument();
    expect(screen.queryByTestId("kpi-gross")).not.toBeInTheDocument();
  });

  it("produces exactly the same figures as the Admin render", async () => {
    const kpis = ["kpi-gross", "kpi-net", "kpi-refunds", "kpi-orders", "kpi-aov", "kpi-refund-rate"] as const;
    const read = () => kpis.map((id) => screen.getByTestId(id).textContent);

    signIn("Admin");
    seedRevenue();
    renderWithProviders(<AdminRevenue />);
    await waitFor(() => expect(screen.getByTestId("kpi-gross")).toHaveTextContent("$226.99"));
    const admin = read();
    cleanup();

    signIn("Organization");
    renderWithProviders(<OrganizationRevenue />);
    await waitFor(() => expect(screen.getByTestId("kpi-gross")).toHaveTextContent("$226.99"));
    const organization = read();

    expect(organization).toEqual(admin);
    expect(admin).toEqual(["$226.99", "$115.74", "$79.00", "6", "$48.69", "40.6%"]);
  });
});
