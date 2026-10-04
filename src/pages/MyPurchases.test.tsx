import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import MyPurchases from "./MyPurchases";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const line = (overrides: Record<string, unknown> = {}) => ({
  LineId: "l1",
  ItemType: "Course",
  ItemId: "c1",
  Title: "Cloud Architecture Essentials",
  CourseId: "c1",
  InstructorId: "i1",
  UnitAmount: 79,
  DiscountAmount: 0,
  LineTotal: 79,
  RefundedAmount: 0,
  ...overrides,
});

const order = (overrides: Record<string, unknown> = {}) => ({
  Id: "o1",
  UserId: "u1",
  Status: "Paid",
  Provider: "mock",
  ProviderRef: "tq_abc",
  Currency: "USD",
  Subtotal: 79,
  DiscountAmount: 0,
  TaxAmount: 0,
  Total: 79,
  RefundedAmount: 0,
  CouponCode: null,
  PlacedAt: "2026-09-20T10:00:00Z",
  PaidAt: "2026-09-20T10:01:00Z",
  CancelledAt: null,
  FailedAt: null,
  FailureReason: null,
  PaymentReference: null,
  Items: [line()],
  ...overrides,
});

let mock: MockAdapter;

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Trainer", Permissions: ["orders.self"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

const render = () => renderWithProviders(<MyPurchases />, { initialEntries: ["/purchases"] });

describe("MyPurchases", () => {
  it("lists the buyer's own orders with a status badge and the item titles", async () => {
    mock.onGet("/orders/me").reply(200, [order()], { "x-total-count": "1" });
    render();

    expect(await screen.findByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByTestId("order-status-badge")).toHaveTextContent("Paid");
    expect(screen.getByText("$79.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View receipt" })).toHaveAttribute("href", "/purchases/o1");
  });

  it("shows the empty state when nothing has been bought", async () => {
    mock.onGet("/orders/me").reply(200, [], { "x-total-count": "0" });
    render();
    expect(await screen.findByTestId("orders-empty")).toHaveTextContent("You have not bought anything yet.");
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/orders/me").reply(500);
    render();
    expect(await screen.findByTestId("orders-error")).toBeInTheDocument();
  });

  it("re-queries with the chosen status filter", async () => {
    mock.onGet("/orders/me").reply(200, [order()], { "x-total-count": "1" });
    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Awaiting payment" }));

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/orders/me").pop();
      expect(call?.params?.status).toBe("PendingPayment");
      expect(call?.params?.page).toBe(1);
    });
  });

  it("offers cancel and pay-now only while an order is awaiting payment", async () => {
    mock.onGet("/orders/me").reply(200, [order({ Status: "PendingPayment", PaidAt: null })], { "x-total-count": "1" });
    render();

    await screen.findByText("Cloud Architecture Essentials");
    expect(screen.getByRole("button", { name: "Cancel this order" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Complete payment" })).toHaveAttribute(
      "href",
      "/checkout?item=Course:c1"
    );
  });

  it("does not offer cancel for an order that is already paid", async () => {
    mock.onGet("/orders/me").reply(200, [order()], { "x-total-count": "1" });
    render();
    await screen.findByText("Cloud Architecture Essentials");
    expect(screen.queryByRole("button", { name: "Cancel this order" })).not.toBeInTheDocument();
  });

  it("cancels a pending order after confirmation", async () => {
    mock.onGet("/orders/me").reply(200, [order({ Status: "PendingPayment", PaidAt: null })], { "x-total-count": "1" });
    mock.onPost("/orders/me/o1/cancel").reply(204);
    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Cancel this order" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel this order" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/orders/me/o1/cancel")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Order cancelled." }));
  });

  it("reports a refused cancel instead of pretending it worked", async () => {
    mock.onGet("/orders/me").reply(200, [order({ Status: "PendingPayment", PaidAt: null })], { "x-total-count": "1" });
    mock
      .onPost("/orders/me/o1/cancel")
      .reply(409, { code: "order.not_cancellable", title: "Only an order still awaiting payment can be cancelled." });
    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Cancel this order" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel this order" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Could not cancel this order.",
          description: "Only an order still awaiting payment can be cancelled.",
        })
      )
    );
  });

  it("pages through a long history", async () => {
    mock.onGet("/orders/me").reply(200, [order()], { "x-total-count": "25" });
    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/orders/me").pop();
      expect(call?.params?.page).toBe(2);
    });
  });
});
