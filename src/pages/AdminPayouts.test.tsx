import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminPayouts from "./AdminPayouts";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const INSTRUCTOR_ID = "i1";

const instructors = [
  { Id: INSTRUCTOR_ID, FullName: "Instructor One", Email: "instructor@tareeqelm.com", IsActive: true, Role: "Instructor" },
  { Id: "i2", FullName: "Instructor Two", Email: "two@tareeqelm.com", IsActive: true, Role: "Instructor" },
];

/** Mirrors the live `GET /api/admin/payouts/eligible` answer for the seeded instructor. */
const eligible = (overrides: Record<string, unknown> = {}) => ({
  InstructorId: INSTRUCTOR_ID,
  InstructorName: "Instructor One",
  Currency: "USD",
  Amount: 55.3,
  EarningCount: 1,
  PeriodStart: "2026-09-01T00:00:00Z",
  PeriodEnd: "2026-09-30T00:00:00Z",
  CommissionRate: 0.3,
  UsesDefaultCommissionRate: true,
  Ripened: 1,
  PendingAmount: 67.71,
  PendingCount: 2,
  NextAvailableAt: "2026-10-07T23:55:11.505Z",
  OtherCurrencies: {},
  Earnings: [],
  ...overrides,
});

const payout = (overrides: Record<string, unknown> = {}) => ({
  Id: "p1",
  InstructorId: INSTRUCTOR_ID,
  InstructorName: "Instructor One",
  Currency: "USD",
  Amount: 55.3,
  Status: "Draft",
  Method: "BankTransfer",
  Reference: null,
  Notes: null,
  PeriodStart: "2026-09-01T00:00:00Z",
  PeriodEnd: "2026-09-30T00:00:00Z",
  EarningCount: 1,
  EarningIds: ["e1"],
  CreatedAt: "2026-09-24T01:16:00Z",
  CreatedBy: "admin-1",
  CreatedByName: "Admin User",
  ApprovedBy: null,
  ApprovedByName: null,
  ApprovedAt: null,
  PaidBy: null,
  PaidByName: null,
  PaidAt: null,
  CancelledBy: null,
  CancelledByName: null,
  CancelledAt: null,
  ...overrides,
});

let mock: MockAdapter;

const signIn = (permissions: string[] = ["payouts.manage"]) => {
  const user = makeUser({ Id: "admin-1", Role: "Admin", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

/** The common reads every render makes: settings, the instructor roster and each row's effective rate. */
const seedCommonReads = (eligibleFor: (instructorId: string) => Record<string, unknown> = () => eligible()) => {
  mock.onGet("/Settings").reply(200, { Currency: "USD", DefaultCommissionRate: 0.3, EarningsHoldDays: 14 });
  mock.onGet("/admin/payouts/instructors").reply(200, instructors, { "x-total-count": String(instructors.length) });
  mock.onGet("/admin/payouts/eligible").reply((config) => [
    200,
    eligibleFor(String(config.params?.instructorId ?? "")),
  ]);
};

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  signIn();
  seedCommonReads();
});
afterEach(() => mock.restore());

describe("AdminPayouts", () => {
  it("lists payouts with the instructor's resolved name, amount and status", async () => {
    mock.onGet("/admin/payouts").reply(200, [payout({ Status: "Approved" })], { "x-total-count": "1" });
    renderWithProviders(<AdminPayouts />);

    expect(await screen.findByText("$55.30")).toBeInTheDocument();
    expect(screen.getAllByText("Instructor One").length).toBeGreaterThan(0);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("shows the empty state when nothing has been paid out", async () => {
    mock.onGet("/admin/payouts").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<AdminPayouts />);
    expect(await screen.findByText("No payouts yet.")).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/admin/payouts").reply(500);
    renderWithProviders(<AdminPayouts />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("previews what is payable once an instructor is chosen", async () => {
    mock.onGet("/admin/payouts").reply(200, [], { "x-total-count": "0" });
    const user = userEvent.setup();
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("No payouts yet.");
    expect(screen.getByText("Pick an instructor to see what is payable right now.")).toBeInTheDocument();

    await user.click(screen.getAllByRole("combobox", { name: "Instructor" })[0]);
    await user.click(await screen.findByRole("option", { name: "Instructor One" }));

    expect(await screen.findByTestId("eligible-amount")).toHaveTextContent("$55.30");
    expect(screen.getByText("1 ledger row")).toBeInTheDocument();
    expect(screen.getByText("1 earnings became payable just now.")).toBeInTheDocument();
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/payouts/eligible").pop();
      expect(call?.params?.instructorId).toBe(INSTRUCTOR_ID);
    });
  });

  it("refuses to create a payout when nothing is payable", async () => {
    mock.reset();
    signIn();
    seedCommonReads(() => eligible({ Amount: 0, EarningCount: 0, Ripened: 0 }));
    mock.onGet("/admin/payouts").reply(200, [], { "x-total-count": "0" });
    const user = userEvent.setup();
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("No payouts yet.");

    await user.click(screen.getAllByRole("combobox", { name: "Instructor" })[0]);
    await user.click(await screen.findByRole("option", { name: "Instructor One" }));

    expect(await screen.findByText("There is nothing payable for this instructor right now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create payout" })).toBeDisabled();
  });

  it("walks a payout from create through approve to paid", async () => {
    let rows: Record<string, unknown>[] = [];
    mock.onGet("/admin/payouts").reply(() => [200, rows, { "x-total-count": String(rows.length) }]);
    mock.onPost("/admin/payouts").reply(() => { rows = [payout()]; return [201, payout()]; });
    mock.onPost("/admin/payouts/p1/approve").reply(() => {
      rows = [payout({ Status: "Approved", ApprovedByName: "Admin User" })];
      return [200, rows[0]];
    });
    mock.onPost("/admin/payouts/p1/mark-paid").reply(() => {
      rows = [payout({ Status: "Paid", Reference: "F2C-LIVE-001" })];
      return [200, rows[0]];
    });

    const user = userEvent.setup();
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("No payouts yet.");

    // create
    await user.click(screen.getAllByRole("combobox", { name: "Instructor" })[0]);
    await user.click(await screen.findByRole("option", { name: "Instructor One" }));
    await screen.findByTestId("eligible-amount");
    await user.click(screen.getByRole("button", { name: "Create payout" }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/admin/payouts")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      InstructorId: INSTRUCTOR_ID,
      Method: "BankTransfer",
      Currency: "USD",
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Payout created." }));
    expect(await screen.findByText("Draft")).toBeInTheDocument();

    // approve
    await user.click(screen.getByRole("button", { name: "Approve" }));
    const approveDialog = await screen.findByRole("alertdialog");
    await user.click(within(approveDialog).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/admin/payouts/p1/approve")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Payout approved." }));
    expect(await screen.findByText("Approved")).toBeInTheDocument();

    // mark paid
    await user.click(screen.getByRole("button", { name: "Mark as paid" }));
    await user.type(await screen.findByLabelText("Transfer reference"), "F2C-LIVE-001");
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Mark as paid" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/admin/payouts/p1/mark-paid")).toBe(true));
    const markPaidBody = JSON.parse(mock.history.post.find((r) => r.url === "/admin/payouts/p1/mark-paid")!.data);
    expect(markPaidBody.Reference).toBe("F2C-LIVE-001");
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Payout marked as paid." }));
    expect(await screen.findByText("Paid")).toBeInTheDocument();
  });

  it("requires a transfer reference before marking a payout paid", async () => {
    mock.onGet("/admin/payouts").reply(200, [payout({ Status: "Approved" })], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("Approved");

    await user.click(screen.getByRole("button", { name: "Mark as paid" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Mark as paid" }));

    expect(mock.history.post.filter((r) => r.url?.includes("mark-paid"))).toHaveLength(0);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "A transfer reference is required." })
    );
  });

  it("cancels a draft payout", async () => {
    mock.onGet("/admin/payouts").reply(200, [payout()], { "x-total-count": "1" });
    mock.onPost("/admin/payouts/p1/cancel").reply(200, payout({ Status: "Cancelled" }));
    const user = userEvent.setup();
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("Draft");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("alertdialog");
    // Two buttons read "Cancel" here: dismissing the dialog, and the destructive action itself (the last one).
    const dialogButtons = within(dialog).getAllByRole("button", { name: "Cancel" });
    await user.click(dialogButtons[dialogButtons.length - 1]);

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/admin/payouts/p1/cancel")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Payout cancelled." }));
  });

  it("offers no state-changing action on a paid payout", async () => {
    mock.onGet("/admin/payouts").reply(200, [payout({ Status: "Paid", Reference: "TRX-1" })], { "x-total-count": "1" });
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("Paid");

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as paid" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    // the statement stays available: a paid payout is exactly the one you want a statement for
    expect(screen.getAllByRole("button", { name: "Statement" }).length).toBe(1);
  });

  it("downloads a payout statement", async () => {
    const createObjectURL = vi.fn(() => "blob:statement");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    mock.onGet("/admin/payouts").reply(200, [payout({ Status: "Paid" })], { "x-total-count": "1" });
    mock.onGet("/admin/payouts/p1/statement").reply(200, "PayoutId,Net\np1,55.30", {
      "content-disposition": 'attachment; filename=payout-p1-20260924.csv; filename*=UTF-8\'\'payout-p1.csv',
    });
    const user = userEvent.setup();
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("Paid");

    await user.click(screen.getByRole("button", { name: "Statement" }));
    await waitFor(() => expect(mock.history.get.some((r) => r.url === "/admin/payouts/p1/statement")).toBe(true));
    expect(createObjectURL).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Statement downloaded." }));
  });

  it("shows each instructor's effective commission and where it comes from", async () => {
    mock.onGet("/admin/payouts").reply(200, [], { "x-total-count": "0" });
    mock.reset();
    signIn();
    seedCommonReads((id) =>
      id === "i2" ? eligible({ InstructorId: "i2", CommissionRate: 0.42, UsesDefaultCommissionRate: false }) : eligible()
    );
    mock.onGet("/admin/payouts").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<AdminPayouts />);

    expect(await screen.findByText("Instructor Two")).toBeInTheDocument();
    expect(await screen.findByText("42%")).toBeInTheDocument();
    expect(screen.getByText("Own rate")).toBeInTheDocument();
    expect(screen.getAllByText("Platform default").length).toBeGreaterThan(0);
  });

  it("sets and clears a commission override", async () => {
    mock.onGet("/admin/payouts").reply(200, [], { "x-total-count": "0" });
    mock.onPut(`/admin/payouts/commission/${INSTRUCTOR_ID}`).reply(204);
    const user = userEvent.setup();
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("instructor@tareeqelm.com");

    await user.click(screen.getAllByRole("button", { name: "Set commission" })[0]);
    await user.type(await screen.findByRole("spinbutton", { name: "Platform share" }), "42");
    await user.click(screen.getByRole("button", { name: "Save commission" }));

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ CommissionRate: 0.42 });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Commission updated." }));

    // clearing reverts to the platform default: a null rate, not a zero one
    await user.click(screen.getAllByRole("button", { name: "Set commission" })[0]);
    await user.click(await screen.findByRole("button", { name: "Use the platform default" }));
    await waitFor(() => expect(mock.history.put).toHaveLength(2));
    expect(JSON.parse(mock.history.put[1].data)).toEqual({ CommissionRate: null });
  });

  it("rejects a commission outside 0-100%", async () => {
    mock.onGet("/admin/payouts").reply(200, [], { "x-total-count": "0" });
    const user = userEvent.setup();
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("instructor@tareeqelm.com");

    await user.click(screen.getAllByRole("button", { name: "Set commission" })[0]);
    await user.type(await screen.findByRole("spinbutton", { name: "Platform share" }), "140");
    await user.click(screen.getByRole("button", { name: "Save commission" }));

    expect(mock.history.put).toHaveLength(0);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "Enter a share between 0% and 100%." })
    );
  });

  it("hides creation, row actions and the commission editor without payouts.manage", async () => {
    mock.reset();
    signIn([]);
    seedCommonReads();
    mock.onGet("/admin/payouts").reply(200, [payout()], { "x-total-count": "1" });
    renderWithProviders(<AdminPayouts />);
    await screen.findByText("Draft");

    expect(screen.queryByRole("button", { name: "Create payout" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set commission" })).not.toBeInTheDocument();
  });
});
