import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { AuthProvider, useAuth } from "./useAuth";
import { makeUser, seedSession } from "@/test/renderWithProviders";
import { useEarningsLedgerQuery, useEarningsSummaryQuery, useInstructorPayoutsQuery } from "./useEarnings";

let mock: MockAdapter;
let queryClient: QueryClient;

beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet("/Auth/me").reply(200, {});
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
});
afterEach(() => mock.restore());

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, createElement(AuthProvider, null, children));

const summary = {
  Pending: 81.01,
  Available: 0,
  Paid: 0,
  Reversed: 0,
  LifetimeGross: 115.74,
  LifetimeNet: 81.01,
  Currency: "USD",
  CommissionRate: 0.3,
};

const earning = (overrides: Record<string, unknown> = {}) => ({
  Id: "e1",
  OrderId: "o1",
  OrderLineId: "l1",
  ItemType: "Course",
  ItemId: "c1",
  Title: "Cloud Architecture Essentials",
  ResolvedTitle: "Cloud Architecture Essentials",
  CourseId: "c1",
  CourseTitle: "Cloud Architecture Essentials",
  BuyerCount: 1,
  Currency: "USD",
  GrossAmount: 59.25,
  CommissionRate: 0.3,
  PlatformFeeAmount: 17.78,
  NetAmount: 41.47,
  Kind: "Sale",
  Status: "Pending",
  ReversalOfEarningId: null,
  AvailableAt: "2026-10-08T00:16:12.49Z",
  OccurredAt: "2026-09-24T00:16:12.49Z",
  PayoutId: null,
  ...overrides,
});

const setup = async <T,>(useHook: () => T) => {
  seedSession(makeUser({ Id: "ins-1", Role: "Instructor", Permissions: ["earnings.self"] }));
  const hook = renderHook(() => ({ value: useHook(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.loading).toBe(false));
  return {
    get current() {
      return hook.result.current.value;
    },
  };
};

describe("useEarningsSummaryQuery", () => {
  it("reads the caller-scoped summary without ever sending an instructor id", async () => {
    mock.onGet("/instructor/earnings/summary").reply(200, summary);
    const hook = await setup(() => useEarningsSummaryQuery());
    await waitFor(() => expect(hook.current.data?.LifetimeNet).toBe(81.01));

    const call = mock.history.get.find((r) => r.url === "/instructor/earnings/summary")!;
    expect(JSON.stringify(call.params ?? {})).not.toMatch(/instructorId/i);
  });

  it("passes the date window through", async () => {
    mock.onGet("/instructor/earnings/summary").reply(200, summary);
    const hook = await setup(() => useEarningsSummaryQuery({ from: "2026-09-01", to: "2026-09-30" }));
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    const call = mock.history.get.find((r) => r.url === "/instructor/earnings/summary")!;
    expect(call.params).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("surfaces a load failure", async () => {
    mock.onGet("/instructor/earnings/summary").reply(500);
    const hook = await setup(() => useEarningsSummaryQuery());
    await waitFor(() => expect(hook.current.isError).toBe(true));
  });
});

describe("useEarningsLedgerQuery", () => {
  it("returns the rows plus the X-Total-Count total", async () => {
    mock.onGet("/instructor/earnings").reply(200, [earning()], { "x-total-count": "42" });
    const hook = await setup(() => useEarningsLedgerQuery());
    await waitFor(() => expect(hook.current.data?.items).toHaveLength(1));
    expect(hook.current.data?.total).toBe(42);
    expect(hook.current.data?.items[0].CourseTitle).toBe("Cloud Architecture Essentials");
  });

  it("sends the status filter and paging", async () => {
    mock.onGet("/instructor/earnings").reply(200, [], { "x-total-count": "0" });
    const hook = await setup(() => useEarningsLedgerQuery({ status: "Available", page: 3, pageSize: 5 }));
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    expect(mock.history.get.find((r) => r.url === "/instructor/earnings")?.params).toMatchObject({
      status: "Available",
      page: 3,
      pageSize: 5,
    });
  });

  it("keeps reversal rows negative rather than normalising them", async () => {
    mock
      .onGet("/instructor/earnings")
      .reply(200, [earning({ Id: "e2", Kind: "Reversal", Status: "Reversed", NetAmount: -55.3, BuyerCount: -1 })], {
        "x-total-count": "1",
      });
    const hook = await setup(() => useEarningsLedgerQuery());
    await waitFor(() => expect(hook.current.data?.items).toHaveLength(1));
    expect(hook.current.data?.items[0].NetAmount).toBe(-55.3);
  });

  it("carries no buyer-identifying field in its row type", async () => {
    mock.onGet("/instructor/earnings").reply(200, [earning()], { "x-total-count": "1" });
    const hook = await setup(() => useEarningsLedgerQuery());
    await waitFor(() => expect(hook.current.data?.items).toHaveLength(1));
    // The contract is "what sold", never "who bought it": the only buyer-shaped field is a signed count.
    expect(Object.keys(hook.current.data!.items[0])).not.toContain("BuyerId");
    expect(Object.keys(hook.current.data!.items[0])).not.toContain("BuyerName");
    expect(Object.keys(hook.current.data!.items[0])).not.toContain("BuyerEmail");
    expect(hook.current.data!.items[0].BuyerCount).toBe(1);
  });
});

describe("useInstructorPayoutsQuery", () => {
  it("reads the caller's own payouts with their total", async () => {
    mock.onGet("/instructor/payouts").reply(
      200,
      [
        {
          Id: "p1",
          Currency: "USD",
          Amount: 120,
          EarningCount: 3,
          PeriodStart: "2026-08-01T00:00:00Z",
          PeriodEnd: "2026-08-31T00:00:00Z",
          Status: "Paid",
          Method: "BankTransfer",
          Reference: "TRX-9",
          Notes: null,
          CreatedAt: "2026-09-01T00:00:00Z",
          ApprovedAt: null,
          PaidAt: "2026-09-02T00:00:00Z",
          CancelledAt: null,
        },
      ],
      { "x-total-count": "1" }
    );
    const hook = await setup(() => useInstructorPayoutsQuery());
    await waitFor(() => expect(hook.current.data?.items).toHaveLength(1));
    expect(hook.current.data?.items[0].Reference).toBe("TRX-9");
    expect(hook.current.data?.total).toBe(1);
  });

  it("surfaces a load failure", async () => {
    mock.onGet("/instructor/payouts").reply(500);
    const hook = await setup(() => useInstructorPayoutsQuery());
    await waitFor(() => expect(hook.current.isError).toBe(true));
  });
});
