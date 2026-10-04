import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminOrderDetail from "./AdminOrderDetail";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const line = (overrides: Record<string, unknown> = {}) => ({
  LineId: "l1",
  ItemType: "Course",
  ItemId: "c1",
  Title: "Applied Machine Learning",
  ResolvedTitle: "Applied Machine Learning",
  CourseId: "c1",
  CourseTitle: "Applied Machine Learning",
  InstructorId: "i1",
  InstructorName: "Instructor One",
  UnitAmount: 49.99,
  DiscountAmount: 12.5,
  LineTotal: 37.49,
  RefundedAmount: 0,
  RefundableAmount: 37.49,
  ...overrides,
});

const order = (overrides: Record<string, unknown> = {}) => ({
  Id: "o1",
  UserId: "u-buyer",
  BuyerName: "Trainer Two",
  Status: "Paid",
  Provider: "mock",
  ProviderRef: "tq_abc123",
  SupportsManualCapture: false,
  Currency: "USD",
  Subtotal: 49.99,
  DiscountAmount: 12.5,
  TaxAmount: 0,
  Total: 37.49,
  RefundedAmount: 0,
  RefundableAmount: 37.49,
  CouponCode: "WELCOME25",
  PlacedAt: "2026-09-23T23:55:11Z",
  PaidAt: "2026-09-23T23:55:11Z",
  CancelledAt: null,
  FailedAt: null,
  FailureReason: null,
  MarkedPaidBy: null,
  MarkedPaidByName: null,
  PaymentReference: null,
  Notes: null,
  RefundWindowEndsAt: "2026-10-07T23:55:11Z",
  WithinRefundWindow: true,
  Items: [line()],
  ...overrides,
});

const refund = {
  Id: "r1",
  OrderId: "o1",
  UserId: "u-buyer",
  UserName: "Trainer Two",
  Kind: "Full",
  LineIds: [],
  ItemTitles: ["Applied Machine Learning"],
  Amount: 37.49,
  Currency: "USD",
  Reason: "Buyer changed their mind",
  RevokeAccess: true,
  Status: "Succeeded",
  Provider: "mock",
  ProviderRefundRef: "mock_re_1",
  IdempotencyKey: "seed",
  RequestedBy: "admin-1",
  RequestedByName: "Admin User",
  RequestedAt: "2026-09-24T09:00:00Z",
  CompletedAt: "2026-09-24T09:00:01Z",
  FailureReason: null,
  Replayed: false,
};

let mock: MockAdapter;

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "admin-1", Role: "Admin", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

const refundBodies = () =>
  mock.history.post
    .filter((r) => r.url === "/admin/orders/o1/refund")
    .map((r) => JSON.parse(r.data as string) as Record<string, unknown>);

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  signIn(["orders.manage", "refunds.manage"]);
  mock.onGet("/admin/refunds").reply(200, [], { "x-total-count": "0" });
});
afterEach(() => mock.restore());

const render = () => renderWithProviders(<AdminOrderDetail orderId="o1" onOpenChange={() => {}} />);

/** Opens the refund dialog and fills in the reason, which the form always requires. */
const openRefundDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: "Refund" }));
  return screen.findByRole("dialog");
};

describe("AdminOrderDetail", () => {
  it("shows the lines, the refundable amount and the payment history", async () => {
    mock.onGet("/admin/orders/o1").reply(200, order());
    mock.onGet("/admin/refunds").reply(200, [refund], { "x-total-count": "1" });
    render();

    expect(await screen.findByText("Trainer Two")).toBeInTheDocument();
    expect(within(screen.getByTestId("order-lines")).getByText("Applied Machine Learning")).toBeInTheDocument();
    expect(screen.getByTestId("order-refundable")).toHaveTextContent("$37.49");
    expect(within(await screen.findByTestId("order-timeline")).getByText(/Refund · \$37\.49 · Succeeded/)).toBeInTheDocument();
  });

  it("shows an error state when the order cannot be read", async () => {
    mock.onGet("/admin/orders/o1").reply(404);
    render();
    expect(await screen.findByTestId("order-detail-error")).toBeInTheDocument();
  });

  it("issues a full refund with a reason and an idempotency key", async () => {
    mock.onGet("/admin/orders/o1").reply(200, order());
    mock.onPost("/admin/orders/o1/refund").reply(200, refund);
    const user = userEvent.setup();
    render();

    const dialog = await openRefundDialog(user);
    await user.type(within(dialog).getByLabelText("Reason"), "Buyer changed their mind");
    await user.click(within(dialog).getByRole("button", { name: "Issue refund" }));

    await waitFor(() => expect(refundBodies()).toHaveLength(1));
    const body = refundBodies()[0];
    expect(body.Reason).toBe("Buyer changed their mind");
    expect(body.RevokeAccess).toBe(true);
    expect(body.LineIds).toBeUndefined();
    expect(typeof body.IdempotencyKey).toBe("string");
    expect(String(body.IdempotencyKey).length).toBeGreaterThan(8);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Refund issued." }));
  });

  it("refuses to submit a refund without a reason", async () => {
    mock.onGet("/admin/orders/o1").reply(200, order());
    mock.onPost("/admin/orders/o1/refund").reply(200, refund);
    const user = userEvent.setup();
    render();

    const dialog = await openRefundDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Issue refund" }));

    expect(await screen.findByTestId("refund-error")).toBeInTheDocument();
    expect(refundBodies()).toHaveLength(0);
  });

  it("refunds selected lines only, and refuses a partial refund with nothing selected", async () => {
    mock.onGet("/admin/orders/o1").reply(200, order({ Items: [line(), line({ LineId: "l2", Title: "Second line", ResolvedTitle: "Second line" })] }));
    mock.onPost("/admin/orders/o1/refund").reply(200, { ...refund, Kind: "Partial" });
    const user = userEvent.setup();
    render();

    const dialog = await openRefundDialog(user);
    await user.click(within(dialog).getByLabelText("Refund selected lines"));
    await user.type(within(dialog).getByLabelText("Reason"), "Only one line");
    await user.click(within(dialog).getByRole("button", { name: "Issue refund" }));

    expect(await screen.findByTestId("refund-error")).toHaveTextContent("Select at least one line.");
    expect(refundBodies()).toHaveLength(0);

    await user.click(within(screen.getByTestId("refund-lines")).getByRole("checkbox", { name: "Second line" }));
    await user.click(within(dialog).getByRole("button", { name: "Issue refund" }));

    await waitFor(() => expect(refundBodies()).toHaveLength(1));
    expect(refundBodies()[0].LineIds).toEqual(["l2"]);
  });

  it("re-sends the same idempotency key when a failed refund is retried", async () => {
    mock.onGet("/admin/orders/o1").reply(200, order());
    mock.onPost("/admin/orders/o1/refund").replyOnce(500);
    mock.onPost("/admin/orders/o1/refund").reply(200, { ...refund, Replayed: true });
    const user = userEvent.setup();
    render();

    const dialog = await openRefundDialog(user);
    await user.type(within(dialog).getByLabelText("Reason"), "Retry after a timeout");
    await user.click(within(dialog).getByRole("button", { name: "Issue refund" }));
    await screen.findByTestId("refund-error");

    await user.click(within(dialog).getByRole("button", { name: "Issue refund" }));

    await waitFor(() => expect(refundBodies()).toHaveLength(2));
    const [first, second] = refundBodies();
    expect(second.IdempotencyKey).toBe(first.IdempotencyKey);
  });

  it("mints a fresh idempotency key for a deliberate second refund", async () => {
    mock.onGet("/admin/orders/o1").reply(200, order());
    mock.onPost("/admin/orders/o1/refund").reply(200, refund);
    const user = userEvent.setup();
    render();

    const first = await openRefundDialog(user);
    await user.type(within(first).getByLabelText("Reason"), "First half");
    await user.click(within(first).getByRole("button", { name: "Issue refund" }));
    await waitFor(() => expect(refundBodies()).toHaveLength(1));

    const second = await openRefundDialog(user);
    await user.type(within(second).getByLabelText("Reason"), "Second half");
    await user.click(within(second).getByRole("button", { name: "Issue refund" }));

    await waitFor(() => expect(refundBodies()).toHaveLength(2));
    expect(refundBodies()[1].IdempotencyKey).not.toBe(refundBodies()[0].IdempotencyKey);
  });

  it("hides the refund action without refunds.manage", async () => {
    mock.reset();
    signIn(["orders.manage"]);
    mock.onGet("/admin/refunds").reply(200, [], { "x-total-count": "0" });
    mock.onGet("/admin/orders/o1").reply(200, order());
    render();

    await screen.findByText("Trainer Two");
    expect(screen.queryByRole("button", { name: "Refund" })).not.toBeInTheDocument();
  });

  it("hides the refund action once nothing is refundable", async () => {
    mock.onGet("/admin/orders/o1").reply(200, order({ Status: "Refunded", RefundedAmount: 37.49, RefundableAmount: 0 }));
    render();

    await screen.findByText("Trainer Two");
    expect(screen.queryByRole("button", { name: "Refund" })).not.toBeInTheDocument();
  });

  it("offers 'mark as paid' only for a manual-capture provider awaiting payment", async () => {
    mock.onGet("/admin/orders/o1").reply(200, order({ Status: "PendingPayment", PaidAt: null }));
    const { unmount } = render();
    await screen.findByText("Trainer Two");
    expect(screen.queryByRole("button", { name: "Mark as paid" })).not.toBeInTheDocument();
    unmount();

    mock.onGet("/admin/orders/o1").reply(200, order({ Status: "PendingPayment", PaidAt: null, Provider: "manual", SupportsManualCapture: true }));
    render();
    expect(await screen.findByRole("button", { name: "Mark as paid" })).toBeInTheDocument();
  });

  it("marks a manual order as paid with its bank reference", async () => {
    mock
      .onGet("/admin/orders/o1")
      .reply(200, order({ Status: "PendingPayment", PaidAt: null, Provider: "manual", SupportsManualCapture: true }));
    mock.onPost("/admin/orders/o1/mark-paid").reply(200, order({ Status: "Paid" }));
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole("button", { name: "Mark as paid" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Payment reference"), "SEED-BANK-0002");
    await user.click(within(dialog).getByRole("button", { name: "Mark as paid" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/admin/orders/o1/mark-paid")).toBe(true));
    const body = JSON.parse(mock.history.post.find((r) => r.url === "/admin/orders/o1/mark-paid")!.data as string);
    expect(body.PaymentReference).toBe("SEED-BANK-0002");
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Order marked as paid." }));
  });

  it("re-applies a paid order and reports that nothing was missing", async () => {
    mock.onGet("/admin/orders/o1").reply(200, order());
    mock.onPost("/admin/orders/o1/reapply").reply(200, {
      Applied: false,
      EntitlementsCreated: 0,
      EnrollmentsCreated: 0,
      EarningsCreated: 0,
      Order: order(),
    });
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole("button", { name: "Re-apply fulfillment" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Re-apply" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/admin/orders/o1/reapply")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Nothing was missing — this order was already fully applied." })
    );
  });

  it("hides mark-paid and re-apply without orders.manage", async () => {
    mock.reset();
    signIn(["refunds.manage"]);
    mock.onGet("/admin/refunds").reply(200, [], { "x-total-count": "0" });
    mock.onGet("/admin/orders/o1").reply(200, order());
    render();

    await screen.findByText("Trainer Two");
    expect(screen.queryByRole("button", { name: "Re-apply fulfillment" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refund" })).toBeInTheDocument();
  });
});
