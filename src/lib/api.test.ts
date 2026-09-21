import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MockAdapter from "axios-mock-adapter";
import api, { getApiError, setUnauthorizedHandler } from "./api";

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  setUnauthorizedHandler(null);
});

const failWith = async (status: number, body?: unknown) => {
  mock.onGet("/x").reply(status, body);
  try {
    await api.get("/x");
  } catch (e) {
    return e;
  }
  throw new Error("expected request to fail");
};

describe("getApiError", () => {
  it("returns a plain string body", async () => {
    expect(getApiError(await failWith(400, "Email already in use"))).toBe("Email already in use");
  });

  it("prefers ProblemDetails detail over title", async () => {
    const err = await failWith(400, { title: "Bad Request", detail: "Title is required" });
    expect(getApiError(err)).toBe("Title is required");
  });

  it("falls back to ProblemDetails title", async () => {
    expect(getApiError(await failWith(400, { title: "Invalid course" }))).toBe("Invalid course");
  });

  it("returns the first validation error", async () => {
    const err = await failWith(400, { title: "Validation", errors: { Email: ["Email is invalid", "x"], Name: ["y"] } });
    expect(getApiError(err)).toBe("Email is invalid");
  });

  it("maps 403, 429 and 5xx to friendly messages regardless of body", async () => {
    expect(getApiError(await failWith(403, "nope"))).toMatch(/permission/i);
    expect(getApiError(await failWith(429, "slow"))).toMatch(/too many/i);
    expect(getApiError(await failWith(500, "boom"))).toMatch(/server ran into a problem/i);
    expect(getApiError(await failWith(503))).toMatch(/server ran into a problem/i);
  });

  it("maps empty 404 and 409 to friendly messages", async () => {
    expect(getApiError(await failWith(404))).toMatch(/could not find/i);
    expect(getApiError(await failWith(409))).toMatch(/conflicts/i);
  });

  it("uses the server's message for 404/409 when one is provided", async () => {
    expect(getApiError(await failWith(409, "Already enrolled"))).toBe("Already enrolled");
  });

  it("reports a network failure when there is no response", async () => {
    mock.onGet("/x").networkError();
    const err = await api.get("/x").catch((e: unknown) => e);
    expect(getApiError(err)).toMatch(/cannot reach the server/i);
  });

  it("uses the message of a non-axios Error", () => {
    expect(getApiError(new Error("boom"))).toBe("boom");
  });

  it("uses the fallback for unknown values and empty bodies", async () => {
    expect(getApiError("weird", "fallback text")).toBe("fallback text");
    expect(getApiError(null)).toMatch(/something went wrong/i);
    expect(getApiError(await failWith(400), "fallback text")).toBe("fallback text");
  });
});

describe("api interceptors", () => {
  it("adds the Bearer token from storage", async () => {
    localStorage.setItem("tareeqelm_token", "abc123");
    mock.onGet("/things").reply(200, []);
    await api.get("/things");
    expect(mock.history.get[0].headers?.Authorization).toBe("Bearer abc123");
  });

  it("sends no Authorization header without a token", async () => {
    mock.onGet("/things").reply(200, []);
    await api.get("/things");
    expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
  });

  it("invokes the unauthorized handler on a 401 from a normal call", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mock.onGet("/Courses").reply(401);
    await expect(api.get("/Courses")).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not invoke the handler for a 401 on /Auth/ calls", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mock.onPost("/Auth/login").reply(401, "Invalid credentials");
    await expect(api.post("/Auth/login", {})).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not invoke the handler for non-401 errors", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mock.onGet("/Courses").reply(403);
    await expect(api.get("/Courses")).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });
});
