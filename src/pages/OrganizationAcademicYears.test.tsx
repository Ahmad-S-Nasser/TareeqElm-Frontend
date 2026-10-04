import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationAcademicYears from "./OrganizationAcademicYears";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const year = (overrides: Record<string, unknown> = {}) => ({
  Id: "y1",
  Name: "2026/2027",
  StartDate: "2026-09-01T00:00:00Z",
  EndDate: "2027-06-30T00:00:00Z",
  Status: "upcoming",
  TermsCount: 2,
  GradesCount: 1,
  ...overrides,
});

let mock: MockAdapter;
const signIn = (kind: string, permissions: string[] = ["organization.view", "academic-structure.manage"]) => {
  const user = makeUser({ Id: "org-1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Organization/profile").reply(200, { Id: "o1", Name: "Green Valley", LogoUrl: null, Kind: kind });
};

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
});
afterEach(() => mock.restore());

describe("OrganizationAcademicYears", () => {
  it("lists academic years with their status and counts", async () => {
    signIn("School");
    mock.onGet("/academic-years").reply(200, [year()]);
    renderWithProviders(<OrganizationAcademicYears />);

    const card = await screen.findByTestId("academic-year-card");
    expect(within(card).getByText("2026/2027")).toBeInTheDocument();
    expect(within(card).getByText("Upcoming")).toBeInTheDocument();
    expect(within(card).getByText("2 terms")).toBeInTheDocument();
    expect(within(card).getByText("1 grade")).toBeInTheDocument();
  });

  it("creates an academic year for a School organization", async () => {
    signIn("School");
    mock.onGet("/academic-years").reply(200, []);
    mock.onPost("/academic-years").reply(200, year());
    const u = userEvent.setup();
    renderWithProviders(<OrganizationAcademicYears />);

    await u.click(await screen.findByRole("button", { name: /New academic year/ }));
    await u.type(screen.getByLabelText("Name"), "2026/2027");
    await u.type(screen.getByLabelText("Start date"), "2026-09-01");
    await u.type(screen.getByLabelText("End date"), "2027-06-30");
    await u.click(screen.getByRole("button", { name: "Create year" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Name: "2026/2027", StartDate: "2026-09-01", EndDate: "2027-06-30", Status: "upcoming" });
    expect(toastMock).toHaveBeenCalledWith({ title: "Academic year created" });
  });

  it("rejects an end date before the start date without calling the API", async () => {
    signIn("School");
    mock.onGet("/academic-years").reply(200, []);
    const u = userEvent.setup();
    renderWithProviders(<OrganizationAcademicYears />);

    await u.click(await screen.findByRole("button", { name: /New academic year/ }));
    await u.type(screen.getByLabelText("Name"), "Bad");
    await u.type(screen.getByLabelText("Start date"), "2027-06-30");
    await u.type(screen.getByLabelText("End date"), "2026-09-01");
    await u.click(screen.getByRole("button", { name: "Create year" }));

    expect(toastMock).toHaveBeenCalledWith({ variant: "destructive", title: "The end date must be after the start date." });
    expect(mock.history.post).toHaveLength(0);
  });

  it("explains the feature is school-only and hides write actions for a non-School organization", async () => {
    signIn("Company");
    mock.onGet("/academic-years").reply(200, [year()]);
    renderWithProviders(<OrganizationAcademicYears />);

    expect(await screen.findByText(/only available for school-type organizations/)).toBeInTheDocument();
    expect(screen.getByText("2026/2027")).toBeInTheDocument(); // reads still work
    expect(screen.queryByRole("button", { name: /New academic year/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
  });
});
