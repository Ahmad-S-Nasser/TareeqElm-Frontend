import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { RolesManager } from "./RolesManager";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const catalog = [
  { Name: "courses.write", Category: "courses", Description: "Create and edit courses", LearnerScoped: false, AdminOnly: false },
  { Name: "exams.view", Category: "insight", Description: "View exams", LearnerScoped: false, AdminOnly: false },
  { Name: "roles.manage", Category: "administration", Description: "Manage roles", LearnerScoped: false, AdminOnly: true },
  { Name: "quizzes.take", Category: "learning", Description: "Take quizzes", LearnerScoped: true, AdminOnly: false },
];
const role = (over: Record<string, unknown>) => ({
  Id: "r", Name: "R", Description: null, Permissions: [], IsSystem: false, IsLocked: false, BaseRole: null,
  UserCount: 0, CreatedAt: "2026-01-01T00:00:00Z", UpdatedAt: "2026-01-01T00:00:00Z", ...over,
});
const admin = role({ Id: "a", Name: "Admin", IsSystem: true, IsLocked: true, BaseRole: "Admin", UserCount: 2, Permissions: ["courses.write", "exams.view", "roles.manage"] });
const instructor = role({ Id: "i", Name: "Instructor", IsSystem: true, BaseRole: "Instructor", UserCount: 5, Permissions: ["courses.write"] });
const reviewer = role({ Id: "c1", Name: "Reviewer", Description: "Reviews", UserCount: 1, Permissions: ["exams.view"] });

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  seedSession(makeUser({ Role: "Admin", Permissions: ["roles.manage"] }));
  mock.onGet("/Auth/me").reply(200, makeUser({ Role: "Admin", Permissions: ["roles.manage"] }));
  mock.onGet("/permissions").reply(200, catalog);
});
afterEach(() => mock.restore());

describe("RolesManager", () => {
  it("lists roles with user counts and groups permissions by category", async () => {
    mock.onGet("/roles").reply(200, [admin, instructor, reviewer]);
    renderWithProviders(<RolesManager />);
    const list = await screen.findByRole("list", { name: /^roles$/i });
    expect(within(list).getByText("2 users")).toBeInTheDocument();
    expect(within(list).getByText("5 users")).toBeInTheDocument();
    expect(within(list).getByText("1 user")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Courses" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Learner self-service" })).toBeInTheDocument();
    // learner-scoped and admin-only permissions are marked
    expect(screen.getAllByText("Learner self-service").length).toBeGreaterThan(1);
    expect(screen.getByText("Admin only")).toBeInTheDocument();
  });

  it("locks the Admin role: switches disabled and no save button", async () => {
    mock.onGet("/roles").reply(200, [admin, reviewer]);
    renderWithProviders(<RolesManager />);
    await screen.findByText(/always holds every administrative permission/i);
    for (const sw of screen.getAllByRole("switch")) expect(sw).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
  });

  it("toggling a permission and saving PUTs the full permission list", async () => {
    mock.onGet("/roles").reply(200, [admin, reviewer]);
    mock.onPut("/roles/c1").reply(200, role({ ...reviewer, Permissions: ["courses.write", "exams.view"] }));
    const user = userEvent.setup();
    renderWithProviders(<RolesManager />);
    await user.click(await screen.findByRole("button", { name: /Reviewer/ }));
    const toggle = await screen.findByRole("switch", { name: /Create and edit courses for Reviewer/ });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(toggle).toBeChecked();
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(mock.history.put[0].url).toBe("/roles/c1");
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ Name: "Reviewer", Description: "Reviews", Permissions: ["courses.write", "exams.view"] });
  });

  it("sends only permissions for a built-in role and disables admin-only ones", async () => {
    mock.onGet("/roles").reply(200, [admin, instructor]);
    mock.onPut("/roles/i").reply(200, instructor);
    const user = userEvent.setup();
    renderWithProviders(<RolesManager />);
    await user.click(await screen.findByRole("button", { name: /Instructor/ }));
    expect(await screen.findByRole("switch", { name: /Manage roles and permissions for/ })).toBeDisabled();
    await user.click(screen.getByRole("switch", { name: /View exams and results for/ }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ Permissions: ["courses.write", "exams.view"] });
  });

  it("shows the server-localized error when saving fails", async () => {
    mock.onGet("/roles").reply(200, [admin, reviewer]);
    mock.onPut("/roles/c1").reply(403, { code: "role.system_protected", title: "Protected role" });
    const user = userEvent.setup();
    renderWithProviders(<RolesManager />);
    await user.click(await screen.findByRole("button", { name: /Reviewer/ }));
    await user.click(await screen.findByRole("switch", { name: /Create and edit courses for Reviewer/ }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive", description: "Protected role" })));
  });

  it("creates a custom role via POST /roles", async () => {
    mock.onGet("/roles").reply(200, [admin]);
    mock.onPost("/roles").reply(201, role({ Id: "new", Name: "Auditor" }));
    const user = userEvent.setup();
    renderWithProviders(<RolesManager />);
    await user.click(await screen.findByRole("button", { name: /new role/i }));
    await user.type(await screen.findByLabelText(/role name/i), "Auditor");
    await user.click(screen.getByRole("button", { name: /create role/i }));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Name: "Auditor", Description: "", Permissions: [] });
  });

  it("deletes a custom role that has no users", async () => {
    mock.onGet("/roles").reply(200, [admin, role({ Id: "c2", Name: "Temp" })]);
    mock.onDelete("/roles/c2").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<RolesManager />);
    await user.click(await screen.findByRole("button", { name: /Temp/ }));
    await user.click(await screen.findByRole("button", { name: /^delete$/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
  });

  it("shows an error state with retry when loading fails", async () => {
    mock.onGet("/roles").reply(500);
    renderWithProviders(<RolesManager />);
    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
