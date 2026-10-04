import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import InstructorEarnings from "./InstructorEarnings";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/InstructorSidebar", () => ({
  InstructorSidebar: () => null,
  InstructorSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const summary = {
  Pending: 81.01,
  Available: 12.5,
  Paid: 300,
  Reversed: -55.3,
  LifetimeGross: 115.74,
  LifetimeNet: 81.01,
  Currency: "USD",
  CommissionRate: 0.3,
};

const earning = (overrides: Record<string, unknown> = {}) => ({
  Id: "e1",
  OrderId: "6ab46bb3aa0a61b3a3f81303",
  OrderLineId: "fccdc42fc92442928209a9e845bc6538",
  ItemType: "Course",
  ItemId: "c1",
  Title: "Cloud Architecture Essentials",
  ResolvedTitle: "Cloud Architecture Essentials",
  CourseId: "c1",
  CourseTitle: "Cloud Architecture Essentials",
  BuyerCount: 1,
  Currency: "USD",
  GrossAmount: 59.25,
  CommissionRate: 0.3,
  PlatformFeeAmount: 17.78,
  NetAmount: 41.47,
  Kind: "Sale",
  Status: "Pending",
  ReversalOfEarningId: null,
  AvailableAt: "2026-10-08T00:16:12.49Z",
  OccurredAt: "2026-09-24T00:16:12.49Z",
  PayoutId: null,
  ...overrides,
});

const payout = {
  Id: "p1",
  Currency: "USD",
  Amount: 300,
  EarningCount: 3,
  PeriodStart: "2026-08-01T00:00:00Z",
  PeriodEnd: "2026-08-31T00:00:00Z",
  Status: "Paid",
  Method: "BankTransfer",
  Reference: "TRX-9",
  Notes: null,
  CreatedAt: "2026-09-01T00:00:00Z",
  ApprovedAt: "2026-09-01T12:00:00Z",
  PaidAt: "2026-09-02T00:00:00Z",
  CancelledAt: null,
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "ins-1", Role: "Instructor", Permissions: ["earnings.self"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Settings").reply(200, { Currency: "USD" });
  mock.onGet("/instructor/earnings/summary").reply(200, summary);
  mock.onGet("/instructor/earnings").reply(200, [earning()], { "x-total-count": "1" });
  mock.onGet("/instructor/payouts").reply(200, [payout], { "x-total-count": "1" });
});
afterEach(() => mock.restore());

describe("InstructorEarnings", () => {
  it("renders the four balances, the lifetime figures and the effective commission rate", async () => {
    renderWithProviders(<InstructorEarnings />);

    const balances = within(await screen.findByRole("region", { name: "Balances" }));
    expect(balances.getAllByText("$81.01").length).toBeGreaterThan(0); // Pending, and again as LifetimeNet
    expect(balances.getByText("$12.50")).toBeInTheDocument(); // Available
    expect(balances.getByText("$300.00")).toBeInTheDocument(); // Paid
    expect(balances.getByText("$115.74")).toBeInTheDocument(); // LifetimeGross
    expect(screen.getByTestId("commission-rate")).toHaveTextContent("30%");
    expect(screen.getByText("Your share: 70%")).toBeInTheDocument();
  });

  it("lists the ledger with resolved item and course titles, never a raw id", async () => {
    mock.onGet("/instructor/earnings").reply(
      200,
      [earning({ Id: "e2", ItemType: "Chapter", ItemId: "ch2", Title: "Designing for failure", ResolvedTitle: "Designing for failure" })],
      { "x-total-count": "1" }
    );
    renderWithProviders(<InstructorEarnings />);

    expect(await screen.findByText("Designing for failure")).toBeInTheDocument();
    expect(screen.getByText(/in Cloud Architecture Essentials/)).toBeInTheDocument();
    // The order id is a server-side reference only; it is never printed on this page.
    expect(screen.queryByText(/6ab46bb3aa0a61b3a3f81303/)).not.toBeInTheDocument();
  });

  it("keeps a reversal row negative", async () => {
    mock
      .onGet("/instructor/earnings")
      .reply(200, [earning({ Id: "e3", Kind: "Reversal", Status: "Reversed", NetAmount: -55.3, BuyerCount: -1 })], {
        "x-total-count": "1",
      });
    renderWithProviders(<InstructorEarnings />);

    const ledger = within(await screen.findByRole("region", { name: "Earnings ledger" }));
    expect(await ledger.findByText("-$55.30")).toBeInTheDocument();
    expect(ledger.getByText("Refund reversal")).toBeInTheDocument();
  });

  it("never renders anything that identifies a buyer", async () => {
    // The API response is deliberately polluted with buyer-shaped fields: even if a future backend leaked them, this
    // page must not surface them. The privacy rule is "what sold", never "who bought it".
    mock.onGet("/instructor/earnings").reply(
      200,
      [
        {
          ...earning(),
          BuyerId: "trainer-9",
          BuyerName: "Sara Buyer",
          BuyerEmail: "sara.buyer@example.com",
          UserId: "trainer-9",
        },
      ],
      { "x-total-count": "1" }
    );
    const { container } = renderWithProviders(<InstructorEarnings />);
    await screen.findByText("Cloud Architecture Essentials");

    const rendered = container.textContent ?? "";
    for (const secret of ["Sara Buyer", "sara.buyer@example.com", "trainer-9", "@example.com"]) {
      expect(rendered).not.toContain(secret);
    }
    // ...and there is no buyer column at all.
    expect(screen.queryByText(/buyer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /buyer|email|trainer|trainee/i })).not.toBeInTheDocument();
  });

  it("has no pricing control anywhere on the page", async () => {
    renderWithProviders(<InstructorEarnings />);
    await screen.findByText("Cloud Architecture Essentials");

    expect(screen.queryByTestId("money-input")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /price/i })).not.toBeInTheDocument();
  });

  it("re-queries the ledger with the chosen status filter", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InstructorEarnings />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Payable" }));

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/instructor/earnings").pop();
      expect(call?.params?.status).toBe("Available");
    });
  });

  it("lists the instructor's own payouts", async () => {
    renderWithProviders(<InstructorEarnings />);

    expect(await screen.findByText("TRX-9")).toBeInTheDocument();
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
  });

  it("shows the empty states when there is nothing yet", async () => {
    mock.onGet("/instructor/earnings").reply(200, [], { "x-total-count": "0" });
    mock.onGet("/instructor/payouts").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<InstructorEarnings />);

    expect(await screen.findByText("You have not earned anything yet.")).toBeInTheDocument();
    expect(await screen.findByText("You have not been paid out yet.")).toBeInTheDocument();
  });

  it("shows an error state when the ledger fails to load", async () => {
    mock.onGet("/instructor/earnings").reply(500);
    renderWithProviders(<InstructorEarnings />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("shows an error state when the summary fails to load", async () => {
    mock.onGet("/instructor/earnings/summary").reply(500);
    renderWithProviders(<InstructorEarnings />);
    await waitFor(() => expect(screen.getAllByText(/server ran into a problem/i).length).toBeGreaterThan(0));
    expect(screen.queryByTestId("commission-rate")).not.toBeInTheDocument();
  });
});
