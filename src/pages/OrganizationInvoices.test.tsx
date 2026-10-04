import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationInvoices from "./OrganizationInvoices";
import { LocationProbe, makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const invoice = (overrides: Record<string, unknown> = {}) => ({
  Id: "inv1",
  InvoiceNumber: "INV-2026-000001",
  IssuedAt: "2026-09-20T10:00:00Z",
  BuyerNameSnapshot: "Trainer Two",
  Currency: "USD",
  Total: 59.25,
  Status: "Issued",
  ...overrides,
});

let mock: MockAdapter;

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "org-1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

const lastListCall = () => mock.history.get.filter((r) => r.url === "/organization/invoices").pop();

beforeEach(() => {
  mock = new MockAdapter(api);
  signIn(["invoices.view"]);
});
afterEach(() => mock.restore());

describe("OrganizationInvoices", () => {
  it("lists invoices with number, buyer, total and status", async () => {
    mock.onGet("/organization/invoices").reply(200, [invoice()], { "x-total-count": "1" });
    renderWithProviders(<OrganizationInvoices />);

    expect(await screen.findByText("INV-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Trainer Two")).toBeInTheDocument();
    expect(screen.getByText("$59.25")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-status-badge")).toHaveTextContent("Issued");
    // One page only: no pagination footer.
    expect(screen.queryByTestId("invoices-pagination")).not.toBeInTheDocument();
  });

  it("shows a refunded amount under the total when the order was refunded", async () => {
    mock.onGet("/organization/invoices").reply(
      200,
      [invoice({ RefundedAmount: 25, OrderStatus: "PartiallyRefunded" })],
      { "x-total-count": "1" }
    );
    renderWithProviders(<OrganizationInvoices />);

    expect(await screen.findByTestId("invoice-refunded-inv1")).toHaveTextContent("-$25.00 refunded");
  });

  it("shows no refund indicator when the order was never refunded", async () => {
    mock.onGet("/organization/invoices").reply(200, [invoice({ RefundedAmount: 0 })], { "x-total-count": "1" });
    renderWithProviders(<OrganizationInvoices />);

    await screen.findByText("INV-2026-000001");
    expect(screen.queryByTestId("invoice-refunded-inv1")).not.toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mock.onGet("/organization/invoices").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<OrganizationInvoices />);

    expect(await screen.findByTestId("invoices-empty")).toHaveTextContent("No invoices match these filters.");
  });

  it("shows the error state when the list fails", async () => {
    mock.onGet("/organization/invoices").reply(500);
    renderWithProviders(<OrganizationInvoices />);

    expect(await screen.findByTestId("invoices-error")).toBeInTheDocument();
  });

  it("re-queries with the status filter", async () => {
    mock.onGet("/organization/invoices").reply(200, [invoice()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationInvoices />);
    await screen.findByText("INV-2026-000001");

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Voided" }));

    await waitFor(() => expect(lastListCall()?.params?.status).toBe("Voided"));
  });

  it("re-queries with the debounced search and the date range", async () => {
    mock.onGet("/organization/invoices").reply(200, [invoice()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationInvoices />);
    await screen.findByText("INV-2026-000001");

    await user.type(screen.getByRole("textbox", { name: "Search" }), "INV-2026");
    await waitFor(() => expect(lastListCall()?.params?.search).toBe("INV-2026"));

    await user.type(screen.getByLabelText("From"), "2026-09-01");
    await waitFor(() => expect(lastListCall()?.params?.from).toBe("2026-09-01"));
  });

  it("pages through results when there is more than one page", async () => {
    mock.onGet("/organization/invoices").reply(200, [invoice()], { "x-total-count": "45" });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationInvoices />);

    expect(await screen.findByTestId("invoices-pagination")).toHaveTextContent("Page 1 of 3 · 45 invoices");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastListCall()?.params?.page).toBe(2), { timeout: 5000 });
  });

  it("opens the invoice document when a row is clicked", async () => {
    mock.onGet("/organization/invoices").reply(200, [invoice()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OrganizationInvoices />
        <LocationProbe />
      </>,
      { initialEntries: ["/organization/invoices"] }
    );

    await user.click(await screen.findByTestId("invoice-row-inv1"));
    expect(screen.getByTestId("location")).toHaveTextContent("/organization/invoices/inv1");
  });

  it("shows a no-access message without invoices.view and does not query", async () => {
    mock.reset();
    signIn([]);
    renderWithProviders(<OrganizationInvoices />);

    expect(await screen.findByTestId("invoices-no-access")).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === "/organization/invoices")).toBe(false);
  });
});
