import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationEnrollment from "./OrganizationEnrollment";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const courses = [{ Id: "c1", Title: "Intro to Testing" }];
const sections = [{ Id: "s1", SectionLabel: "Section A", CourseId: "c1", Capacity: 30 }];
const departments = [{ Id: "d1", Name: "Engineering" }];
const trainers = [
  { Id: "t1", FullName: "Jane Doe", Email: "jane@tareeqelm.com", Department: "Engineering" },
  { Id: "t2", FullName: "Sam Ray", Email: "sam@tareeqelm.com", Department: "Engineering" },
];

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
  const user = makeUser({ Id: "u1", Role: "Organization", Permissions: ["enrollments.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses").reply(200, courses);
  mock.onGet("/Sections").reply(200, sections);
  mock.onGet("/Departments").reply(200, departments);
  mock.onGet("/Organization/trainers").reply(200, trainers);
});
afterEach(() => mock.restore());

describe("OrganizationEnrollment", () => {
  it("lists enrollments with resolved names and a status badge", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment()], { "x-total-count": "1" });
    renderWithProviders(<OrganizationEnrollment />);
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Intro to Testing")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows the empty state when there are no enrollments", async () => {
    mock.onGet("/Enrollments").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<OrganizationEnrollment />);
    expect(await screen.findByText("No enrollments match your filters.")).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/Enrollments").reply(500);
    renderWithProviders(<OrganizationEnrollment />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("re-queries with the chosen status filter", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationEnrollment />);
    await screen.findByText("Jane Doe");

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByText("Pending"));

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/Enrollments").pop();
      expect(call?.params?.status).toBe("Pending");
    });
  });

  it("approves a pending enrollment", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment({ Id: "e2", Status: "Pending" })], { "x-total-count": "1" });
    mock.onPost("/Enrollments/e2/approve").reply(200, enrollment({ Id: "e2", Status: "Active" }));
    const user = userEvent.setup();
    renderWithProviders(<OrganizationEnrollment />);
    await screen.findByText("Jane Doe");

    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/Enrollments/e2/approve")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Enrollment approved" }));
  });

  it("rejects a pending enrollment", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment({ Id: "e3", Status: "Pending" })], { "x-total-count": "1" });
    mock.onPost("/Enrollments/e3/reject").reply(200, enrollment({ Id: "e3", Status: "Rejected" }));
    const user = userEvent.setup();
    renderWithProviders(<OrganizationEnrollment />);
    await screen.findByText("Jane Doe");

    await user.click(screen.getByRole("button", { name: /^reject$/i }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/Enrollments/e3/reject")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Enrollment rejected" }));
  });

  it("unenrolls a trainer after confirmation", async () => {
    mock.onGet("/Enrollments").reply(200, [enrollment()], { "x-total-count": "1" });
    mock.onDelete("/Enrollments/e1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationEnrollment />);
    await screen.findByText("Jane Doe");

    await user.click(screen.getByRole("button", { name: /^unenroll$/i }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^unenroll$/i }));

    await waitFor(() => expect(mock.history.delete.some((r) => r.url === "/Enrollments/e1")).toBe(true));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Trainee unenrolled" }));
  });

  it("bulk enrolls the selected trainers into a course", async () => {
    mock.onGet("/Enrollments").reply(200, [], { "x-total-count": "0" });
    mock.onPost("/Enrollments/bulk").reply(200, {
      Rows: [{ TrainerId: "t1", TrainerName: "Jane Doe", Status: "ok", EnrollmentId: "e9" }],
      OkCount: 1, ConflictCount: 0, WaitlistedCount: 0, FullCount: 0,
    });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationEnrollment />);
    await screen.findByText("No enrollments match your filters.");

    await user.click(screen.getByRole("button", { name: /bulk enroll/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: "Course" }));
    await user.click(await screen.findByText("Intro to Testing"));

    await user.click(within(dialog).getByRole("checkbox", { name: /Jane Doe/i }));
    await user.click(within(dialog).getByRole("button", { name: /^enroll$/i }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/Enrollments/bulk")).toBe(true));
    const body = JSON.parse(mock.history.post.find((r) => r.url === "/Enrollments/bulk")!.data);
    expect(body).toMatchObject({ CourseId: "c1", TrainerIds: ["t1"] });
    expect(await within(dialog).findByText("Bulk enroll results")).toBeInTheDocument();
  });

  it("shows an error toast when bulk enroll fails", async () => {
    mock.onGet("/Enrollments").reply(200, [], { "x-total-count": "0" });
    mock.onPost("/Enrollments/bulk").reply(400, { code: "enrollment.invalid", title: "The course is not open for enrollment" });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationEnrollment />);
    await screen.findByText("No enrollments match your filters.");

    await user.click(screen.getByRole("button", { name: /bulk enroll/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: "Course" }));
    await user.click(await screen.findByText("Intro to Testing"));
    await user.click(within(dialog).getByRole("checkbox", { name: /Jane Doe/i }));
    await user.click(within(dialog).getByRole("button", { name: /^enroll$/i }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Could not bulk enroll the selected trainees",
      description: "The course is not open for enrollment",
    })));
  });
});
