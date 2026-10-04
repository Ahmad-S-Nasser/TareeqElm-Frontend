import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminEnrollments from "./AdminEnrollments";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const courses = [{ Id: "c1", Title: "Intro to Testing", EnrolledCount: 3 }];

const enrollment = (overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: "e1",
  TrainerId: "t1",
  TrainerName: "Jane Doe",
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  InstructorName: "Dr. Sam",
  SectionId: null,
  SectionName: null,
  Status: "Active",
  Source: "Self",
  EnrolledBy: null,
  EnrolledByName: null,
  EnrolledAt: "2026-01-05T10:00:00Z",
  ProgressPercentage: 40,
  CompletedAt: null,
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Admin", Permissions: ["enrollments.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses").reply(200, courses);
});
afterEach(() => mock.restore());

describe("AdminEnrollments", () => {
  it("lists enrollments with resolved names and a status badge", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment()], { "x-total-count": "1" });
    renderWithProviders(<AdminEnrollments />);
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows the empty state when there are no enrollments", async () => {
    mock.onGet("/Enrollments").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<AdminEnrollments />);
    expect(await screen.findByText("No enrollments match your filters.")).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/Enrollments").reply(500);
    renderWithProviders(<AdminEnrollments />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("re-queries with the chosen course filter", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminEnrollments />);
    await screen.findByText("Jane Doe");

    await user.click(screen.getByRole("combobox", { name: "Course" }));
    await user.click(await screen.findByRole("option", { name: "Intro to Testing" }));

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/Enrollments").pop();
      expect(call?.params?.courseId).toBe("c1");
    });
  });

  it("approves a pending enrollment", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment({ Id: "e2", Status: "Pending" })], { "x-total-count": "1" });
    mock.onPost("/Enrollments/e2/approve").reply(200, enrollment({ Id: "e2", Status: "Active" }));
    const user = userEvent.setup();
    renderWithProviders(<AdminEnrollments />);
    await screen.findByText("Jane Doe");

    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/Enrollments/e2/approve")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Enrollment approved" }));
  });

  it("rejects a pending enrollment", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment({ Id: "e3", Status: "Pending" })], { "x-total-count": "1" });
    mock.onPost("/Enrollments/e3/reject").reply(200, enrollment({ Id: "e3", Status: "Rejected" }));
    const user = userEvent.setup();
    renderWithProviders(<AdminEnrollments />);
    await screen.findByText("Jane Doe");

    await user.click(screen.getByRole("button", { name: /^reject$/i }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/Enrollments/e3/reject")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Enrollment rejected" }));
  });

  it("unenrolls a trainer after confirmation", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment()], { "x-total-count": "1" });
    mock.onDelete("/Enrollments/e1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<AdminEnrollments />);
    await screen.findByText("Jane Doe");

    await user.click(screen.getByRole("button", { name: /^unenroll$/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^unenroll$/i }));

    await waitFor(() => expect(mock.history.delete.some((r) => r.url === "/Enrollments/e1")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Trainee unenrolled" }));
  });

  it("hides row actions without enrollments.manage", async () => {
    mock.reset();
    const noPermUser = makeUser({ Id: "u1", Role: "Admin", Permissions: [] });
    seedSession(noPermUser);
    mock.onGet("/Auth/me").reply(200, noPermUser);
    mock.onGet("/Courses").reply(200, courses);
    mock.onGet("/Enrollments").reply(200, [enrollment({ Id: "e4", Status: "Pending" })], { "x-total-count": "1" });
    renderWithProviders(<AdminEnrollments />);
    await screen.findByText("Jane Doe");
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Access tab (wave F2b): entitlements.manage — grant and revoke access by hand.
// ---------------------------------------------------------------------------

const trainers = [{ Id: "t1", FullName: "Jane Doe", Email: "jane@tareeqelm.com" }];

const grant = (overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: "g1",
  UserId: "t1",
  UserName: "Jane Doe",
  ItemType: "Course",
  ItemId: "c1",
  ItemName: "Intro to Testing",
  CourseId: null,
  CourseTitle: null,
  Status: "Active",
  Source: "AdminGrant",
  OrderId: null,
  GrantedBy: "u1",
  GrantedByName: "Admin User",
  GrantedAt: "2026-02-01T10:00:00Z",
  ExpiresAt: null,
  RevokedAt: null,
  RevokedBy: null,
  RevokedByName: null,
  RevokedReason: null,
  Note: "Scholarship",
  GrantsAccess: true,
  ...overrides,
});

/** Re-seeds the session with a chosen permission set and re-registers the reads both tabs make. */
const signInFor = (permissions: string[]) => {
  mock.reset();
  const user = makeUser({ Id: "u1", Role: "Admin", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses").reply(200, courses);
  mock.onGet("/Enrollments").reply(200, [enrollment()], { "x-total-count": "1" });
  mock.onGet("/admin/users").reply(200, trainers);
  mock.onGet("/tracks").reply(200, []);
};

const openAccessTab = async (user: ReturnType<typeof userEvent.setup>) => {
  renderWithProviders(<AdminEnrollments />);
  await user.click(await screen.findByRole("tab", { name: "Access" }));
  return screen.findByTestId("access-tab");
};

describe("AdminEnrollments — Access tab", () => {
  beforeEach(() => signInFor(["enrollments.manage", "entitlements.manage"]));

  it("leaves the Enrollments tab as the default view", async () => {
    mock.onGet("/admin/entitlements").reply(200, [grant()], { "x-total-count": "1" });
    renderWithProviders(<AdminEnrollments />);
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByTestId("access-tab")).not.toBeInTheDocument();
  });

  it("lists access grants with resolved names and a status badge", async () => {
    mock.onGet("/admin/entitlements").reply(200, [grant()], { "x-total-count": "1" });
    const user = userEvent.setup();
    const tab = await openAccessTab(user);

    expect(await within(tab).findByText("Intro to Testing")).toBeInTheDocument();
    expect(within(tab).getByText("Granted by an administrator")).toBeInTheDocument();
    expect(within(tab).getByText("Never expires")).toBeInTheDocument();
  });

  it("shows the empty state when no grant matches", async () => {
    mock.onGet("/admin/entitlements").reply(200, [], { "x-total-count": "0" });
    const user = userEvent.setup();
    await openAccessTab(user);
    expect(await screen.findByTestId("access-empty")).toBeInTheDocument();
  });

  it("shows an error state when the grants cannot be loaded", async () => {
    mock.onGet("/admin/entitlements").reply(500);
    const user = userEvent.setup();
    await openAccessTab(user);
    expect(await screen.findByTestId("access-error")).toBeInTheDocument();
  });

  it("re-queries with the chosen status filter", async () => {
    mock.onGet("/admin/entitlements").reply(200, [grant()], { "x-total-count": "1" });
    const user = userEvent.setup();
    const tab = await openAccessTab(user);
    await within(tab).findByText("Intro to Testing");

    await user.click(within(tab).getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Revoked" }));

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/entitlements").pop();
      expect(call?.params?.status).toBe("Revoked");
    });
  });

  it("refuses to grant access without a reason, then grants it with one", async () => {
    mock.onGet("/admin/entitlements").reply(200, [], { "x-total-count": "0" });
    mock.onPost("/admin/entitlements").reply(201, { Entitlement: grant(), UnlockedCourseIds: ["c1"], EnrollmentsCreated: 1 });
    const user = userEvent.setup();
    const tab = await openAccessTab(user);

    await user.click(within(tab).getByRole("button", { name: "Grant access" }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("combobox", { name: "Trainee" }));
    await user.click(await screen.findByRole("option", { name: /Jane Doe/ }));
    await user.click(within(dialog).getByRole("combobox", { name: "Item" }));
    await user.click(await screen.findByRole("option", { name: "Intro to Testing" }));

    // No note yet: the server would answer 400 entitlement.note_required, so the form says so first.
    await user.click(within(dialog).getByRole("button", { name: "Grant access" }));
    expect(await screen.findByTestId("grant-error")).toHaveTextContent("A reason is required.");
    expect(mock.history.post.filter((r) => r.url === "/admin/entitlements")).toHaveLength(0);

    await user.type(within(dialog).getByLabelText("Reason"), "Scholarship");
    await user.click(within(dialog).getByRole("button", { name: "Grant access" }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/admin/entitlements")).toHaveLength(1));
    const body = JSON.parse(mock.history.post.find((r) => r.url === "/admin/entitlements")!.data as string);
    expect(body).toMatchObject({ UserId: "t1", ItemType: "Course", ItemId: "c1", Note: "Scholarship" });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Access granted, and 1 enrollments were created." })
    );
  });

  it("revokes an active grant with a reason", async () => {
    mock.onGet("/admin/entitlements").reply(200, [grant()], { "x-total-count": "1" });
    mock.onDelete("/admin/entitlements/g1").reply(204);
    const user = userEvent.setup();
    const tab = await openAccessTab(user);

    await user.click(await within(tab).findByRole("button", { name: "Revoke" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Enrolled by mistake");
    await user.click(within(dialog).getByRole("button", { name: "Revoke access" }));

    await waitFor(() => {
      const call = mock.history.delete.find((r) => r.url === "/admin/entitlements/g1");
      expect(call?.params?.reason).toBe("Enrolled by mistake");
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Access revoked." }));
  });

  it("offers no revoke action on a grant that is already revoked", async () => {
    mock.onGet("/admin/entitlements").reply(200, [grant({ Status: "Revoked", GrantsAccess: false })], { "x-total-count": "1" });
    const user = userEvent.setup();
    const tab = await openAccessTab(user);

    await within(tab).findByText("Intro to Testing");
    expect(within(tab).queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });

  it("hides grant and revoke without entitlements.manage", async () => {
    signInFor(["enrollments.manage"]);
    mock.onGet("/admin/entitlements").reply(200, [grant()], { "x-total-count": "1" });
    const user = userEvent.setup();
    const tab = await openAccessTab(user);

    await within(tab).findByText("Intro to Testing");
    expect(within(tab).queryByRole("button", { name: "Grant access" })).not.toBeInTheDocument();
    expect(within(tab).queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });
});
