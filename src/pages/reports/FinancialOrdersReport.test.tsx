/**
 * Financial/Orders report: nothing is requested until "Generate report"; then GET /organization/invoices/report with the
 * applied filters renders the summary totals and the invoice rows. Gated on invoices.view.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import FinancialOrdersReport from "./FinancialOrdersReport";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }), toast: (...args: unknown[]) => toast(...args) }));

const REPORT = {
  Items: {
    Items: [
      { Id: "i1", InvoiceNumber: "INV-ACME-2026-0001", IssuedAt: "2026-03-05T09:00:00Z", BuyerNameSnapshot: "Layla Hassan", Currency: "USD", Total: 110, TaxAmount: 10, Status: "Issued", OrderId: "o1" },
      { Id: "i2", InvoiceNumber: "INV-ACME-2026-0002", IssuedAt: "2026-03-06T09:00:00Z", BuyerNameSnapshot: "Omar Adel", Currency: "USD", Total: 55, TaxAmount: 5, Status: "Issued", OrderId: "o2" },
    ],
    Total: 2,
  },
  TotalAmount: 165,
  TotalTax: 15,
  TotalRefunded: 0,
  Count: 2,
  Currency: "USD",
};

let mock: MockAdapter;
beforeEach(() => {
  toast.mockClear();
  mock = new MockAdapter(api);
  mock.onGet("/Courses").reply(200, [{ Id: "c1", Title: "Intro to Accounting" }]);
});
afterEach(() => mock.restore());

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "u1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

const reportCalls = () => mock.history.get.filter((r) => r.url === "/organization/invoices/report");

describe("FinancialOrdersReport", () => {
  it("requests nothing until Generate, then shows totals and rows for the applied filters", async () => {
    signIn(["organization.view", "invoices.view"]);
    mock.onGet("/organization/invoices/report").reply(200, REPORT);
    const user = userEvent.setup();
    renderWithProviders(<FinancialOrdersReport />);

    expect(await screen.findByTestId("report-prompt")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search"), "Layla");
    await user.type(screen.getByLabelText("From"), "2026-03-01");
    expect(reportCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Generate report" }));

    expect(await screen.findByTestId("invoice-row-i1")).toHaveTextContent("INV-ACME-2026-0001");
    expect(screen.getByTestId("invoice-row-i2")).toHaveTextContent("Omar Adel");
    expect(screen.getByTestId("financial-count")).toHaveTextContent("2");
    expect(screen.getByTestId("financial-totalAmount")).toHaveTextContent("165");
    expect(screen.getByTestId("financial-totalTax")).toHaveTextContent("15");
    expect(screen.getByTestId("financial-totalRefunded")).toHaveTextContent("$0.00");
    expect(reportCalls()).toHaveLength(1);
    expect(reportCalls()[0].params).toMatchObject({ search: "Layla", from: "2026-03-01", page: 1 });
    expect(reportCalls()[0].params.status).toBeUndefined();
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
  });

  it("does not refetch when a filter changes until Generate is clicked again", async () => {
    signIn(["invoices.view"]);
    mock.onGet("/organization/invoices/report").reply(200, REPORT);
    const user = userEvent.setup();
    renderWithProviders(<FinancialOrdersReport />);

    await user.click(await screen.findByRole("button", { name: "Generate report" }));
    await screen.findByTestId("invoice-row-i1");

    await user.type(screen.getByLabelText("Search"), "Omar");
    expect(reportCalls()).toHaveLength(1);
    expect(screen.getByTestId("invoice-row-i1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Generate again" }));
    await waitFor(() => expect(reportCalls()).toHaveLength(2));
    expect(reportCalls()[1].params).toMatchObject({ search: "Omar" });
  });

  it("shows a refunded amount under the row total and in the Total refunded summary card", async () => {
    signIn(["invoices.view"]);
    mock.onGet("/organization/invoices/report").reply(200, {
      ...REPORT,
      Items: { Items: [{ ...REPORT.Items.Items[0], RefundedAmount: 25, OrderStatus: "PartiallyRefunded" }, REPORT.Items.Items[1]], Total: 2 },
      TotalRefunded: 25,
    });
    const user = userEvent.setup();
    renderWithProviders(<FinancialOrdersReport />);

    await user.click(await screen.findByRole("button", { name: "Generate report" }));

    expect(await screen.findByTestId("financial-totalRefunded")).toHaveTextContent("$25.00");
    expect(screen.getByTestId("invoice-row-i1")).toHaveTextContent("-$25.00 refunded");
    expect(screen.getByTestId("invoice-row-i2")).not.toHaveTextContent("refunded");
  });

  it("shows the empty state when nothing matches", async () => {
    signIn(["invoices.view"]);
    mock.onGet("/organization/invoices/report").reply(200, { Items: { Items: [], Total: 0 }, TotalAmount: 0, TotalTax: 0, Count: 0, Currency: null });
    const user = userEvent.setup();
    renderWithProviders(<FinancialOrdersReport />);

    await user.click(await screen.findByRole("button", { name: "Generate report" }));

    expect(await screen.findByTestId("report-empty")).toHaveTextContent("No invoices match these filters.");
  });

  it("is refused without invoices.view and never calls the report endpoint", async () => {
    signIn(["organization.view"]);
    renderWithProviders(<FinancialOrdersReport />);

    expect(await screen.findByTestId("report-no-access")).toHaveTextContent("You don't have access to financial reports.");
    expect(screen.queryByRole("button", { name: "Generate report" })).not.toBeInTheDocument();
    expect(reportCalls()).toHaveLength(0);
  });
});
