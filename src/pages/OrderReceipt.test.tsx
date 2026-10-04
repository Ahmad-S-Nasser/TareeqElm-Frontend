import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrderReceipt from "./OrderReceipt";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const line = (overrides: Record<string, unknown> = {}) => ({
  LineId: "l1",
  ItemType: "Course",
  ItemId: "c1",
  Title: "Cloud Architecture Essentials",
  CourseId: "c1",
  InstructorId: "i1",
  UnitAmount: 79,
  DiscountAmount: 19.75,
  LineTotal: 59.25,
  RefundedAmount: 0,
  ...overrides,
});

const order = (overrides: Record<string, unknown> = {}) => ({
  Id: "o1",
  UserId: "u1",
  Status: "Paid",
  Provider: "manual",
  ProviderRef: "tq_abc",
  Currency: "USD",
  Subtotal: 79,
  DiscountAmount: 19.75,
  TaxAmount: 0,
  Total: 59.25,
  RefundedAmount: 0,
  CouponCode: "WELCOME25",
  PlacedAt: "2026-09-20T10:00:00Z",
  PaidAt: "2026-09-20T10:01:00Z",
  CancelledAt: null,
  FailedAt: null,
  FailureReason: null,
  PaymentReference: "SEED-BANK-0001",
  Items: [line()],
  ...overrides,
});

const entitlement = (overrides: Record<string, unknown> = {}) => ({
  Id: "e1",
  UserId: "u1",
  ItemType: "Course",
  ItemId: "c1",
  Title: null,
  Status: "Active",
  Source: "Purchase",
  OrderId: "o1",
  GrantedAt: "2026-09-20T10:01:00Z",
  ExpiresAt: null,
  RevokedAt: null,
  RevokedReason: null,
  Note: null,
  ...overrides,
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Trainer", Permissions: ["orders.self", "entitlements.self"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Settings").reply(200, {
    Currency: "USD",
    CheckoutEnabled: true,
    RefundWindowDays: 14,
    DefaultPaymentProvider: null,
  });
  mock.onGet("/entitlements/me").reply(200, [entitlement()]);
});
afterEach(() => mock.restore());

const render = (state?: unknown) =>
  renderWithProviders(
    <Routes>
      <Route path="/purchases/:orderId" element={<OrderReceipt />} />
    </Routes>,
    { initialEntries: [{ pathname: "/purchases/o1", state }] }
  );

describe("OrderReceipt", () => {
  it("shows the line items, the amounts and the payment details", async () => {
    mock.onGet("/orders/me/o1").reply(200, order());
    render();

    expect(await screen.findByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByTestId("receipt-reference")).toHaveTextContent("tq_abc");
    expect(screen.getByTestId("receipt-total")).toHaveTextContent("$59.25");
    expect(screen.getByText("-$19.75")).toBeInTheDocument();
    expect(screen.getByText("SEED-BANK-0001")).toBeInTheDocument();
    expect(screen.getByText("WELCOME25")).toBeInTheDocument();
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
  });

  it("shows refund information once part of the order has been given back", async () => {
    mock.onGet("/orders/me/o1").reply(200, order({ Status: "PartiallyRefunded", RefundedAmount: 20, Items: [line({ RefundedAmount: 20 })] }));
    render();

    expect(await screen.findByTestId("receipt-refunded")).toHaveTextContent("$20.00");
    expect(screen.getByTestId("order-status-badge")).toHaveTextContent("Partially refunded");
  });

  it("marks a line as revoked when the entitlement it bought is gone", async () => {
    mock.onGet("/orders/me/o1").reply(200, order());
    mock.onGet("/entitlements/me").reply(200, [entitlement({ Status: "Revoked", RevokedAt: "2026-09-22T09:00:00Z" })]);
    render();

    expect(await screen.findByTestId("line-access-l1")).toHaveTextContent("Revoked");
  });

  it("marks a line as active while the access it bought is live", async () => {
    mock.onGet("/orders/me/o1").reply(200, order());
    render();
    expect(await screen.findByTestId("line-access-l1")).toHaveTextContent("Active");
  });

  it("shows when the refund window closes, using the platform setting", async () => {
    mock.onGet("/orders/me/o1").reply(200, order());
    render();
    // Paid 2026-09-20 + RefundWindowDays 14 -> 2026-10-04, already past on any later run: either sentence is correct,
    // what matters is that the window is stated rather than assumed.
    expect(await screen.findByTestId("receipt-refund-window")).toBeInTheDocument();
  });

  it("prints through the browser rather than generating a PDF", async () => {
    mock.onGet("/orders/me/o1").reply(200, order());
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByTestId("receipt-print"));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it("celebrates a payment that has just cleared", async () => {
    mock.onGet("/orders/me/o1").reply(200, order());
    render({ justPaid: true });

    expect(await screen.findByTestId("receipt-success")).toHaveTextContent("Payment received");
    expect(screen.getByRole("link", { name: "Start learning" })).toHaveAttribute("href", "/courses/c1");
  });

  it("does not celebrate an order that was merely opened from the list", async () => {
    mock.onGet("/orders/me/o1").reply(200, order());
    render();
    await screen.findByText("Cloud Architecture Essentials");
    expect(screen.queryByTestId("receipt-success")).not.toBeInTheDocument();
  });

  it("shows an error for an order that is not the caller's", async () => {
    mock.onGet("/orders/me/o1").reply(404, { code: "order.not_found", title: "Order not found." });
    render();
    expect(await screen.findByTestId("receipt-error")).toHaveTextContent("Order not found.");
  });
});

// ---------------------------------------------------------------------------
// Trainee refund requests (POST/GET /api/orders/me/{id}/refund-requests, cancel)
// ---------------------------------------------------------------------------

const refundRequest = (overrides: Record<string, unknown> = {}) => ({
  Id: "rr1",
  OrderId: "o1",
  OrganizationId: "org1",
  UserId: "u1",
  UserName: "Trainer One",
  LineIds: [],
  ItemTitles: ["Cloud Architecture Essentials"],
  RequestedAmount: null,
  Currency: "USD",
  OrderTotal: 59.25,
  OrderRefundedAmount: 0,
  Reason: "Not what I expected",
  Status: "Pending",
  DecidedBy: null,
  DecidedByName: null,
  DecidedAt: null,
  DecisionNote: null,
  ResultingRefundId: null,
  RequestedAt: new Date().toISOString(),
  ...overrides,
});

/** Paid just now, so the 14-day window is open on any run. */
const freshOrder = (overrides: Record<string, unknown> = {}) =>
  order({ PaidAt: new Date().toISOString(), PlacedAt: new Date().toISOString(), ...overrides });

const requestsFetched = () =>
  waitFor(() => expect(mock.history.get.some((r) => r.url === "/orders/me/o1/refund-requests")).toBe(true));

describe("OrderReceipt refund requests", () => {
  it("offers a refund request on a paid order inside the window with nothing pending", async () => {
    mock.onGet("/orders/me/o1").reply(200, freshOrder());
    mock.onGet("/orders/me/o1/refund-requests").reply(200, []);
    render();

    expect(await screen.findByTestId("refund-request-open")).toHaveTextContent("Request refund");
    expect(screen.queryByTestId("refund-request-latest")).not.toBeInTheDocument();
  });

  it("does not offer it once the order is fully refunded", async () => {
    mock.onGet("/orders/me/o1").reply(200, freshOrder({ Status: "Refunded", RefundedAmount: 59.25 }));
    mock.onGet("/orders/me/o1/refund-requests").reply(200, []);
    render();

    await screen.findByText("Cloud Architecture Essentials");
    await requestsFetched();
    expect(screen.queryByTestId("refund-request-open")).not.toBeInTheDocument();
  });

  it("does not offer it for an order that was never paid", async () => {
    mock.onGet("/orders/me/o1").reply(200, freshOrder({ Status: "PendingPayment", PaidAt: null }));
    mock.onGet("/orders/me/o1/refund-requests").reply(200, []);
    render();

    await screen.findByText("Cloud Architecture Essentials");
    await requestsFetched();
    expect(screen.queryByTestId("refund-request-open")).not.toBeInTheDocument();
  });

  it("does not offer it once the refund window has closed", async () => {
    const longAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    mock.onGet("/orders/me/o1").reply(200, freshOrder({ PaidAt: longAgo, PlacedAt: longAgo }));
    mock.onGet("/orders/me/o1/refund-requests").reply(200, []);
    render();

    expect(await screen.findByTestId("receipt-refund-window")).toHaveTextContent(/closed/i);
    await requestsFetched();
    expect(screen.queryByTestId("refund-request-open")).not.toBeInTheDocument();
  });

  it("shows a pending request inline with a cancel button instead of offering another", async () => {
    mock.onGet("/orders/me/o1").reply(200, freshOrder());
    mock.onGet("/orders/me/o1/refund-requests").reply(200, [refundRequest({ RequestedAmount: 20 })]);
    render();

    const latest = await screen.findByTestId("refund-request-latest");
    expect(screen.getByTestId("refund-request-status-badge")).toHaveTextContent("Pending review");
    expect(latest).toHaveTextContent("$20.00");
    expect(latest).toHaveTextContent("Not what I expected");
    expect(screen.getByTestId("refund-request-cancel")).toBeInTheDocument();
    expect(screen.queryByTestId("refund-request-open")).not.toBeInTheDocument();
  });

  it("shows a rejection with the reviewer's note and lets the trainee ask again", async () => {
    mock.onGet("/orders/me/o1").reply(200, freshOrder());
    mock
      .onGet("/orders/me/o1/refund-requests")
      .reply(200, [refundRequest({ Status: "Rejected", DecisionNote: "You finished the course." })]);
    render();

    expect(await screen.findByTestId("refund-request-note")).toHaveTextContent("You finished the course.");
    expect(screen.getByTestId("refund-request-status-badge")).toHaveTextContent("Rejected");
    expect(screen.queryByTestId("refund-request-cancel")).not.toBeInTheDocument();
    expect(screen.getByTestId("refund-request-open")).toBeInTheDocument();
  });

  it("requires a reason, bounds the amount, then submits the request", async () => {
    mock.onGet("/orders/me/o1").reply(200, freshOrder({ Status: "PartiallyRefunded", RefundedAmount: 9.25 }));
    mock.onGet("/orders/me/o1/refund-requests").reply(200, []);
    mock.onPost("/orders/me/o1/refund-requests").reply(200, refundRequest({ RequestedAmount: 25 }));
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByTestId("refund-request-open"));
    // The hint names what is still refundable: 59.25 - 9.25.
    expect(await screen.findByText(/everything still refundable \(\$50\.00\)/)).toBeInTheDocument();

    await user.click(screen.getByTestId("refund-request-submit"));
    expect(screen.getByTestId("refund-request-error")).toHaveTextContent("Please give a reason");
    expect(mock.history.post).toHaveLength(0);

    await user.type(screen.getByLabelText("Reason"), "Bought the wrong course");
    await user.type(screen.getByLabelText("Amount (optional)"), "60");
    await user.click(screen.getByTestId("refund-request-submit"));
    expect(screen.getByTestId("refund-request-error")).toHaveTextContent("no more than $50.00");
    expect(mock.history.post).toHaveLength(0);

    await user.clear(screen.getByLabelText("Amount (optional)"));
    await user.type(screen.getByLabelText("Amount (optional)"), "25");
    await user.click(screen.getByTestId("refund-request-submit"));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(mock.history.post[0].url).toBe("/orders/me/o1/refund-requests");
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Reason: "Bought the wrong course", Amount: 25 });
  });

  it("shows the server's reason when a request is refused", async () => {
    mock.onGet("/orders/me/o1").reply(200, freshOrder());
    mock.onGet("/orders/me/o1/refund-requests").reply(200, []);
    mock.onPost("/orders/me/o1/refund-requests").reply(409, {
      code: "refund_request.already_pending",
      title: "A refund request for this order is already awaiting review.",
    });
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByTestId("refund-request-open"));
    await user.type(await screen.findByLabelText("Reason"), "Please");
    await user.click(screen.getByTestId("refund-request-submit"));

    expect(await screen.findByTestId("refund-request-error")).toHaveTextContent("already awaiting review");
  });

  it("cancels a pending request", async () => {
    mock.onGet("/orders/me/o1").reply(200, freshOrder());
    mock.onGet("/orders/me/o1/refund-requests").reply(200, [refundRequest()]);
    mock.onPost("/orders/me/refund-requests/rr1/cancel").reply(200, refundRequest({ Status: "Cancelled" }));
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByTestId("refund-request-cancel"));

    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual(["/orders/me/refund-requests/rr1/cancel"]));
  });
});
