import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { AuthProvider, useAuth } from "./useAuth";
import { makeUser, seedSession } from "@/test/renderWithProviders";
import { billingKeys } from "./useBilling";
import {
  isTrackInUseError,
  useCreateTrack,
  useDeleteTrack,
  useSetTrackCourses,
  useSetTrackPricing,
  useTrackQuery,
  useTracksQuery,
  useUpdateTrack,
} from "./useTracks";

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

const pricing = (overrides: Record<string, unknown> = {}) => ({
  IsFree: false,
  Amount: 99,
  EffectiveAmount: 99,
  CompareAtAmount: null,
  SaleAmount: null,
  SaleStartsAt: null,
  SaleEndsAt: null,
  Currency: "USD",
  OnSale: false,
  ...overrides,
});

/** The seeded "Data Professional Path": two paid courses bundled at $99. */
const track = (overrides: Record<string, unknown> = {}) => ({
  Id: "t1",
  Title: "Data Professional Path",
  Description: "Both paid courses as one path, cheaper than buying them separately.",
  ImageUrl: null,
  Status: "Published",
  CoursesCount: 2,
  Pricing: pricing(),
  IsFeatured: true,
  EstimatedHours: 24,
  DepartmentId: null,
  DepartmentName: null,
  OwnerInstructorId: null,
  OwnerInstructorName: null,
  Owned: false,
  CreatedAt: "2026-09-20T00:00:00Z",
  ...overrides,
});

const trackDetail = {
  ...track(),
  Courses: [
    {
      Id: "c1",
      Title: "Cloud Architecture Essentials",
      InstructorId: "i1",
      InstructorName: "Instructor One",
      Status: "Published",
      AccessModel: "AlaCarte",
      Pricing: pricing({ Amount: 79, EffectiveAmount: 79 }),
      Owned: false,
      Order: 0,
    },
    {
      Id: "c2",
      Title: "Data Foundations",
      InstructorId: "i1",
      InstructorName: "Instructor One",
      Status: "Published",
      AccessModel: "AlaCarte",
      Pricing: pricing({ Amount: 49.99, EffectiveAmount: 49.99 }),
      Owned: false,
      Order: 1,
    },
  ],
};

/** Signs a user in (Organization, holding both track permissions by default) and waits for auth to settle. */
const setup = async <T,>(useHook: () => T, permissions: string[] = ["tracks.manage", "pricing.manage"]) => {
  seedSession(makeUser({ Id: "org-1", Role: "Organization", Permissions: permissions }));
  const hook = renderHook(() => ({ value: useHook(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.loading).toBe(false));
  return {
    get current() {
      return hook.result.current.value;
    },
  };
};

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
    throw new Error("expected the mutation to reject");
  } catch (error) {
    return error;
  }
};

describe("billingKeys.tracks", () => {
  it("nests under the shared billing prefix so billingKeys.all invalidates them too", () => {
    expect(billingKeys.tracks.list()[0]).toBe("billing");
    expect(billingKeys.tracks.detail("t1")[0]).toBe("billing");
  });
});

describe("useTracksQuery", () => {
  it("reads GET /tracks and takes the total from X-Total-Count, not the page length", async () => {
    mock.onGet("/tracks").reply(200, [track()], { "x-total-count": "7" });
    const hook = await setup(() => useTracksQuery());
    await waitFor(() => expect(hook.current.data?.items).toHaveLength(1));
    expect(hook.current.data?.total).toBe(7);
    expect(hook.current.data?.items[0].Pricing?.EffectiveAmount).toBe(99);
    expect(hook.current.data?.items[0].CoursesCount).toBe(2);
  });

  it("falls back to the row count when the server sends no total", async () => {
    mock.onGet("/tracks").reply(200, [track()]);
    const hook = await setup(() => useTracksQuery());
    await waitFor(() => expect(hook.current.data?.total).toBe(1));
  });

  it("passes status, search and paging through to the server", async () => {
    mock.onGet("/tracks").reply(200, []);
    const hook = await setup(() => useTracksQuery({ status: "Draft", search: "  data  ", page: 2, pageSize: 5 }));
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    expect(mock.history.get.find((r) => r.url === "/tracks")?.params).toMatchObject({
      status: "Draft",
      search: "data",
      page: 2,
      pageSize: 5,
    });
  });

  it("omits empty filters rather than sending blank strings", async () => {
    mock.onGet("/tracks").reply(200, []);
    const hook = await setup(() => useTracksQuery({ status: "", search: "   " }));
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    const params = mock.history.get.find((r) => r.url === "/tracks")?.params as Record<string, unknown>;
    expect(params.status).toBeUndefined();
    expect(params.search).toBeUndefined();
    expect(params.pageSize).toBe(20);
  });

  it("surfaces a load failure", async () => {
    mock.onGet("/tracks").reply(500);
    const hook = await setup(() => useTracksQuery());
    await waitFor(() => expect(hook.current.isError).toBe(true));
  });
});

describe("useTrackQuery", () => {
  it("stays idle without a track id", async () => {
    const hook = await setup(() => useTrackQuery(null));
    expect(hook.current.fetchStatus).toBe("idle");
    expect(mock.history.get.some((r) => r.url?.startsWith("/tracks/"))).toBe(false);
  });

  it("reads the detail with its ordered courses and resolved names", async () => {
    mock.onGet("/tracks/t1").reply(200, trackDetail);
    const hook = await setup(() => useTrackQuery("t1"));
    await waitFor(() => expect(hook.current.data?.Courses).toHaveLength(2));
    expect(hook.current.data?.Courses.map((c) => c.Id)).toEqual(["c1", "c2"]);
    expect(hook.current.data?.Courses[0].Title).toBe("Cloud Architecture Essentials");
    expect(hook.current.data?.Courses[0].InstructorName).toBe("Instructor One");
  });
});

describe("useCreateTrack", () => {
  it("POSTs to /tracks and returns the created track", async () => {
    mock.onPost("/tracks").reply(201, trackDetail);
    const hook = await setup(() => useCreateTrack());
    const created = await hook.current.mutateAsync({ Title: "Data Professional Path", Status: "Draft" });
    expect(created.Id).toBe("t1");
    expect(JSON.parse(mock.history.post.at(-1)!.data)).toMatchObject({
      Title: "Data Professional Path",
      Status: "Draft",
    });
  });

  it("rejects with the server's track.invalid problem so the caller can show it", async () => {
    mock.onPost("/tracks").reply(400, { code: "track.invalid", title: "Use a title of 2 to 200 characters." });
    const hook = await setup(() => useCreateTrack());
    await expect(hook.current.mutateAsync({ Title: "x" })).rejects.toBeTruthy();
  });
});

describe("useUpdateTrack", () => {
  it("PUTs to /tracks/{id} and refreshes the list", async () => {
    mock.onGet("/tracks").reply(200, [track()], { "x-total-count": "1" });
    mock.onPut("/tracks/t1").reply(204);
    const hook = await setup(() => ({ save: useUpdateTrack(), list: useTracksQuery() }));
    await waitFor(() => expect(hook.current.list.data?.items).toHaveLength(1));
    const before = mock.history.get.filter((r) => r.url === "/tracks").length;

    await hook.current.save.mutateAsync({ id: "t1", body: { Title: "Data Professional Path", Status: "Archived" } });

    expect(JSON.parse(mock.history.put.at(-1)!.data)).toMatchObject({
      Title: "Data Professional Path",
      Status: "Archived",
    });
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === "/tracks").length).toBeGreaterThan(before));
  });
});

describe("useSetTrackCourses", () => {
  it("PUTs the complete ordered list — which is how a reorder is expressed", async () => {
    mock.onPut("/tracks/t1/courses").reply(204);
    const hook = await setup(() => useSetTrackCourses());
    await hook.current.mutateAsync({ id: "t1", courseIds: ["c2", "c1"] });
    const put = mock.history.put.find((r) => r.url === "/tracks/t1/courses");
    expect(JSON.parse(put!.data)).toEqual({ CourseIds: ["c2", "c1"] });
  });

  it("can empty the bundle", async () => {
    mock.onPut("/tracks/t1/courses").reply(204);
    const hook = await setup(() => useSetTrackCourses());
    await hook.current.mutateAsync({ id: "t1", courseIds: [] });
    expect(JSON.parse(mock.history.put.at(-1)!.data)).toEqual({ CourseIds: [] });
  });
});

describe("useSetTrackPricing", () => {
  it("PUTs a PricingUpdateDto — no access model, a track does not have one", async () => {
    mock.onPut("/tracks/t1/pricing").reply(204);
    const hook = await setup(() => useSetTrackPricing());
    await hook.current.mutateAsync({ id: "t1", body: { IsFree: false, Amount: 129, Currency: "USD" } });
    const put = mock.history.put.find((r) => r.url === "/tracks/t1/pricing");
    const body = JSON.parse(put!.data);
    expect(body).toMatchObject({ IsFree: false, Amount: 129, Currency: "USD" });
    expect(body).not.toHaveProperty("AccessModel");
  });

  it("rejects with pricing.invalid when the server refuses the price", async () => {
    mock.onPut("/tracks/t1/pricing").reply(400, { code: "pricing.invalid", title: "That price is not valid." });
    const hook = await setup(() => useSetTrackPricing());
    await expect(hook.current.mutateAsync({ id: "t1", body: { IsFree: false, Amount: 0 } })).rejects.toBeTruthy();
  });
});

describe("useDeleteTrack", () => {
  it("DELETEs the track and refreshes the list", async () => {
    mock.onGet("/tracks").reply(200, [track()], { "x-total-count": "1" });
    mock.onDelete("/tracks/t1").reply(204);
    const hook = await setup(() => ({ remove: useDeleteTrack(), list: useTracksQuery() }));
    await waitFor(() => expect(hook.current.list.data?.items).toHaveLength(1));
    const before = mock.history.get.filter((r) => r.url === "/tracks").length;

    await hook.current.remove.mutateAsync("t1");

    expect(mock.history.delete.at(-1)?.url).toBe("/tracks/t1");
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === "/tracks").length).toBeGreaterThan(before));
  });

  it("surfaces a 409 track.in_use as its own recognisable rule, not a generic failure", async () => {
    mock.onDelete("/tracks/t1").reply(409, {
      code: "track.in_use",
      title: "This track was already bought and cannot be deleted.",
    });
    const hook = await setup(() => useDeleteTrack());
    const error = await rejection(hook.current.mutateAsync("t1"));
    expect(isTrackInUseError(error)).toBe(true);
  });

  it("does not mistake an ordinary failure for the in-use rule", async () => {
    mock.onDelete("/tracks/t1").reply(500);
    const hook = await setup(() => useDeleteTrack());
    const error = await rejection(hook.current.mutateAsync("t1"));
    expect(isTrackInUseError(error)).toBe(false);
  });
});

describe("isTrackInUseError", () => {
  it("accepts a bare 409 from this route, which can only be that rule", async () => {
    mock.onDelete("/tracks/t1").reply(409);
    const hook = await setup(() => useDeleteTrack());
    expect(isTrackInUseError(await rejection(hook.current.mutateAsync("t1")))).toBe(true);
  });

  it("rejects a 409 that carries a different code", async () => {
    mock.onDelete("/tracks/t1").reply(409, { code: "conflict", title: "Something else." });
    const hook = await setup(() => useDeleteTrack());
    expect(isTrackInUseError(await rejection(hook.current.mutateAsync("t1")))).toBe(false);
  });

  it("rejects anything that is not an axios failure", () => {
    expect(isTrackInUseError(new Error("boom"))).toBe(false);
    expect(isTrackInUseError(null)).toBe(false);
  });
});
