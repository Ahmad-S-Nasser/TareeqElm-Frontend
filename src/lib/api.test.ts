import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MockAdapter from "axios-mock-adapter";
import api, { getApiError, setUnauthorizedHandler } from "./api";
import i18n from "@/i18n";

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

  describe("coded ProblemDetails from the API (already localised by the server)", () => {
    it("shows the specific server message for a coded 409 and 403", async () => {
      const conflict = await failWith(409, { title: "You are already enrolled in this course.", code: "enrollment.already_enrolled" });
      expect(getApiError(conflict)).toBe("You are already enrolled in this course.");
      const forbidden = await failWith(403, { title: "Enroll in the course first.", code: "enrollment.not_enrolled" });
      expect(getApiError(forbidden)).toBe("Enroll in the course first.");
    });

    it("passes an Arabic server title through untouched", async () => {
      const err = await failWith(409, { title: "أنت مسجّل في هذه الدورة بالفعل.", code: "enrollment.already_enrolled" });
      expect(getApiError(err)).toBe("أنت مسجّل في هذه الدورة بالفعل.");
    });

    it("still prefers the first field validation message over the generic coded title", async () => {
      const err = await failWith(400, {
        title: "One or more validation errors occurred.",
        code: "validation.failed",
        errors: { Email: ["The Email field is not a valid e-mail address."] },
      });
      expect(getApiError(err)).toBe("The Email field is not a valid e-mail address.");
    });

    it("keeps the friendly generic message for 5xx and 429 even when a code is present", async () => {
      expect(getApiError(await failWith(500, { title: "An unexpected error occurred.", code: "server_error" }))).toMatch(/server ran into a problem/i);
      expect(getApiError(await failWith(429, { title: "Too many requests.", code: "rate_limited" }))).toMatch(/too many/i);
    });

    it("falls back to the translated status message when the 403 has no code", async () => {
      expect(getApiError(await failWith(403, { title: "Forbidden" }))).toMatch(/permission/i);
    });
  });
});

describe("getApiError (Arabic)", () => {
  it("returns translated messages when the language is ar", async () => {
    await i18n.changeLanguage("ar");
    expect(getApiError(await failWith(403))).toBe("ليست لديك صلاحية للقيام بذلك.");
    expect(getApiError(await failWith(500))).toMatch(/الخادم/);
    expect(getApiError(await failWith(404))).toMatch(/لم نتمكّن/);
    expect(getApiError(null)).toBe("حدث خطأ ما. يُرجى المحاولة مرة أخرى.");
    // Server-provided messages are passed through untouched.
    expect(getApiError(await failWith(409, "Already enrolled"))).toBe("Already enrolled");
  });
});

describe("api interceptors", () => {
  it("sends Accept-Language from the active language", async () => {
    mock.onGet("/lang").reply((config) => [200, { lang: config.headers?.["Accept-Language"] }]);
    expect((await api.get("/lang")).data.lang).toBe("en");
    await i18n.changeLanguage("ar");
    expect((await api.get("/lang")).data.lang).toBe("ar");
  });

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
