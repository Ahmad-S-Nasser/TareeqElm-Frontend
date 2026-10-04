import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationBilling from "./OrganizationBilling";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const tier = (overrides: Record<string, unknown> = {}) => ({
  Tier: "package1",
  Name: "Package 1",
  Cap: 500,
  Price: { IsFree: false, Amount: 300, EffectiveAmount: 300, CompareAtAmount: null, SaleAmount: null, SaleStartsAt: null, SaleEndsAt: null, Currency: "USD", OnSale: false },
  ...overrides,
});

const settings = (overrides: Record<string, unknown> = {}) => ({
  Currency: "USD", CheckoutEnabled: true, RefundWindowDays: 14, DefaultPaymentProvider: null,
  PackageTiers: [tier(), tier({ Tier: "package2", Name: "Package 2", Cap: 1000, Price: { ...tier().Price, Amount: 600 } })],
  ...overrides,
});

let mock: MockAdapter;

const signIn = () => {
  const user = makeUser({ Id: "org-1", Role: "Organization", Permissions: [] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  signIn();
});
afterEach(() => mock.restore());

describe("OrganizationBilling", () => {
  it("shows current seat usage against the cap", async () => {
    mock.onGet("/Organization/billing").reply(200, { TraineeCap: 500, PackageTier: "package1", UsedSeats: 120 });
    mock.onGet("/Settings").reply(200, settings());
    renderWithProviders(<OrganizationBilling />);

    expect(await screen.findByText("120 of 500 seats used")).toBeInTheDocument();
  });

  it("shows uncapped usage when Admin never set a cap", async () => {
    mock.onGet("/Organization/billing").reply(200, { TraineeCap: null, PackageTier: null, UsedSeats: 7 });
    mock.onGet("/Settings").reply(200, settings());
    renderWithProviders(<OrganizationBilling />);

    expect(await screen.findByText("7 trainees, uncapped")).toBeInTheDocument();
  });

  it("lists the package tiers with their price and seat count", async () => {
    mock.onGet("/Organization/billing").reply(200, { TraineeCap: null, PackageTier: null, UsedSeats: 0 });
    mock.onGet("/Settings").reply(200, settings());
    renderWithProviders(<OrganizationBilling />);

    expect(await screen.findByText("Package 1")).toBeInTheDocument();
    expect(screen.getByText("Package 2")).toBeInTheDocument();
    expect(screen.getByText("$300.00")).toBeInTheDocument();
    expect(screen.getByText("$600.00")).toBeInTheDocument();
    expect(screen.getByText("Up to 500 trainees")).toBeInTheDocument();
  });

  it("marks the organization's current package and disables buying it again", async () => {
    mock.onGet("/Organization/billing").reply(200, { TraineeCap: 500, PackageTier: "package1", UsedSeats: 50 });
    mock.onGet("/Settings").reply(200, settings());
    renderWithProviders(<OrganizationBilling />);

    await screen.findByText("Package 1");
    expect(screen.getAllByText("Current plan").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
  });

  it("an unpriced tier shows not-available instead of a buy button", async () => {
    mock.onGet("/Organization/billing").reply(200, { TraineeCap: null, PackageTier: null, UsedSeats: 0 });
    mock.onGet("/Settings").reply(200, settings({ PackageTiers: [tier({ Price: null })] }));
    renderWithProviders(<OrganizationBilling />);

    expect(await screen.findByText("Not available yet")).toBeInTheDocument();
  });

  it("buys a package through POST /checkout with a PackageSubscription item", async () => {
    mock.onGet("/Organization/billing").reply(200, { TraineeCap: null, PackageTier: null, UsedSeats: 0 });
    mock.onGet("/Settings").reply(200, settings());
    mock.onPost("/checkout").reply(200, {
      OrderId: "o1", Provider: "manual", ProviderRef: "tq_1", Status: "PendingPayment", Currency: "USD", Total: 300,
      SessionId: null, RedirectUrl: null, Instructions: "Wire 300 USD to account 123.", RequiresManualCapture: true, Replayed: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationBilling />);
    await screen.findByText("Package 1");

    await user.click(screen.getAllByRole("button", { name: "Choose this package" })[0]);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Choose this package" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/checkout")).toBe(true));
    const body = JSON.parse(mock.history.post.find((r) => r.url === "/checkout")!.data);
    expect(body).toMatchObject({ Items: [{ ItemType: "PackageSubscription", ItemId: "package1" }] });
    expect(await within(dialog).findByText("Wire 300 USD to account 123.")).toBeInTheDocument();
  });
});
