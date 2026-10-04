import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationTrainers from "./OrganizationTrainers";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const departments = [{ Id: "d1", Name: "Engineering" }];

const trainer = (overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: "t1",
  FullName: "Tariq Trainer",
  Email: "tariq@tareeqelm.com",
  Department: "Engineering",
  DepartmentId: "d1",
  Progress: 40,
  IsActive: true,
  JoinedYear: 2025,
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

describe("OrganizationTrainers", () => {
  it("lists trainers with resolved department names", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/trainers").reply(200, [trainer()]);
    renderWithProviders(<OrganizationTrainers />);
    expect(await screen.findByText("Tariq Trainer")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/trainers").reply(500);
    renderWithProviders(<OrganizationTrainers />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("filters by joined year and by status", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/trainers").reply(200, [
      trainer({ Id: "t1", FullName: "2024 Trainer", JoinedYear: 2024, IsActive: true }),
      trainer({ Id: "t2", FullName: "2025 Trainer", JoinedYear: 2025, IsActive: false }),
    ]);
    const u = userEvent.setup();
    renderWithProviders(<OrganizationTrainers />);
    await screen.findByText("2024 Trainer");
    expect(screen.getByText("2025 Trainer")).toBeInTheDocument();

    await u.click(screen.getByRole("combobox", { name: "Year" }));
    await u.click(await screen.findByRole("option", { name: "2024" }));
    expect(screen.getByText("2024 Trainer")).toBeInTheDocument();
    expect(screen.queryByText("2025 Trainer")).not.toBeInTheDocument();

    await u.click(screen.getByRole("combobox", { name: "Year" }));
    await u.click(await screen.findByRole("option", { name: "Year" }));
    await u.click(screen.getByRole("combobox", { name: "Status" }));
    await u.click(await screen.findByRole("option", { name: "Inactive" }));
    expect(screen.getByText("2025 Trainer")).toBeInTheDocument();
    expect(screen.queryByText("2024 Trainer")).not.toBeInTheDocument();
  });

  it("hides Enroll new trainer without users.manage", async () => {
    const user = renderAsOrganization(["organization.view"]);
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/trainers").reply(200, [trainer()]);
    renderWithProviders(<OrganizationTrainers />);
    await screen.findByText("Tariq Trainer");
    expect(screen.queryByRole("button", { name: "Enroll new trainee" })).not.toBeInTheDocument();
  });

  it("enrolls a new trainer via the admin users endpoint", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/trainers").reply(200, []);
    mock.onPost("/admin/users").reply(200, {});
    const u = userEvent.setup();
    renderWithProviders(<OrganizationTrainers />);
    await screen.findByText("No trainees found");

    await u.click(screen.getByRole("button", { name: "Enroll new trainee" }));
    const dialog = await screen.findByRole("dialog");
    await u.type(within(dialog).getByLabelText("Full name"), "New Trainer");
    await u.type(within(dialog).getByLabelText("Email"), "newt@tareeqelm.com");
    await u.type(within(dialog).getByLabelText("Initial password"), "Password1!");
    await u.click(within(dialog).getByRole("button", { name: "Enroll trainee" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/admin/users")).toBe(true));
    const body = JSON.parse(mock.history.post.find((r) => r.url === "/admin/users")!.data);
    expect(body).toMatchObject({ FullName: "New Trainer", Email: "newt@tareeqelm.com", Role: "Trainer" });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Trainee enrolled" }));
  });

  it("opens the academic profile and shows enrolled courses with progress", async () => {
    const user = renderAsOrganization();
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/Organization/trainers").reply(200, [trainer()]);
    mock.onGet("/Enrollments/trainer/t1").reply(200, [
      { Id: "e1", CourseId: "c1", CourseTitle: "Algebra I", Status: "Active", ProgressPercentage: 55 },
    ]);
    const u = userEvent.setup();
    renderWithProviders(<OrganizationTrainers />);
    await screen.findByText("Tariq Trainer");

    await u.click(screen.getByRole("button", { name: "View academic profile" }));
    expect(await screen.findByText("Algebra I")).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === "/Enrollments/trainer/t1")).toBe(true);
  });
});
