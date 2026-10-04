import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminCoupons from "./AdminCoupons";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

/** Mirrors the live `WELCOME25` seed row (GET /api/admin/coupons). */
const coupon = (overrides: Record<string, unknown> = {}) => ({
  Id: "cp1",
  Code: "WELCOME25",
  Description: "25% off — development seed data.",
  Kind: "Percentage",
  Percentage: 25,
  AmountOff: null,
  Currency: null,
  MinSubtotal: null,
  MaxRedemptions: 50,
  MaxRedemptionsPerUser: 1,
  RedeemedCount: 2,
  StartsAt: null,
  EndsAt: null,
  IsActive: true,
  IsLive: true,
  AppliesTo: [],
  CreatedAt: "2026-09-23T23:55:11.316Z",
  UpdatedAt: "2026-09-24T00:16:12.805Z",
  ...overrides,
});

const redemption = (overrides: Record<string, unknown> = {}) => ({
  Id: "r1",
  CouponId: "cp1",
  CouponCode: "WELCOME25",
  UserId: "u9",
  UserName: "Trainer Two",
  OrderId: "o1",
  OrderLink: "/admin/orders/o1",
  OrderStatus: "Paid",
  OrderTotal: 59.25,
  Currency: "USD",
  AmountDiscounted: 19.75,
  RedeemedAt: "2026-09-24T00:16:12.777Z",
  ...overrides,
});

let mock: MockAdapter;

const signIn = (permissions: string[] = ["coupons.manage"]) => {
  const user = makeUser({ Id: "admin-1", Role: "Admin", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  return user;
};

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  signIn();
  mock.onGet("/Settings").reply(200, { Currency: "USD", CheckoutEnabled: true });
  mock.onGet("/Courses").reply(200, []);
  mock.onGet("/tracks").reply(200, []);
});
afterEach(() => mock.restore());

describe("AdminCoupons", () => {
  it("lists coupons with their discount, usage and live badge", async () => {
    mock.onGet("/admin/coupons").reply(200, [coupon()], { "x-total-count": "1" });
    renderWithProviders(<AdminCoupons />);

    expect(await screen.findByText("WELCOME25")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("2 of 50 used")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Always on")).toBeInTheDocument();
    expect(screen.getByText("Everything")).toBeInTheDocument();
  });

  it("shows the empty state when there are no coupons", async () => {
    mock.onGet("/admin/coupons").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<AdminCoupons />);
    expect(await screen.findByText("No coupons yet.")).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/admin/coupons").reply(500);
    renderWithProviders(<AdminCoupons />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("re-queries with the debounced search and the state filter", async () => {
    mock.onGet("/admin/coupons").reply(200, [coupon()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("WELCOME25");

    await user.type(screen.getByRole("textbox", { name: "Search" }), "welc");
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/coupons").pop();
      expect(call?.params?.search).toBe("welc");
    });

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Active only" }));
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/coupons").pop();
      expect(call?.params?.active).toBe(true);
    });
  });

  it("creates a percentage coupon", async () => {
    mock.onGet("/admin/coupons").reply(200, [], { "x-total-count": "0" });
    mock.onPost("/admin/coupons").reply(201, coupon({ Id: "cp2", Code: "SPRING10" }));
    const user = userEvent.setup();
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("No coupons yet.");

    await user.click(screen.getByRole("button", { name: "New coupon" }));
    await user.type(await screen.findByLabelText("Code"), "spring10");
    await user.type(screen.getByLabelText("Percentage off"), "10");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toMatchObject({ Code: "SPRING10", Kind: "Percentage", Percentage: 10, IsActive: true });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Coupon saved." }));
  });

  it("refuses to save a percentage coupon without a percentage", async () => {
    mock.onGet("/admin/coupons").reply(200, [], { "x-total-count": "0" });
    const user = userEvent.setup();
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("No coupons yet.");

    await user.click(screen.getByRole("button", { name: "New coupon" }));
    await user.type(await screen.findByLabelText("Code"), "nope");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mock.history.post).toHaveLength(0);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "Enter a percentage between 1 and 100." })
    );
  });

  it("edits an existing coupon through PUT", async () => {
    mock.onGet("/admin/coupons").reply(200, [coupon()], { "x-total-count": "1" });
    mock.onPut("/admin/coupons/cp1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("WELCOME25");

    await user.click(screen.getByRole("button", { name: "Edit coupon" }));
    const code = await screen.findByLabelText("Code");
    expect(code).toHaveValue("WELCOME25");
    await user.clear(screen.getByLabelText("Total uses allowed"));
    await user.type(screen.getByLabelText("Total uses allowed"), "80");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toMatchObject({ Code: "WELCOME25", MaxRedemptions: 80 });
  });

  it("deletes a coupon that was never redeemed (204)", async () => {
    mock.onGet("/admin/coupons").reply(200, [coupon({ RedeemedCount: 0 })], { "x-total-count": "1" });
    mock.onDelete("/admin/coupons/cp1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("WELCOME25");

    await user.click(screen.getByRole("button", { name: "Delete coupon" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete coupon" }));

    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Coupon deleted." }));
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("reports a redeemed coupon as switched off instead of deleted (200), not as an error", async () => {
    mock.onGet("/admin/coupons").reply(200, [coupon()], { "x-total-count": "1" });
    mock.onDelete("/admin/coupons/cp1").reply(200, {
      Id: "cp1",
      Code: "WELCOME25",
      Deleted: false,
      Deactivated: true,
      RedeemedCount: 2,
      Note: "Redeemed 2 times; deactivated instead of deleted.",
    });
    const user = userEvent.setup();
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("WELCOME25");

    await user.click(screen.getByRole("button", { name: "Delete coupon" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete coupon" }));

    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Coupon WELCOME25 had already been used, so it was switched off instead of deleted." })
    );
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("surfaces a delete failure as an error toast", async () => {
    mock.onGet("/admin/coupons").reply(200, [coupon()], { "x-total-count": "1" });
    mock.onDelete("/admin/coupons/cp1").reply(404);
    const user = userEvent.setup();
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("WELCOME25");

    await user.click(screen.getByRole("button", { name: "Delete coupon" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete coupon" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", title: "Could not delete this coupon." })
      )
    );
  });

  it("opens the redemptions dialog with the buyer and the discounted amount", async () => {
    mock.onGet("/admin/coupons").reply(200, [coupon()], { "x-total-count": "1" });
    mock.onGet("/admin/coupons/cp1/redemptions").reply(200, [redemption()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("WELCOME25");

    await user.click(screen.getByRole("button", { name: "Redemptions" }));
    expect(await screen.findByText("Trainer Two")).toBeInTheDocument();
    expect(screen.getByText("$19.75")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Paid" })).toHaveAttribute("href", "/admin/orders/o1");
  });

  it("shows the redemptions empty state for a coupon nobody used", async () => {
    mock.onGet("/admin/coupons").reply(200, [coupon({ RedeemedCount: 0 })], { "x-total-count": "1" });
    mock.onGet("/admin/coupons/cp1/redemptions").reply(200, [], { "x-total-count": "0" });
    const user = userEvent.setup();
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("WELCOME25");

    await user.click(screen.getByRole("button", { name: "Redemptions" }));
    expect(await screen.findByText("This coupon has not been used yet.")).toBeInTheDocument();
  });

  it("hides every write action without coupons.manage", async () => {
    mock.reset();
    signIn([]);
    mock.onGet("/Settings").reply(200, { Currency: "USD" });
    mock.onGet("/Courses").reply(200, []);
    mock.onGet("/tracks").reply(200, []);
    mock.onGet("/admin/coupons").reply(200, [coupon()], { "x-total-count": "1" });
    renderWithProviders(<AdminCoupons />);
    await screen.findByText("WELCOME25");

    expect(screen.queryByRole("button", { name: "New coupon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit coupon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete coupon" })).not.toBeInTheDocument();
    // Reading who used a coupon is part of the list, not a write action.
    expect(screen.getByRole("button", { name: "Redemptions" })).toBeInTheDocument();
  });
});
