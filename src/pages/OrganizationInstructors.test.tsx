import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationInstructors from "./OrganizationInstructors";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const departments = [{ Id: "d1", Name: "Engineering" }];

const instructor = (overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: "i1",
  FullName: "Ines Instructor",
  Email: "ines@tareeqelm.com",
  Department: "Engineering",
  DepartmentId: "d1",
  ActiveCourses: 3,
  IsActive: true,
  ...overrides,
});

const renderAsOrganization = (permissions: string[] = ["organization.view", "users.manage"]) => {
  const user = makeUser({ Id: "u1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  return user;
};

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  mock.onGet("/Departments").reply(200, departments);
});
afterEach(() => mock.restore());

describe("OrganizationInstructors", () => {
  it("lists instructors with resolved department names", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/instructors").reply(200, [instructor()]);
    renderWithProviders(<OrganizationInstructors />);
    expect(await screen.findByText("Ines Instructor")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/instructors").reply(500);
    renderWithProviders(<OrganizationInstructors />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("filters by department and by active status", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/instructors").reply(200, [
      instructor({ Id: "i1", FullName: "Active Ins", DepartmentId: "d1", IsActive: true }),
      instructor({ Id: "i2", FullName: "Inactive Ins", DepartmentId: null, Department: null, IsActive: false }),
    ]);
    const u = userEvent.setup();
    renderWithProviders(<OrganizationInstructors />);
    await screen.findByText("Active Ins");
    expect(screen.getByText("Inactive Ins")).toBeInTheDocument();

    await u.click(screen.getByRole("combobox", { name: "Departments" }));
    await u.click(await screen.findByRole("option", { name: "Engineering" }));
    expect(screen.getByText("Active Ins")).toBeInTheDocument();
    expect(screen.queryByText("Inactive Ins")).not.toBeInTheDocument();

    await u.click(screen.getByRole("combobox", { name: "Departments" }));
    await u.click(await screen.findByRole("option", { name: "Departments" }));
    await u.click(screen.getByRole("combobox", { name: "Active status" }));
    await u.click(await screen.findByRole("option", { name: "Inactive" }));
    expect(screen.getByText("Inactive Ins")).toBeInTheDocument();
    expect(screen.queryByText("Active Ins")).not.toBeInTheDocument();
  });

  it("hides Add new instructor and the actions menu without users.manage", async () => {
    const user = renderAsOrganization(["organization.view"]);
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/instructors").reply(200, [instructor()]);
    renderWithProviders(<OrganizationInstructors />);
    await screen.findByText("Ines Instructor");
    expect(screen.queryByRole("button", { name: "Add new instructor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Actions for/i })).not.toBeInTheDocument();
  });

  it("adds a new instructor via the admin users endpoint", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/instructors").reply(200, []);
    mock.onPost("/admin/users").reply(200, {});
    const u = userEvent.setup();
    renderWithProviders(<OrganizationInstructors />);
    await screen.findByText("No instructors found");

    await u.click(screen.getByRole("button", { name: "Add new instructor" }));
    const dialog = await screen.findByRole("dialog");
    await u.type(within(dialog).getByLabelText("Full name"), "New Instructor");
    await u.type(within(dialog).getByLabelText("Email"), "new@tareeqelm.com");
    await u.type(within(dialog).getByLabelText("Initial password"), "Password1!");
    await u.click(within(dialog).getByRole("button", { name: "Add instructor" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/admin/users")).toBe(true));
    const body = JSON.parse(mock.history.post.find((r) => r.url === "/admin/users")!.data);
    expect(body).toMatchObject({ FullName: "New Instructor", Email: "new@tareeqelm.com", Role: "Instructor" });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Instructor added" }));
  });

  it("toggles active status from the actions menu", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/instructors").reply(200, [instructor({ IsActive: true })]);
    mock.onPut("/admin/users/i1").reply(200, {});
    const u = userEvent.setup();
    renderWithProviders(<OrganizationInstructors />);
    await screen.findByText("Ines Instructor");

    await u.click(screen.getByRole("button", { name: "Actions for Ines Instructor" }));
    await u.click(await screen.findByText("Deactivate"));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/admin/users/i1")).toBe(true));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/admin/users/i1")!.data);
    expect(body).toMatchObject({ IsActive: false });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Status updated" }));
  });

  it("opens the profile dialog with the instructor's details", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/instructors").reply(200, [instructor()]);
    const u = userEvent.setup();
    renderWithProviders(<OrganizationInstructors />);
    await screen.findByText("Ines Instructor");

    await u.click(screen.getByRole("button", { name: "Profile" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("ines@tareeqelm.com")).toBeInTheDocument();
    expect(within(dialog).getByText("Active")).toBeInTheDocument();
  });

  it("opens the assigned-courses dialog and fetches the instructor's courses", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/instructors").reply(200, [instructor()]);
    mock.onGet("/Courses").reply(200, [{ Id: "c1", Title: "Algebra I", Status: "Published", EnrolledCount: 12 }]);
    const u = userEvent.setup();
    renderWithProviders(<OrganizationInstructors />);
    await screen.findByText("Ines Instructor");

    await u.click(screen.getByRole("button", { name: "Assigned" }));
    expect(await screen.findByText("Algebra I")).toBeInTheDocument();
    const call = mock.history.get.find((r) => r.url === "/Courses");
    expect(call?.params).toMatchObject({ instructorId: "i1" });
  });
});
