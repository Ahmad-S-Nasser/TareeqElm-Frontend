import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationGrades from "./OrganizationGrades";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const grade = (overrides: Record<string, unknown> = {}) => ({
  Id: "g1",
  Name: "Grade 5 - A",
  AcademicYearId: "y1",
  AcademicYearName: "2026/2027",
  HomeroomInstructorId: "i1",
  HomeroomInstructorName: "Ines Instructor",
  MemberTrainerIds: ["t1", "t2"],
  Capacity: 30,
  CourseIds: ["c1"],
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "org-1", Role: "Organization", Permissions: ["organization.view", "academic-structure.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Organization/profile").reply(200, { Id: "o1", Name: "Green Valley", LogoUrl: null, Kind: "School" });
  mock.onGet("/academic-years").reply(200, [{ Id: "y1", Name: "2026/2027", StartDate: "2026-09-01T00:00:00Z", EndDate: "2027-06-30T00:00:00Z", Status: "active", TermsCount: 0, GradesCount: 1 }]);
  mock.onGet("/Organization/instructors").reply(200, [{ Id: "i1", FullName: "Ines Instructor" }]);
  mock.onGet("/Organization/trainers").reply(200, [{ Id: "t1", FullName: "Tariq Trainee" }]);
  mock.onGet("/Courses").reply(200, [{ Id: "c1", Title: "Algebra" }]);
});
afterEach(() => mock.restore());

describe("OrganizationGrades", () => {
  it("lists grades with year, homeroom instructor, occupancy and course count", async () => {
    mock.onGet("/grades").reply(200, [grade()]);
    renderWithProviders(<OrganizationGrades />);

    const card = await screen.findByTestId("grade-card");
    expect(within(card).getByText("Grade 5 - A")).toBeInTheDocument();
    expect(within(card).getByText("2026/2027")).toBeInTheDocument();
    expect(within(card).getByText("Homeroom: Ines Instructor")).toBeInTheDocument();
    expect(within(card).getByText("2 / 30")).toBeInTheDocument();
    expect(within(card).getByText("1 course")).toBeInTheDocument();
  });

  it("creates a grade with a year, homeroom instructor, members and curriculum", async () => {
    mock.onGet("/grades").reply(200, []);
    mock.onPost("/grades").reply(200, grade());
    const u = userEvent.setup();
    renderWithProviders(<OrganizationGrades />);

    await u.click(await screen.findByRole("button", { name: /New grade/ }));
    await u.type(screen.getByLabelText("Name"), "Grade 5 - A");
    await u.click(screen.getByRole("combobox", { name: "Academic year" }));
    await u.click(await screen.findByRole("option", { name: "2026/2027" }));
    await u.click(screen.getByRole("combobox", { name: "Homeroom instructor" }));
    await u.click(await screen.findByRole("option", { name: "Ines Instructor" }));
    await u.click(await screen.findByRole("checkbox", { name: "Tariq Trainee" }));
    await u.click(await screen.findByRole("checkbox", { name: "Algebra" }));
    await u.click(screen.getByRole("button", { name: "Create grade" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      Name: "Grade 5 - A", AcademicYearId: "y1", HomeroomInstructorId: "i1", MemberTrainerIds: ["t1"], CourseIds: ["c1"],
    });
    expect(toastMock).toHaveBeenCalledWith({ title: "Grade created" });
  });

  it("surfaces the server's localized error when a write is refused", async () => {
    mock.onGet("/grades").reply(200, []);
    mock.onPost("/grades").reply(403, {
      code: "academic_structure.not_enabled",
      title: "Academic years and grades are only available for school-type organizations.",
    });
    const u = userEvent.setup();
    renderWithProviders(<OrganizationGrades />);

    await u.click(await screen.findByRole("button", { name: /New grade/ }));
    await u.type(screen.getByLabelText("Name"), "G");
    await u.click(screen.getByRole("button", { name: "Create grade" }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive",
      description: "Academic years and grades are only available for school-type organizations.",
    })));
  });

  it("filters the list by academic year", async () => {
    mock.onGet("/grades").reply(200, [grade()]);
    const u = userEvent.setup();
    renderWithProviders(<OrganizationGrades />);
    await screen.findByTestId("grade-card");

    await u.click(screen.getByRole("combobox", { name: "Filter by academic year" }));
    await u.click(await screen.findByRole("option", { name: "2026/2027" }));

    await waitFor(() => expect(mock.history.get.filter((r) => r.url === "/grades").pop()?.params).toEqual({ academicYearId: "y1" }));
  });
});
