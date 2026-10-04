import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationDepartments from "./OrganizationDepartments";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const department = (overrides: Record<string, unknown> = {}) => ({
  Id: "d-sci", Name: "Science", Head: "Dr. Salma", CoursesCount: 1, TrainersCount: 0, Performance: 0, Trend: 0, ...overrides,
});

const courses = [
  { Id: "c-phys", Title: "Physics 101", DepartmentId: null },
  { Id: "c-chem", Title: "Chemistry 101", DepartmentId: "d-sci" }, // already filed here
  { Id: "c-draw", Title: "Drawing Basics", DepartmentId: "d-art" },
];
const trainers = [
  { Id: "t-jane", FullName: "Jane Doe", Email: "jane@example.com", Department: null, DepartmentId: null },
  { Id: "t-omar", FullName: "Omar Ali", Email: "omar@example.com", Department: "Arts", DepartmentId: "d-art" },
];

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "org1", Role: "Organization" });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses").reply(200, courses);
  mock.onGet("/Organization/trainers").reply(200, trainers);
});
afterEach(() => mock.restore());

const openAssignDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: "Assign courses and trainees to Science" }));
  return screen.findByRole("dialog");
};

describe("OrganizationDepartments - bulk assign", () => {
  it("submits the picked courses and trainees to PUT /Departments/{id}/assign, toasts, and refetches the counts", async () => {
    mock.onGet("/Departments")
      .replyOnce(200, [department(), department({ Id: "d-art", Name: "Arts", Head: null })])
      .onGet("/Departments")
      .reply(200, [department({ CoursesCount: 2, TrainersCount: 1 }), department({ Id: "d-art", Name: "Arts", Head: null })]);
    mock.onPut("/Departments/d-sci/assign").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationDepartments />);

    const dialog = await openAssignDialog(user);
    expect(within(dialog).getByText("Assign to Science")).toBeInTheDocument();

    const courseList = within(dialog).getByTestId("assign-courses");
    const trainerList = within(dialog).getByTestId("assign-trainers");
    // A course already in this department is shown ticked and locked; one in another department says where it is now.
    const chemistry = await within(courseList).findByRole("checkbox", { name: "Chemistry 101" });
    expect(chemistry).toBeChecked();
    expect(chemistry).toBeDisabled();
    expect(within(courseList).getByText("Currently: Arts")).toBeInTheDocument();

    const submit = within(dialog).getByRole("button", { name: /^Assign \d+ items?$/ });
    expect(submit).toBeDisabled(); // nothing picked yet

    await user.click(within(courseList).getByRole("checkbox", { name: "Physics 101" }));
    await user.click(within(courseList).getByRole("checkbox", { name: "Drawing Basics" }));
    await user.click(within(courseList).getByRole("checkbox", { name: "Drawing Basics" })); // un-picked again
    await user.click(await within(trainerList).findByRole("checkbox", { name: "Jane Doe" }));
    await user.click(within(dialog).getByRole("button", { name: "Assign 2 items" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Departments/d-sci/assign")).toBe(true));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/Departments/d-sci/assign")!.data);
    expect(body).toEqual({ UserIds: ["t-jane"], CourseIds: ["c-phys"] });

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Assigned to Science" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // The department list is refetched so the card's counts reflect the assignment.
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === "/Departments").length).toBeGreaterThanOrEqual(2));
  });

  it("filters the course list by search and toasts the server's error on failure", async () => {
    mock.onGet("/Departments").reply(200, [department()]);
    mock.onPut("/Departments/d-sci/assign").reply(404, { code: "not_found", title: "Department not found.", status: 404 });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationDepartments />);

    const dialog = await openAssignDialog(user);
    const courseList = within(dialog).getByTestId("assign-courses");
    await within(courseList).findByRole("checkbox", { name: "Physics 101" });

    await user.type(within(courseList).getByPlaceholderText("Search courses..."), "phys");
    expect(within(courseList).queryByRole("checkbox", { name: "Drawing Basics" })).not.toBeInTheDocument();
    await user.click(within(courseList).getByRole("checkbox", { name: "Physics 101" }));
    await user.click(within(dialog).getByRole("button", { name: "Assign 1 item" }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive", description: "Department not found." })));
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // stays open so the choice can be retried
  });
});
