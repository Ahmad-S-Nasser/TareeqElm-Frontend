import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { AuthProvider, useAuth } from "./useAuth";
import { useCourses } from "./useCourses";
import { makeUser, seedSession } from "@/test/renderWithProviders";

const toast = vi.hoisted(() => vi.fn());
vi.mock("./use-toast", () => ({ useToast: () => ({ toast }) }));

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  toast.mockClear();
  mock.onGet("/Courses").reply(200, []);
});
afterEach(() => mock.restore());

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const setup = async (signedIn = true) => {
  if (signedIn) seedSession(makeUser({ Role: "Trainer" }));
  const hook = renderHook(() => ({ courses: useCourses(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.loading).toBe(false));
  return { result: { get current() { return hook.result.current.courses; } } };
};

describe("useCourses.enrollInCourse", () => {
  it("toasts 'Enrolled!' and posts the course id on success", async () => {
    mock.onPost("/Enrollments").reply(201, {});
    const { result } = await setup();

    let out: { error: Error | null } | undefined;
    await act(async () => {
      out = await result.current.enrollInCourse("course-1");
    });

    expect(out?.error).toBeNull();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ CourseId: "course-1" });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Enrolled!" }));
  });

  it("treats a 409 as 'Already enrolled' and returns no error", async () => {
    mock.onPost("/Enrollments").reply(409, "Already enrolled");
    const { result } = await setup();

    let out: { error: Error | null } | undefined;
    await act(async () => {
      out = await result.current.enrollInCourse("course-1");
    });

    expect(out).toEqual({ error: null });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Already enrolled" }));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("toasts a destructive error and returns it on other failures", async () => {
    mock.onPost("/Enrollments").reply(400, { detail: "Course is not published" });
    const { result } = await setup();

    let out: { error: Error | null } | undefined;
    await act(async () => {
      out = await result.current.enrollInCourse("course-1");
    });

    expect(out?.error).toBeTruthy();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Enrollment Failed", description: "Course is not published", variant: "destructive" })
    );
  });

  it("refuses to call the API when signed out", async () => {
    const { result } = await setup(false);
    let out: { error: Error | null } | undefined;
    await act(async () => {
      out = await result.current.enrollInCourse("course-1");
    });
    expect(out?.error).toBeTruthy();
    expect(mock.history.post).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
