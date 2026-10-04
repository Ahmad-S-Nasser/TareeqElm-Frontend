import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { AuthProvider, useAuth } from "./useAuth";
import { makeUser, seedSession } from "@/test/renderWithProviders";
import { billingKeys, type CheckoutItemDto } from "./useBilling";
import {
  canSimulatePayment,
  couponReasonKey,
  newIdempotencyKey,
  useCheckoutSettings,
  useCreateCheckout,
  useQuoteCheckout,
  useSimulatePayment,
  useValidateCoupon,
} from "./useCheckout";

let mock: MockAdapter;
let queryClient: QueryClient;

const ITEMS: CheckoutItemDto[] = [{ ItemType: "Course", ItemId: "c1" }];

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

beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet("/Auth/me").reply(200, {});
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
});
afterEach(() => {
  mock.restore();
  vi.unstubAllEnvs();
});

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, createElement(AuthProvider, null, children));

const setup = async <T,>(useHook: () => T) => {
  seedSession(makeUser({ Id: "u1", Role: "Trainer", Permissions: ["checkout.self", "orders.self"] }));
  const hook = renderHook(() => ({ value: useHook(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.loading).toBe(false));
  return {
    get current() {
      return hook.result.current.value;
    },
  };
};

describe("useQuoteCheckout", () => {
  it("prices the basket through POST /checkout/quote", async () => {
    mock.onPost("/checkout/quote").reply(200, quote());
    const result = await setup(() => useQuoteCheckout(ITEMS));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.Total).toBe(79);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Items: ITEMS, CouponCode: null });
  });

  it("sends the coupon code with the basket and keys the cache by it", async () => {
    mock.onPost("/checkout/quote").reply(200, quote({ DiscountAmount: 19.75, Total: 59.25, CouponCode: "WELCOME25", CouponApplied: true }));
    const result = await setup(() => useQuoteCheckout(ITEMS, "WELCOME25"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.parse(mock.history.post[0].data).CouponCode).toBe("WELCOME25");
    expect(queryClient.getQueryData(billingKeys.checkout.quote(ITEMS, "WELCOME25"))).toBeDefined();
  });

  it("does not call the API for an empty basket", async () => {
    const result = await setup(() => useQuoteCheckout([]));
    expect(result.current.fetchStatus).toBe("idle");
    expect(mock.history.post).toHaveLength(0);
  });

  it("is never cached: the quote is refetched on every mount", async () => {
    mock.onPost("/checkout/quote").reply(200, quote());
    const first = await setup(() => useQuoteCheckout(ITEMS));
    await waitFor(() => expect(first.current.isSuccess).toBe(true));
    const second = await setup(() => useQuoteCheckout(ITEMS));
    await waitFor(() => expect(second.current.isSuccess).toBe(true));
    expect(mock.history.post.filter((r) => r.url === "/checkout/quote")).toHaveLength(2);
  });

  it("surfaces a 409 already-owned basket as an error", async () => {
    mock.onPost("/checkout/quote").reply(409, { code: "checkout.already_owned", title: "You already own this item." });
    const result = await setup(() => useQuoteCheckout(ITEMS));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateCheckout", () => {
  it("starts the payment and returns the provider session", async () => {
    mock.onPost("/checkout").reply(200, session({ Instructions: "Transfer the total", Provider: "manual" }));
    const result = await setup(() => useCreateCheckout());
    const created = await result.current.mutateAsync({ Items: ITEMS });
    expect(created.OrderId).toBe("o1");
    expect(created.Instructions).toBe("Transfer the total");
  });

  it("sends an Idempotency-Key header when one is supplied, and never as part of the body", async () => {
    mock.onPost("/checkout").reply(200, session({ Replayed: true }));
    const result = await setup(() => useCreateCheckout());
    await result.current.mutateAsync({ Items: ITEMS, idempotencyKey: "key-1" });
    const call = mock.history.post.find((r) => r.url === "/checkout")!;
    expect(call.headers?.["Idempotency-Key"]).toBe("key-1");
    expect(JSON.parse(call.data)).toEqual({ Items: ITEMS });
  });

  it("omits the header entirely when no key is supplied", async () => {
    mock.onPost("/checkout").reply(200, session());
    const result = await setup(() => useCreateCheckout());
    await result.current.mutateAsync({ Items: ITEMS });
    expect(mock.history.post.find((r) => r.url === "/checkout")!.headers?.["Idempotency-Key"]).toBeUndefined();
  });

  it("reports a refused checkout instead of swallowing it", async () => {
    mock.onPost("/checkout").reply(400, { code: "checkout.disabled", title: "Purchasing is switched off." });
    const result = await setup(() => useCreateCheckout());
    await expect(result.current.mutateAsync({ Items: ITEMS })).rejects.toBeTruthy();
  });

  it("generates a distinct idempotency key each time", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});

describe("useSimulatePayment", () => {
  it("posts to the order's providerRef with succeed=true and invalidates every billing cache", async () => {
    mock.onPost(/\/checkout\/.*\/simulate/).reply(200, { Outcome: "Processed", Order: { Id: "o1", Status: "Paid" } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const result = await setup(() => useSimulatePayment());
    const outcome = await result.current.mutateAsync({ providerRef: "tq_abc", succeed: true });

    expect(outcome.Outcome).toBe("Processed");
    const call = mock.history.post.find((r) => r.url?.includes("simulate"))!;
    expect(call.url).toBe("/checkout/tq_abc/simulate");
    expect(call.params).toEqual({ succeed: true });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: billingKeys.all }));
  });

  it("can simulate a failed payment", async () => {
    mock.onPost(/\/checkout\/.*\/simulate/).reply(200, { Outcome: "Processed", Order: { Id: "o1", Status: "Failed" } });
    const result = await setup(() => useSimulatePayment());
    await result.current.mutateAsync({ providerRef: "tq_abc", succeed: false });
    expect(mock.history.post.find((r) => r.url?.includes("simulate"))!.params).toEqual({ succeed: false });
  });
});

describe("canSimulatePayment", () => {
  it("allows the mock provider in a development build", () => {
    expect(canSimulatePayment("mock")).toBe(true);
    expect(canSimulatePayment("MOCK")).toBe(true);
  });

  it("refuses any other provider", () => {
    expect(canSimulatePayment("manual")).toBe(false);
    expect(canSimulatePayment("stripe")).toBe(false);
    expect(canSimulatePayment(null)).toBe(false);
  });

  it("refuses everything in a production build", () => {
    vi.stubEnv("DEV", false);
    expect(canSimulatePayment("mock")).toBe(false);
  });
});

describe("useValidateCoupon", () => {
  it("reports a usable coupon (HTTP 200, Valid true)", async () => {
    mock.onPost("/coupons/validate").reply(200, {
      Valid: true,
      Code: "WELCOME25",
      ReasonCode: null,
      Kind: "Percentage",
      DiscountAmount: 19.75,
      Currency: "USD",
    });
    const result = await setup(() => useValidateCoupon());
    const validation = await result.current.mutateAsync({ code: " welcome25 ", items: ITEMS });
    expect(validation.Valid).toBe(true);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Code: "welcome25", Items: ITEMS });
  });

  it("reports an unusable coupon as data, not as an error", async () => {
    mock.onPost("/coupons/validate").reply(200, {
      Valid: false,
      Code: "NOPE",
      ReasonCode: "coupon.not_found",
      Kind: null,
      DiscountAmount: 0,
      Currency: "USD",
    });
    const result = await setup(() => useValidateCoupon());
    const validation = await result.current.mutateAsync({ code: "NOPE" });
    expect(validation.Valid).toBe(false);
    expect(validation.ReasonCode).toBe("coupon.not_found");
    expect(result.current.isError).toBe(false);
  });

  it("omits an empty basket so the code can be checked on its own", async () => {
    mock.onPost("/coupons/validate").reply(200, { Valid: true, Code: "X", ReasonCode: null, Kind: null, DiscountAmount: 0, Currency: "USD" });
    const result = await setup(() => useValidateCoupon());
    await result.current.mutateAsync({ code: "X" });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Code: "X" });
  });
});

describe("couponReasonKey", () => {
  it("maps every backend reason code to its billing key", () => {
    expect(couponReasonKey("coupon.not_found")).toBe("coupon.reason.notFound");
    expect(couponReasonKey("coupon.already_used")).toBe("coupon.reason.alreadyUsed");
    expect(couponReasonKey("coupon.min_subtotal")).toBe("coupon.reason.minSubtotal");
    expect(couponReasonKey("coupon.expired")).toBe("coupon.reason.expired");
  });

  it("falls back to the generic sentence for anything unrecognised", () => {
    expect(couponReasonKey("coupon.something_new")).toBe("coupon.reason.default");
    expect(couponReasonKey(null)).toBe("coupon.reason.default");
    expect(couponReasonKey("")).toBe("coupon.reason.default");
  });
});

describe("useCheckoutSettings", () => {
  it("reads the billing slice of GET /api/Settings", async () => {
    mock.onGet("/Settings").reply(200, {
      Currency: "jod",
      CheckoutEnabled: true,
      RefundWindowDays: 30,
      DefaultPaymentProvider: null,
    });
    const result = await setup(() => useCheckoutSettings());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      Currency: "JOD",
      CheckoutEnabled: true,
      RefundWindowDays: 30,
      DefaultPaymentProvider: null,
      PackageTiers: [],
    });
  });

  it("treats a hidden checkout switch as enabled rather than locking the buyer out", async () => {
    mock.onGet("/Settings").reply(200, { Currency: "USD" });
    const result = await setup(() => useCheckoutSettings());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.CheckoutEnabled).toBe(true);
  });

  it("carries the package tier catalog through unchanged", async () => {
    const tiers = [{ Tier: "package1", Name: "Package 1", Cap: 500, Price: null }];
    mock.onGet("/Settings").reply(200, { Currency: "USD", PackageTiers: tiers });
    const result = await setup(() => useCheckoutSettings());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.PackageTiers).toEqual(tiers);
  });
});
