import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { AuthProvider, useAuth } from "./useAuth";
import { makeUser, seedSession } from "@/test/renderWithProviders";
import {
  pricingKeys,
  useCatalogCoursesQuery,
  useCourseChaptersQuery,
  useSetChapterPricing,
  useSetCoursePricing,
} from "./usePricing";

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

const course = (overrides: Record<string, unknown> = {}) => ({
  Id: "c1",
  Title: "Cloud Architecture Essentials",
  Description: null,
  Category: "Cloud",
  Level: "Intermediate",
  ImageUrl: null,
  InstructorId: "i1",
  InstructorName: "Instructor One",
  Status: "Published",
  LessonsCount: 6,
  EnrolledCount: 1,
  AccessModel: "AlaCarte",
  RequiresApproval: false,
  Pricing: {
    IsFree: false,
    Amount: 79,
    EffectiveAmount: 79,
    CompareAtAmount: null,
    SaleAmount: null,
    SaleStartsAt: null,
    SaleEndsAt: null,
    Currency: "USD",
    OnSale: false,
  },
  Owned: false,
  HasChapterPricing: true,
  ...overrides,
});

/** Signs a user in (Organization + pricing.manage by default) and renders the hook once auth has settled. */
const setup = async <T,>(useHook: () => T, permissions: string[] = ["pricing.manage"]) => {
  seedSession(makeUser({ Id: "org-1", Role: "Organization", Permissions: permissions }));
  const hook = renderHook(() => ({ value: useHook(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.loading).toBe(false));
  return {
    get current() {
      return hook.result.current.value;
    },
  };
};

describe("pricingKeys", () => {
  it("nests under the shared billing prefix so billingKeys.all invalidates them too", () => {
    expect(pricingKeys.catalog()[0]).toBe("billing");
    expect(pricingKeys.chapters("c1")[0]).toBe("billing");
  });

  it("keeps absent filters as stable key segments", () => {
    expect(pricingKeys.catalog()).toEqual(["billing", "pricing", "catalog", "", "", 1, 100]);
    expect(pricingKeys.chapters(null)).toEqual(["billing", "pricing", "chapters", ""]);
  });
});

describe("useCatalogCoursesQuery", () => {
  it("reads GET /Courses and keeps the server's pricing shape", async () => {
    mock.onGet("/Courses").reply(200, [course()]);
    const hook = await setup(() => useCatalogCoursesQuery());
    await waitFor(() => expect(hook.current.data).toHaveLength(1));
    expect(hook.current.data?.[0].Pricing?.EffectiveAmount).toBe(79);
    expect(hook.current.data?.[0].HasChapterPricing).toBe(true);
  });

  it("passes the status filter through to the server", async () => {
    mock.onGet("/Courses").reply(200, []);
    const hook = await setup(() => useCatalogCoursesQuery({ status: "Draft" }));
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    expect(mock.history.get.find((r) => r.url === "/Courses")?.params?.status).toBe("Draft");
  });

  it("surfaces a load failure", async () => {
    mock.onGet("/Courses").reply(500);
    const hook = await setup(() => useCatalogCoursesQuery());
    await waitFor(() => expect(hook.current.isError).toBe(true));
  });
});

describe("useCourseChaptersQuery", () => {
  it("stays idle without a course id", async () => {
    const hook = await setup(() => useCourseChaptersQuery(null));
    expect(hook.current.fetchStatus).toBe("idle");
    expect(mock.history.get.some((r) => r.url?.includes("/curriculum"))).toBe(false);
  });

  it("reads the course's curriculum with its per-chapter pricing", async () => {
    mock.onGet("/Courses/c1/curriculum").reply(200, [
      { Id: "ch1", Title: "Cloud foundations", Description: null, OrderIndex: 0, Lessons: [], Pricing: null, IsPreview: true },
      {
        Id: "ch2",
        Title: "Designing for failure",
        Description: null,
        OrderIndex: 1,
        Lessons: [],
        Pricing: { IsFree: false, Amount: 19, EffectiveAmount: 19, CompareAtAmount: null, SaleAmount: null, SaleStartsAt: null, SaleEndsAt: null, Currency: "USD", OnSale: false },
        IsPreview: false,
      },
    ]);
    const hook = await setup(() => useCourseChaptersQuery("c1"));
    await waitFor(() => expect(hook.current.data).toHaveLength(2));
    expect(hook.current.data?.[1].Pricing?.Amount).toBe(19);
    expect(hook.current.data?.[0].IsPreview).toBe(true);
  });
});

describe("useSetCoursePricing", () => {
  it("PUTs the price to /Courses/{id}/pricing and invalidates the billing caches", async () => {
    mock.onGet("/Courses").reply(200, [course()]);
    mock.onPut("/Courses/c1/pricing").reply(204);
    const hook = await setup(() => ({
      save: useSetCoursePricing(),
      list: useCatalogCoursesQuery(),
    }));
    await waitFor(() => expect(hook.current.list.data).toHaveLength(1));
    const before = mock.history.get.filter((r) => r.url === "/Courses").length;

    await hook.current.save.mutateAsync({
      courseId: "c1",
      body: { IsFree: false, Amount: 99, Currency: "USD", AccessModel: "AlaCarte" },
    });

    const put = mock.history.put.find((r) => r.url === "/Courses/c1/pricing");
    expect(JSON.parse(put!.data)).toMatchObject({ IsFree: false, Amount: 99, AccessModel: "AlaCarte" });
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === "/Courses").length).toBeGreaterThan(before));
  });

  it("rejects with the server's pricing.invalid problem so the caller can show it", async () => {
    mock.onPut("/Courses/c1/pricing").reply(400, { code: "pricing.invalid", title: "That price is not valid." });
    const hook = await setup(() => useSetCoursePricing());
    await expect(
      hook.current.mutateAsync({ courseId: "c1", body: { IsFree: false, Amount: 0 } })
    ).rejects.toBeTruthy();
  });
});

describe("useSetChapterPricing", () => {
  it("PUTs to the nested chapter route", async () => {
    mock.onPut("/Courses/c1/chapters/ch2/pricing").reply(204);
    const hook = await setup(() => useSetChapterPricing());
    await hook.current.mutateAsync({
      courseId: "c1",
      chapterId: "ch2",
      body: { IsFree: false, Amount: 19, SaleAmount: null, IsPreview: false },
    });
    const put = mock.history.put.find((r) => r.url === "/Courses/c1/chapters/ch2/pricing");
    expect(JSON.parse(put!.data)).toMatchObject({ IsFree: false, Amount: 19, IsPreview: false });
  });

  it("rejects with pricing.not_allowed on a course that is not à-la-carte", async () => {
    mock
      .onPut("/Courses/free-1/chapters/ch1/pricing")
      .reply(400, { code: "pricing.not_allowed", title: "This course is free, so its chapters cannot be priced." });
    const hook = await setup(() => useSetChapterPricing());
    await expect(
      hook.current.mutateAsync({
        courseId: "free-1",
        chapterId: "ch1",
        body: { IsFree: false, Amount: 5, IsPreview: false },
      })
    ).rejects.toBeTruthy();
  });
});
