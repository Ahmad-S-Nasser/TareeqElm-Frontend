import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import InvoiceDocument from "./InvoiceDocument";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const invoice = (overrides: Record<string, unknown> = {}) => ({
  Id: "inv1",
  OrganizationId: "org1",
  OrderId: "order-1",
  InvoiceNumber: "INV-2026-000001",
  IssuedAt: "2026-09-20T10:00:00Z",
  BuyerId: "u1",
  BuyerNameSnapshot: "Trainer Two",
  BuyerBillingSnapshot: "12 Nile St, Cairo",
  SellerLegalNameSnapshot: "Acme Training LLC",
  SellerAddressSnapshot: "1 Tahrir Sq, Cairo",
  SellerTaxIdSnapshot: "TX-998877",
  Currency: "USD",
  LineItems: [
    { TitleSnapshot: "Cloud Architecture Essentials", UnitAmount: 79, DiscountAmount: 19.75, LineTotal: 59.25 },
    { TitleSnapshot: "Data Engineering Track", UnitAmount: 40, DiscountAmount: 0, LineTotal: 40 },
  ],
  Subtotal: 119,
  DiscountAmount: 19.75,
  TaxRatePercentSnapshot: 14,
  TaxAmount: 13.9,
  Total: 113.15,
  Status: "Issued",
  CreatedAt: "2026-09-20T10:00:00Z",
  OrganizationName: "Acme Academy",
  OrganizationLogoUrl: "https://cdn.example.com/logo.png",
  BuyerName: "Trainer Two",
  ...overrides,
});

let mock: MockAdapter;

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "org-user", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

beforeEach(() => {
  mock = new MockAdapter(api);
  signIn(["invoices.view"]);
});
afterEach(() => mock.restore());

const render = () =>
  renderWithProviders(
    <Routes>
      <Route path="/organization/invoices/:invoiceId" element={<InvoiceDocument />} />
    </Routes>,
    { initialEntries: ["/organization/invoices/inv1"] }
  );

describe("InvoiceDocument", () => {
  it("renders the letterhead, buyer, line items and totals", async () => {
    mock.onGet("/organization/invoices/inv1").reply(200, invoice());
    render();

    expect(await screen.findByTestId("invoice-org-name")).toHaveTextContent("Acme Academy");
    expect(screen.getByText("Acme Training LLC")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-seller-address")).toHaveTextContent("1 Tahrir Sq, Cairo");
    expect(screen.getByTestId("invoice-seller-tax-id")).toHaveTextContent("TX-998877");
    expect(screen.getByTestId("invoice-logo")).toHaveAttribute("src", "https://cdn.example.com/logo.png");
    expect(screen.getByTestId("invoice-number")).toHaveTextContent("INV-2026-000001");
    expect(screen.getByTestId("invoice-issued-at")).toHaveTextContent("2026");

    expect(screen.getByTestId("invoice-bill-to")).toHaveTextContent("Trainer Two");
    expect(screen.getByTestId("invoice-buyer-billing")).toHaveTextContent("12 Nile St, Cairo");

    expect(screen.getByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByText("Data Engineering Track")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-subtotal")).toHaveTextContent("$119.00");
    expect(screen.getByTestId("invoice-discount")).toHaveTextContent("-$19.75");
    expect(screen.getByTestId("invoice-total")).toHaveTextContent("$113.15");
  });

  it("shows the tax line with its rate when the invoice carried one", async () => {
    mock.onGet("/organization/invoices/inv1").reply(200, invoice());
    render();

    const tax = await screen.findByTestId("invoice-tax");
    expect(tax).toHaveTextContent("Tax (14%)");
    expect(tax).toHaveTextContent("$13.90");
  });

  it("prints no tax line when TaxRatePercentSnapshot is null", async () => {
    mock.onGet("/organization/invoices/inv1").reply(200, invoice({ TaxRatePercentSnapshot: null, TaxAmount: 0, Total: 99.25 }));
    render();

    expect(await screen.findByTestId("invoice-total")).toHaveTextContent("$99.25");
    expect(screen.queryByTestId("invoice-tax")).not.toBeInTheDocument();
  });

  it("omits optional seller and buyer details that are absent", async () => {
    mock.onGet("/organization/invoices/inv1").reply(
      200,
      invoice({
        SellerAddressSnapshot: null,
        SellerTaxIdSnapshot: null,
        BuyerBillingSnapshot: null,
        OrganizationName: null,
        OrganizationLogoUrl: null,
      })
    );
    render();

    // Without an organization name the legal name heads the letterhead.
    expect(await screen.findByTestId("invoice-org-name")).toHaveTextContent("Acme Training LLC");
    expect(screen.queryByTestId("invoice-seller-address")).not.toBeInTheDocument();
    expect(screen.queryByTestId("invoice-seller-tax-id")).not.toBeInTheDocument();
    expect(screen.queryByTestId("invoice-buyer-billing")).not.toBeInTheDocument();
    expect(screen.queryByTestId("invoice-logo")).not.toBeInTheDocument();
  });

  it("shows the refunded amount, an adjusted amount due, and an order-status badge when the order was partially refunded", async () => {
    mock.onGet("/organization/invoices/inv1").reply(200, invoice({ RefundedAmount: 25, OrderStatus: "PartiallyRefunded" }));
    render();

    expect(await screen.findByTestId("invoice-refunded")).toHaveTextContent("-$25.00");
    expect(screen.getByTestId("invoice-balance")).toHaveTextContent("$88.15");
    expect(screen.getByTestId("invoice-refund-badge")).toHaveTextContent("Partially refunded");
    // The invoice's own historical total is never rewritten by the refund.
    expect(screen.getByTestId("invoice-total")).toHaveTextContent("$113.15");
  });

  it("shows no refund line or badge when the order was never refunded", async () => {
    mock.onGet("/organization/invoices/inv1").reply(200, invoice({ RefundedAmount: 0, OrderStatus: "Paid" }));
    render();

    await screen.findByTestId("invoice-total");
    expect(screen.queryByTestId("invoice-refunded")).not.toBeInTheDocument();
    expect(screen.queryByTestId("invoice-balance")).not.toBeInTheDocument();
    expect(screen.queryByTestId("invoice-refund-badge")).not.toBeInTheDocument();
  });

  it("prints through window.print", async () => {
    mock.onGet("/organization/invoices/inv1").reply(200, invoice());
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByTestId("invoice-print"));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it("shows an error when the invoice cannot be loaded", async () => {
    mock.onGet("/organization/invoices/inv1").reply(404);
    render();

    expect(await screen.findByTestId("invoice-error")).toBeInTheDocument();
  });

  it("shows a no-access message without invoices.view", async () => {
    mock.reset();
    signIn([]);
    render();

    expect(await screen.findByTestId("invoice-no-access")).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === "/organization/invoices/inv1")).toBe(false);
  });
});
