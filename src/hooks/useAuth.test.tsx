import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { AuthProvider, useAuth } from "./useAuth";
import { EXPIRY_KEY, makeUser, seedSession, TOKEN_KEY, USER_KEY } from "@/test/renderWithProviders";

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
});
afterEach(() => {
  mock.restore();
  vi.restoreAllMocks();
});

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const renderAuth = async () => {
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

const loginResponse = (role: string) => ({
  Token: "jwt-1",
  ExpiresAt: "2999-01-01T00:00:00Z",
  User: makeUser({ Role: role }),
});

describe("useAuth", () => {
  it("signIn stores the three keys and sets the role", async () => {
    mock.onPost("/Auth/login").reply(200, loginResponse("Instructor"));
    const { result } = await renderAuth();

    let outcome: { error: Error | null } | undefined;
    await act(async () => {
      outcome = await result.current.signIn("a@b.c", "pw");
    });

    expect(outcome?.error).toBeNull();
    expect(mock.history.post[0].data).toBe(JSON.stringify({ Email: "a@b.c", Password: "pw" }));
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-1");
    expect(localStorage.getItem(EXPIRY_KEY)).toBe("2999-01-01T00:00:00Z");
    expect(JSON.parse(localStorage.getItem(USER_KEY) ?? "{}").Email).toBe("test@tareeqelm.com");
    expect(result.current.role).toBe("instructor");
    expect(result.current.user?.Id).toBe("user-1");
  });

  it("signIn returns the API error and stores nothing on failure", async () => {
    mock.onPost("/Auth/login").reply(401, "Invalid email or password");
    const { result } = await renderAuth();

    let outcome: { error: Error | null } | undefined;
    await act(async () => {
      outcome = await result.current.signIn("a@b.c", "bad");
    });

    expect(outcome?.error?.message).toBe("Invalid email or password");
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("an unknown Role from the API yields role null", async () => {
    mock.onPost("/Auth/login").reply(200, loginResponse("Wizard"));
    const { result } = await renderAuth();
    await act(async () => {
      await result.current.signIn("a@b.c", "pw");
    });
    expect(result.current.user).not.toBeNull();
    expect(result.current.role).toBeNull();
  });

  it("signUp sends no role and signs the user in", async () => {
    mock.onPost("/Auth/register").reply(200, loginResponse("Trainer"));
    const { result } = await renderAuth();
    await act(async () => {
      await result.current.signUp("a@b.c", "pw", "New Person");
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Email: "a@b.c", Password: "pw", FullName: "New Person" });
    expect(result.current.role).toBe("applicant");
  });

  it("signOut clears the session keys and per-user data", async () => {
    seedSession(makeUser(), { expiresAt: "2999-01-01T00:00:00Z" });
    localStorage.setItem("chat_history_user-1", "[]");
    localStorage.setItem("achievements_user-1", "{}");
    localStorage.setItem("theme", "dark");
    const { result } = await renderAuth();
    expect(result.current.user).not.toBeNull();

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    for (const key of [TOKEN_KEY, USER_KEY, EXPIRY_KEY, "chat_history_user-1", "achievements_user-1"]) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("restores a valid stored session on load", async () => {
    seedSession(makeUser({ Role: "Admin" }), { expiresAt: "2999-01-01T00:00:00Z" });
    const { result } = await renderAuth();
    expect(result.current.role).toBe("admin");
  });

  it("drops an expired stored session on load", async () => {
    seedSession(makeUser(), { expiresAt: "2000-01-01T00:00:00Z" });
    const { result } = await renderAuth();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it("drops a corrupt stored user on load", async () => {
    localStorage.setItem(TOKEN_KEY, "t");
    localStorage.setItem(USER_KEY, "{not json");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = await renderAuth();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it("a 401 from a normal API call signs the user out via the unauthorized handler", async () => {
    seedSession(makeUser(), { expiresAt: "2999-01-01T00:00:00Z" });
    mock.onGet("/Courses").reply(401);
    const { result } = await renderAuth();
    expect(result.current.user).not.toBeNull();

    await act(async () => {
      await api.get("/Courses").catch(() => undefined);
    });

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("updateUser merges FullName/AvatarUrl into state and storage", async () => {
    seedSession(makeUser({ FullName: "Old Name" }));
    const { result } = await renderAuth();

    act(() => result.current.updateUser({ FullName: "New Name", AvatarUrl: "/img/a.png" }));

    expect(result.current.user).toMatchObject({ FullName: "New Name", AvatarUrl: "/img/a.png", Email: "test@tareeqelm.com" });
    const stored = JSON.parse(localStorage.getItem(USER_KEY) ?? "{}");
    expect(stored).toMatchObject({ FullName: "New Name", AvatarUrl: "/img/a.png", Id: "user-1" });
  });

  it("useAuth throws outside an AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
