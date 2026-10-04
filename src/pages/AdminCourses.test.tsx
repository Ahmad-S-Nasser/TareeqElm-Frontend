import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminCourses from "./AdminCourses";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

/** A platform course as `GET /api/Courses` answers an Admin caller (already scoped server-side). */
const course = (overrides: Record<string, unknown> = {}) => ({
  Id: "c1",
  Title: "Cloud Architecture Essentials",
  Description: "A platform-owned course.",
  Category: "Cloud",
  Level: "Intermediate",
  ImageUrl: null,
  Status: "Published",
  LessonsCount: 6,
  EnrolledCount: 12,
  AccessModel: "Free",
  Pricing: null,
  OrganizationId: null,
  OrganizationName: null,
  LicensePrice: { IsFree: false, Amount: 500, EffectiveAmount: 500, CompareAtAmount: null, SaleAmount: null, SaleStartsAt: null, SaleEndsAt: null, Currency: "USD", OnSale: false },
  ...overrides,
});

let mock: MockAdapter;

const signIn = (permissions: string[] = ["courses.write"]) => {
  const user = makeUser({ Id: "admin-1", Role: "Admin", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  return user;
};

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  signIn();
  mock.onGet("/Settings").reply(200, { Currency: "USD" });
});
afterEach(() => mock.restore());

describe("AdminCourses", () => {
  it("lists platform courses with the ownership badge, license price and status", async () => {
    mock.onGet("/Courses").reply(200, [course()]);
    renderWithProviders(<AdminCourses />);

    expect(await screen.findByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows the empty state when there are no platform courses", async () => {
    mock.onGet("/Courses").reply(200, []);
    renderWithProviders(<AdminCourses />);

    expect(await screen.findByText("No platform courses yet.")).toBeInTheDocument();
  });

  it("creates a platform course through POST /Courses", async () => {
    mock.onGet("/Courses").reply(200, []);
    mock.onPost("/Courses").reply(201, course());
    const user = userEvent.setup();
    renderWithProviders(<AdminCourses />);
    await screen.findByText("No platform courses yet.");

    await user.click(screen.getByRole("button", { name: "New course" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "Security Fundamentals");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/Courses")).toBe(true));
    expect(JSON.parse(mock.history.post.at(-1)!.data)).toMatchObject({ Title: "Security Fundamentals" });
  });

  it("refuses to create a course with no title", async () => {
    mock.onGet("/Courses").reply(200, []);
    const user = userEvent.setup();
    renderWithProviders(<AdminCourses />);
    await screen.findByText("No platform courses yet.");

    await user.click(screen.getByRole("button", { name: "New course" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Enter a title.", variant: "destructive" }));
    expect(mock.history.post).toHaveLength(0);
  });

  it("publishes a draft course through PUT /Courses/{id}", async () => {
    mock.onGet("/Courses").reply(200, [course({ Status: "Draft" })]);
    mock.onPut("/Courses/c1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<AdminCourses />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/c1")).toBe(true));
    expect(JSON.parse(mock.history.put.at(-1)!.data)).toMatchObject({ Status: "Published" });
  });

  it("sets a license price through PUT /Courses/{id}/license-price", async () => {
    mock.onGet("/Courses").reply(200, [course({ LicensePrice: null })]);
    mock.onPut("/Courses/c1/license-price").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<AdminCourses />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByText("Not yet priced for licensing"));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("License price"), "750");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/c1/license-price")).toBe(true));
    expect(JSON.parse(mock.history.put.at(-1)!.data)).toMatchObject({ Amount: 750, Currency: "USD" });
  });

  it("deletes a course after confirming", async () => {
    mock.onGet("/Courses").reply(200, [course()]);
    mock.onDelete("/Courses/c1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<AdminCourses />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Delete course" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Delete course" }));

    await waitFor(() => expect(mock.history.delete.some((r) => r.url === "/Courses/c1")).toBe(true));
  });

  it("shows an organization-owned course's resolved name instead of Platform", async () => {
    mock.onGet("/Courses").reply(200, [course({ OrganizationId: "org-1", OrganizationName: "Acme Org" })]);
    renderWithProviders(<AdminCourses />);

    await screen.findByText("Cloud Architecture Essentials");
    expect(screen.getByText("Acme Org")).toBeInTheDocument();
    expect(screen.queryByText("Platform")).not.toBeInTheDocument();
  });
});
