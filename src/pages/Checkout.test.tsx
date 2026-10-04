import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import Checkout from "./Checkout";
import { LocationProbe, makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const ITEM_QUERY = "/checkout?itemType=Course&itemId=c1";

const quote = (overrides: Record<string, unknown> = {}) => ({
  Currency: "USD",
  Lines: [
    {
      ItemType: "Course",
      ItemId: "c1",
      Title: "Cloud Architecture Essentials",
      UnitAmount: 79,
      DiscountAmount: 0,
      LineTotal: 79,
      CourseId: "c1",
      InstructorId: "i1",
    },
  ],
  Subtotal: 79,
  DiscountAmount: 0,
  TaxAmount: 0,
  Total: 79,
  CouponCode: null,
  CouponApplied: false,
  CouponReasonCode: null,
  ...overrides,
});

const session = (overrides: Record<string, unknown> = {}) => ({
  OrderId: "o1",
  Provider: "mock",
  ProviderRef: "tq_abc",
  Status: "PendingPayment",
  Currency: "USD",
  Total: 79,
  SessionId: "mock_sess_1",
  RedirectUrl: null,
  Instructions: null,
  RequiresManualCapture: false,
  Replayed: false,
  ...overrides,
});

const order = (overrides: Record<string, unknown> = {}) => ({
  Id: "o1",
  UserId: "u1",
  Status: "PendingPayment",
  Provider: "mock",
  ProviderRef: "tq_abc",
  Currency: "USD",
  Subtotal: 79,
  DiscountAmount: 0,
  TaxAmount: 0,
  Total: 79,
  RefundedAmount: 0,
  CouponCode: null,
  PlacedAt: "2026-09-24T00:15:47Z",
  PaidAt: null,
  CancelledAt: null,
  FailedAt: null,
  FailureReason: null,
  PaymentReference: null,
  Items: [],
  ...overrides,
});

let mock: MockAdapter;

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Trainer", Permissions: ["checkout.self", "orders.self", "entitlements.self"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Settings").reply(200, {
    Currency: "USD",
    CheckoutEnabled: true,
    RefundWindowDays: 14,
    DefaultPaymentProvider: null,
  });
});
afterEach(() => {
  mock.restore();
  vi.unstubAllEnvs();
});

const render = (entry = ITEM_QUERY) =>
  renderWithProviders(
    <>
      <Checkout />
      <LocationProbe />
    </>,
    { initialEntries: [entry] }
  );

describe("Checkout: the quote", () => {
  it("prices the basket named in the query string and shows the totals", async () => {
    mock.onPost("/checkout/quote").reply(200, quote());
    render();

    expect(await screen.findByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByTestId("checkout-total")).toHaveTextContent("$79.00");
    expect(JSON.parse(mock.history.post[0].data).Items).toEqual([{ ItemType: "Course", ItemId: "c1" }]);
  });

  it("accepts several repeatable item params and de-duplicates them", async () => {
    mock.onPost("/checkout/quote").reply(200, quote());
    render("/checkout?item=Course:c1&item=Track:t1&item=Course:c1");

    await screen.findByText("Cloud Architecture Essentials");
    expect(JSON.parse(mock.history.post[0].data).Items).toEqual([
      { ItemType: "Course", ItemId: "c1" },
      { ItemType: "Track", ItemId: "t1" },
    ]);
  });

  it("shows the empty state when no item was passed", async () => {
    render("/checkout");
    expect(await screen.findByText("There is nothing to pay for.")).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);
  });

  it("shows an error with a retry when the quote fails", async () => {
    mock.onPost("/checkout/quote").reply(500);
    render();
    expect(await screen.findByTestId("checkout-quote-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("explains a 409 already-owned basket instead of showing a raw error", async () => {
    mock.onPost("/checkout/quote").reply(409, { code: "checkout.already_owned", title: "You already own this item." });
    render();
    expect(await screen.findByText("You already have access to this.")).toBeInTheDocument();
  });

  it("hides the buy flow entirely when the platform has checkout switched off", async () => {
    mock.onGet("/Settings").reply(200, { Currency: "USD", CheckoutEnabled: false, RefundWindowDays: 14 });
    mock.onPost("/checkout/quote").reply(200, quote());
    render();
    expect(await screen.findByTestId("checkout-disabled")).toBeInTheDocument();
    expect(screen.queryByTestId("checkout-total")).not.toBeInTheDocument();
  });
});

describe("Checkout: recommended prior courses", () => {
  const withRecommendations = (titles: string[]) =>
    quote({ Lines: [{ ...quote().Lines[0], RecommendedPriorCourseTitles: titles }] });

  it("shows a friendly, non-blocking note naming the uncompleted prerequisites and keeps the buy button enabled", async () => {
    mock.onPost("/checkout/quote").reply(200, withRecommendations(["Cloud Basics", "Networking 101"]));
    mock.onPost("/checkout").reply(200, session());
    mock.onGet("/orders/me/o1").reply(200, order());

    const user = userEvent.setup();
    render();

    const note = await screen.findByTestId("checkout-recommended-prior");
    expect(note).toHaveAttribute("role", "note"); // a suggestion, not an alert
    expect(note).toHaveTextContent(/we recommend completing Cloud Basics, Networking 101 first/);
    expect(note).toHaveTextContent(/you can still go ahead and purchase now/);

    const buy = screen.getByRole("button", { name: /Pay \$79\.00/ });
    expect(buy).toBeEnabled();
    await user.click(buy);
    expect(await screen.findByTestId("checkout-pending")).toBeInTheDocument();
  });

  it("shows no note when there is nothing to recommend", async () => {
    mock.onPost("/checkout/quote").reply(200, withRecommendations([]));
    render();

    await screen.findByText("Cloud Architecture Essentials");
    expect(screen.queryByTestId("checkout-recommended-prior")).not.toBeInTheDocument();
  });
});

describe("Checkout: coupons", () => {
  it("applies a valid coupon and re-quotes the basket with it", async () => {
    mock
      .onPost("/checkout/quote")
      .replyOnce(200, quote())
      .onPost("/checkout/quote")
      .reply(200, quote({ Subtotal: 79, DiscountAmount: 19.75, Total: 59.25, CouponCode: "WELCOME25", CouponApplied: true }));
    mock.onPost("/coupons/validate").reply(200, {
      Valid: true,
      Code: "WELCOME25",
      ReasonCode: null,
      Kind: "Percentage",
      DiscountAmount: 19.75,
      Currency: "USD",
    });

    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");

    await user.type(screen.getByLabelText("Coupon code"), "welcome25");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByTestId("coupon-applied")).toHaveTextContent("Coupon WELCOME25 applied.");
    expect(screen.getByTestId("checkout-discount")).toHaveTextContent("$19.75");
    expect(screen.getByTestId("checkout-total")).toHaveTextContent("$59.25");
    const lastQuote = mock.history.post.filter((r) => r.url === "/checkout/quote").pop();
    expect(JSON.parse(lastQuote!.data).CouponCode).toBe("WELCOME25");
  });

  it("explains a rejected coupon and leaves the basket alone", async () => {
    mock.onPost("/checkout/quote").reply(200, quote());
    mock.onPost("/coupons/validate").reply(200, {
      Valid: false,
      Code: "NOPE",
      ReasonCode: "coupon.not_found",
      Kind: null,
      DiscountAmount: 0,
      Currency: "USD",
    });

    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");

    await user.type(screen.getByLabelText("Coupon code"), "nope");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByTestId("coupon-message")).toHaveTextContent("We could not find that code.");
    expect(screen.queryByTestId("coupon-applied")).not.toBeInTheDocument();
    expect(mock.history.post.filter((r) => r.url === "/checkout/quote")).toHaveLength(1);
  });

  it("removes an applied coupon and re-quotes without it", async () => {
    mock.onPost("/checkout/quote").reply(200, quote({ DiscountAmount: 19.75, Total: 59.25, CouponCode: "WELCOME25", CouponApplied: true }));
    const user = userEvent.setup();
    render("/checkout?itemType=Course&itemId=c1&coupon=WELCOME25");

    expect(await screen.findByTestId("coupon-applied")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      const last = mock.history.post.filter((r) => r.url === "/checkout/quote").pop();
      expect(JSON.parse(last!.data).CouponCode).toBeNull();
    });
  });
});

describe("Checkout: starting the payment", () => {
  it("creates the order with an Idempotency-Key and shows the pending state", async () => {
    mock.onPost("/checkout/quote").reply(200, quote());
    mock.onPost("/checkout").reply(200, session());
    mock.onGet("/orders/me/o1").reply(200, order());

    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");
    await user.click(screen.getByRole("button", { name: /Pay \$79\.00/ }));

    expect(await screen.findByTestId("checkout-pending")).toBeInTheDocument();
    const call = mock.history.post.find((r) => r.url === "/checkout")!;
    expect(call.headers?.["Idempotency-Key"]).toEqual(expect.any(String));
    expect(JSON.parse(call.data).Items).toEqual([{ ItemType: "Course", ItemId: "c1" }]);
  });

  it("shows the bank-transfer instructions and the payment reference for a manual provider", async () => {
    mock.onPost("/checkout/quote").reply(200, quote());
    mock.onPost("/checkout").reply(
      200,
      session({ Provider: "manual", RequiresManualCapture: true, Instructions: "Transfer to IBAN 123", SessionId: null })
    );
    mock.onGet("/orders/me/o1").reply(200, order({ Provider: "manual" }));

    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");
    await user.click(screen.getByRole("button", { name: /Pay \$79\.00/ }));

    expect(await screen.findByTestId("checkout-instructions")).toHaveTextContent("Transfer to IBAN 123");
    expect(screen.getByTestId("checkout-reference")).toHaveTextContent("tq_abc");
  });

  it("shows the failure without charging anything when the provider refuses", async () => {
    mock.onPost("/checkout/quote").reply(200, quote());
    mock.onPost("/checkout").reply(400, { code: "checkout.provider_failed", title: "The payment provider could not be reached." });

    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");
    await user.click(screen.getByRole("button", { name: /Pay \$79\.00/ }));

    expect(await screen.findByTestId("checkout-error")).toHaveTextContent("The payment provider could not be reached.");
    expect(screen.queryByTestId("checkout-pending")).not.toBeInTheDocument();
  });

  it("routes to the receipt once the order is paid", async () => {
    mock.onPost("/checkout/quote").reply(200, quote());
    mock.onPost("/checkout").reply(200, session());
    mock.onGet("/orders/me/o1").reply(200, order({ Status: "Paid", PaidAt: "2026-09-24T00:16:12Z" }));

    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");
    await user.click(screen.getByRole("button", { name: /Pay \$79\.00/ }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/purchases/o1"));
  });
});

describe("Checkout: the simulate-payment gate", () => {
  const startMockPayment = async (provider: string) => {
    mock.onPost("/checkout/quote").reply(200, quote());
    mock.onPost("/checkout").reply(200, session({ Provider: provider }));
    mock.onGet("/orders/me/o1").reply(200, order({ Provider: provider }));
    const user = userEvent.setup();
    render();
    await screen.findByText("Cloud Architecture Essentials");
    await user.click(screen.getByRole("button", { name: /Pay \$79\.00/ }));
    await screen.findByTestId("checkout-pending");
    return user;
  };

  it("offers it for the mock provider in a development build", async () => {
    await startMockPayment("mock");
    expect(screen.getByTestId("simulate-payment")).toBeInTheDocument();
  });

  it("never offers it for a real (non-mock) provider", async () => {
    await startMockPayment("manual");
    expect(screen.queryByTestId("simulate-payment")).not.toBeInTheDocument();
  });

  it("never offers it in a production build, even on the mock provider", async () => {
    vi.stubEnv("DEV", false);
    await startMockPayment("mock");
    expect(screen.queryByTestId("simulate-payment")).not.toBeInTheDocument();
  });

  it("simulates a successful payment and lands on the receipt", async () => {
    const user = await startMockPayment("mock");
    mock.onPost("/checkout/tq_abc/simulate").reply(200, { Outcome: "Processed", Order: { Id: "o1", Status: "Paid" } });
    mock.onGet("/orders/me/o1").reply(200, order({ Status: "Paid", PaidAt: "2026-09-24T00:16:12Z" }));

    await user.click(screen.getByRole("button", { name: "Simulate a successful payment" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/checkout/tq_abc/simulate")).toBe(true));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/purchases/o1"));
  });
});
