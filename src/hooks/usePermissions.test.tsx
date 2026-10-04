import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { AuthProvider, useAuth } from "./useAuth";
import { usePermissions } from "./usePermissions";
import { Can } from "@/components/routing/Can";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { makeUser, seedSession, USER_KEY } from "@/test/renderWithProviders";

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(api); });
afterEach(() => mock.restore());

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("permission helpers", () => {
  it("fail closed on missing lists", () => {
    expect(hasPermission(undefined, "users.manage")).toBe(false);
    expect(hasPermission(["users.manage"], "users.manage")).toBe(true);
    expect(hasAnyPermission(["a"], ["b", "a"])).toBe(true);
    expect(hasAnyPermission(["a"], ["b"])).toBe(false);
    expect(hasAnyPermission(undefined, [])).toBe(true);
  });
});

describe("usePermissions / Can", () => {
  it("reads the stored permissions", async () => {
    seedSession(makeUser({ Role: "Instructor", Permissions: ["courses.write"] }));
    mock.onGet("/Auth/me").reply(200, makeUser({ Role: "Instructor", Permissions: ["courses.write"] }));
    const { result } = renderHook(() => usePermissions(), { wrapper });
    await waitFor(() => expect(result.current.can("courses.write")).toBe(true));
    expect(result.current.can("users.manage")).toBe(false);
    expect(result.current.canAny("users.manage", "courses.write")).toBe(true);
  });

  it("refreshes permissions from GET /Auth/me on load and persists them", async () => {
    seedSession(makeUser({ Role: "Organization", Permissions: ["exams.view"] }));
    mock.onGet("/Auth/me").reply(200, makeUser({ Role: "Organization", Permissions: ["exams.view", "content.manage"], CustomRoleName: "Reviewer" }));
    const { result } = renderHook(() => ({ p: usePermissions(), a: useAuth() }), { wrapper });
    await waitFor(() => expect(result.current.p.can("content.manage")).toBe(true));
    expect(result.current.a.user?.CustomRoleName).toBe("Reviewer");
    expect(JSON.parse(localStorage.getItem(USER_KEY) ?? "{}").Permissions).toContain("content.manage");
  });

  it("keeps the stored session when /Auth/me fails", async () => {
    seedSession(makeUser({ Permissions: ["quizzes.take"] }));
    mock.onGet("/Auth/me").networkError();
    const { result } = renderHook(() => usePermissions(), { wrapper });
    await waitFor(() => expect(result.current.can("quizzes.take")).toBe(true));
  });

  it("<Can> renders children only with the permission, else the fallback", async () => {
    seedSession(makeUser({ Permissions: ["users.manage"] }));
    mock.onGet("/Auth/me").reply(200, makeUser({ Permissions: ["users.manage"] }));
    render(
      <AuthProvider>
        <Can permission="users.manage"><span>yes</span></Can>
        <Can permission="roles.manage" fallback={<span>no</span>}><span>hidden</span></Can>
        <Can permission={["roles.manage", "users.manage"]}><span>any</span></Can>
      </AuthProvider>
    );
    expect(await screen.findByText("yes")).toBeInTheDocument();
    expect(screen.getByText("no")).toBeInTheDocument();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
    expect(screen.getByText("any")).toBeInTheDocument();
  });
});
