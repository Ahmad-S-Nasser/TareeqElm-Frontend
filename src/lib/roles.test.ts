import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import { isAppRole, isRoleAllowed, parseApiRole, roleHome, roleLabel, SIGN_IN_PATH } from "./roles";
import { getAuthModeFromRoute, getReturnPath } from "./authRoute";
import { MAX_QUERY_RETRIES, shouldRetryQuery } from "./queryClient";

describe("roles", () => {
  it("roleHome maps every role and fails to sign-in for null/unknown", () => {
    expect(roleHome("applicant")).toBe("/dashboard");
    expect(roleHome("instructor")).toBe("/instructor");
    expect(roleHome("university")).toBe("/university");
    expect(roleHome("admin")).toBe("/admin");
    expect(roleHome(null)).toBe(SIGN_IN_PATH);
    expect(roleHome(undefined)).toBe(SIGN_IN_PATH);
    expect(roleHome("hacker" as never)).toBe(SIGN_IN_PATH);
  });

  it("parseApiRole maps API roles and returns null for unknown values", () => {
    expect(parseApiRole("Trainer")).toBe("applicant");
    expect(parseApiRole("Instructor")).toBe("instructor");
    expect(parseApiRole("University")).toBe("university");
    expect(parseApiRole("Admin")).toBe("admin");
    expect(parseApiRole("Student")).toBeNull();
    expect(parseApiRole("admin")).toBeNull();
    expect(parseApiRole("toString")).toBeNull();
    expect(parseApiRole(undefined)).toBeNull();
    expect(parseApiRole(3)).toBeNull();
  });

  it("isAppRole and roleLabel", () => {
    expect(isAppRole("admin")).toBe(true);
    expect(isAppRole("Admin")).toBe(false);
    expect(roleLabel("applicant")).toBe("Trainer");
    expect(roleLabel(null)).toBe("Unknown");
  });

  it("isRoleAllowed is true only for known roles in the list", () => {
    expect(isRoleAllowed("admin", ["admin", "university"])).toBe(true);
    expect(isRoleAllowed("applicant", ["admin"])).toBe(false);
    expect(isRoleAllowed(null, ["admin"])).toBe(false);
    expect(isRoleAllowed("bogus" as never, ["bogus" as never])).toBe(false);
  });
});

describe("authRoute", () => {
  it("getReturnPath returns internal paths with search and hash", () => {
    expect(getReturnPath({ from: { pathname: "/courses/1", search: "?a=1", hash: "#x" } })).toBe("/courses/1?a=1#x");
    expect(getReturnPath({ from: { pathname: "/dashboard" } })).toBe("/dashboard");
  });

  it("getReturnPath rejects protocol-relative and external URLs", () => {
    expect(getReturnPath({ from: { pathname: "//evil.com" } })).toBeNull();
    expect(getReturnPath({ from: { pathname: "https://evil.com" } })).toBeNull();
    expect(getReturnPath({ from: { pathname: "evil" } })).toBeNull();
    expect(getReturnPath({ from: { pathname: 5 } })).toBeNull();
    expect(getReturnPath(null)).toBeNull();
    expect(getReturnPath(undefined)).toBeNull();
    expect(getReturnPath({})).toBeNull();
  });

  it("getAuthModeFromRoute picks sign-up from /signup or ?mode=signup", () => {
    expect(getAuthModeFromRoute("/signup", "")).toBe("signup");
    expect(getAuthModeFromRoute("/auth", "?mode=signup")).toBe("signup");
    expect(getAuthModeFromRoute("/login", "")).toBe("signin");
    expect(getAuthModeFromRoute("/auth", "")).toBe("signin");
  });
});

describe("shouldRetryQuery", () => {
  const axiosError = (status?: number) => {
    const err = new AxiosError("fail");
    if (status !== undefined) {
      err.response = { status, data: null, statusText: "", headers: {}, config: {} as never };
    }
    return err;
  };

  it("never retries 4xx", () => {
    for (const status of [400, 401, 403, 404, 409, 429]) {
      expect(shouldRetryQuery(0, axiosError(status))).toBe(false);
    }
  });

  it("retries network errors and 5xx", () => {
    expect(shouldRetryQuery(0, axiosError())).toBe(true);
    expect(shouldRetryQuery(1, axiosError(503))).toBe(true);
  });

  it("stops after the maximum number of retries", () => {
    expect(MAX_QUERY_RETRIES).toBe(2);
    expect(shouldRetryQuery(2, axiosError(500))).toBe(false);
    expect(shouldRetryQuery(3, axiosError())).toBe(false);
  });

  it("does not retry non-axios errors", () => {
    expect(shouldRetryQuery(0, new Error("boom"))).toBe(false);
  });
});
