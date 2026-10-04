import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminOrders from "./AdminOrders";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

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
  Items: [
    {
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
    },
  ],
  ...overrides,
});

let mock: MockAdapter;

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "admin-1", Role: "Admin", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  return user;
};

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  signIn(["orders.manage", "refunds.manage"]);
  mock.onGet("/admin/refunds").reply(200, [], { "x-total-count": "0" });
});
afterEach(() => mock.restore());

describe("AdminOrders", () => {
  it("lists orders with the resolved buyer name, total and status badge", async () => {
    mock.onGet("/admin/orders").reply(200, [order()], { "x-total-count": "1" });
    renderWithProviders(<AdminOrders />);

    expect(await screen.findByText("Trainer Two")).toBeInTheDocument();
    expect(screen.getByText("$37.49")).toBeInTheDocument();
    expect(screen.getByTestId("order-status-badge")).toHaveAttribute("data-status", "Paid");
    expect(screen.getByText("Applied Machine Learning")).toBeInTheDocument();
  });

  it("falls back to the deleted-account label instead of showing a raw user id", async () => {
    mock.onGet("/admin/orders").reply(200, [order({ BuyerName: null })], { "x-total-count": "1" });
    renderWithProviders(<AdminOrders />);

    expect(await screen.findByText("Deleted account")).toBeInTheDocument();
    expect(screen.queryByText("u-buyer")).not.toBeInTheDocument();
  });

  it("shows the empty state when no order matches", async () => {
    mock.onGet("/admin/orders").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<AdminOrders />);

    expect(await screen.findByTestId("orders-empty")).toHaveTextContent("No orders match these filters.");
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/admin/orders").reply(500);
    renderWithProviders(<AdminOrders />);

    expect(await screen.findByTestId("orders-error")).toBeInTheDocument();
  });

  it("re-queries with the chosen status filter", async () => {
    mock.onGet("/admin/orders").reply(200, [order()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminOrders />);
    await screen.findByText("Trainer Two");

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Refunded" }));

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/orders").pop();
      expect(call?.params?.status).toBe("Refunded");
    });
  });

  it("re-queries with the debounced search box", async () => {
    mock.onGet("/admin/orders").reply(200, [order()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminOrders />);
    await screen.findByText("Trainer Two");

    await user.type(screen.getByRole("textbox", { name: "Search" }), "tq_abc");

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/orders").pop();
      expect(call?.params?.search).toBe("tq_abc");
    });
  });

  it("filters by buyer when the buyer's name is clicked, and clears the chip again", async () => {
    mock.onGet("/admin/orders").reply(200, [order()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminOrders />);

    await user.click(await screen.findByRole("button", { name: "Trainer Two" }));

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/orders").pop();
      expect(call?.params?.userId).toBe("u-buyer");
    });
    expect(screen.getByTestId("active-filters")).toHaveTextContent("Trainer Two");

    await user.click(screen.getByRole("button", { name: /Reset Buyer/i }));
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/orders").pop();
      expect(call?.params?.userId).toBeUndefined();
    });
  });

  it("opens the detail panel when a row is clicked", async () => {
    mock.onGet("/admin/orders").reply(200, [order()], { "x-total-count": "1" });
    mock.onGet("/admin/orders/o1").reply(200, order());
    const user = userEvent.setup();
    renderWithProviders(<AdminOrders />);

    await user.click(await screen.findByTestId("order-row-o1"));

    expect(await screen.findByTestId("order-detail")).toBeInTheDocument();
    expect(await screen.findByTestId("order-refundable")).toHaveTextContent("$37.49");
  });

  it("downloads the CSV export with the active filters", async () => {
    mock.onGet("/admin/orders").reply(200, [order()], { "x-total-count": "1" });
    mock.onGet("/admin/orders/export").reply(200, "OrderId,Total\no1,37.49", {
      "content-disposition": 'attachment; filename=orders-20260924.csv',
    });
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    (URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectURL }).revokeObjectURL = revokeObjectURL;

    const user = userEvent.setup();
    renderWithProviders(<AdminOrders />);
    await screen.findByText("Trainer Two");

    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => expect(mock.history.get.some((r) => r.url === "/admin/orders/export")).toBe(true));
    expect(createObjectURL).toHaveBeenCalled();
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Downloaded orders-20260924.csv." })
      )
    );
  });

  it("hides the export button without orders.manage", async () => {
    mock.reset();
    signIn([]);
    mock.onGet("/admin/orders").reply(200, [order()], { "x-total-count": "1" });
    renderWithProviders(<AdminOrders />);

    await screen.findByText("Trainer Two");
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
  });
});
