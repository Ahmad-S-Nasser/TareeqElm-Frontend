import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminOrganizations from "./AdminOrganizations";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const org = (overrides: Record<string, unknown> = {}) => ({
  Id: "o1",
  Name: "Acme Corp",
  Slug: "acme",
  LogoUrl: null,
  ContactEmail: "ops@acme.example",
  IsActive: true,
  IsLegacy: false,
  Kind: "Company",
  CreatedAt: "2026-09-01T00:00:00Z",
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "admin-1", Role: "Admin", Permissions: ["organizations.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

describe("AdminOrganizations", () => {
  it("lists organizations with their localized kind", async () => {
    mock.onGet("/organizations").reply(200, [org(), org({ Id: "o2", Name: "Green Valley School", Kind: "School", Slug: null, ContactEmail: null })]);
    renderWithProviders(<AdminOrganizations />);

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    const rows = screen.getAllByTestId("organization-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Company")).toBeInTheDocument();
    expect(within(rows[1]).getByText("School")).toBeInTheDocument();
    expect(screen.getByText("ops@acme.example")).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/organizations").reply(500);
    renderWithProviders(<AdminOrganizations />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("creates a School organization with the Kind selector", async () => {
    mock.onGet("/organizations").reply(200, []);
    mock.onPost("/organizations").reply(200, org({ Name: "New School", Kind: "School" }));
    const u = userEvent.setup();
    renderWithProviders(<AdminOrganizations />);
    await screen.findByText("No organizations found.");

    await u.click(screen.getByRole("button", { name: /New organization/ }));
    await u.type(await screen.findByLabelText("Name"), "New School");
    await u.click(screen.getByRole("combobox", { name: "Organization type" }));
    await u.click(await screen.findByRole("option", { name: "School" }));
    await u.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({ Name: "New School", Kind: "School" });
    expect(toastMock).toHaveBeenCalledWith({ title: "Organization created" });
  });

  it("edits an organization's kind and sends a full save body", async () => {
    mock.onGet("/organizations").reply(200, [org()]);
    mock.onPut("/organizations/o1").reply(200, org({ Kind: "Organization" }));
    const u = userEvent.setup();
    renderWithProviders(<AdminOrganizations />);

    await u.click(await screen.findByRole("button", { name: "Edit Acme Corp" }));
    await u.click(screen.getByRole("combobox", { name: "Organization type" }));
    await u.click(await screen.findByRole("option", { name: "Organization" }));
    await u.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ Name: "Acme Corp", Slug: "acme", ContactEmail: "ops@acme.example", Kind: "Organization" });
  });

  it("shows the current seat cap and overrides it independently of the kind/name fields", async () => {
    mock.onGet("/organizations").reply(200, [org({ TraineeCap: 250, PackageTier: "Package 1" })]);
    mock.onPut("/organizations/o1").reply(200, org({ TraineeCap: 500, PackageTier: "Negotiated" }));
    const u = userEvent.setup();
    renderWithProviders(<AdminOrganizations />);

    expect(await screen.findByText("250")).toBeInTheDocument();
    expect(screen.getByText("· Package 1")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Edit Acme Corp" }));
    const capInput = await screen.findByLabelText("Trainee cap");
    expect(capInput).toHaveValue(250);
    await u.clear(capInput);
    await u.type(capInput, "500");
    const tierInput = screen.getByLabelText("Package label");
    await u.clear(tierInput);
    await u.type(tierInput, "Negotiated");
    await u.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toMatchObject({ TraineeCap: 500, PackageTier: "Negotiated" });
  });

  it("rejects a non-numeric trainee cap without calling the API", async () => {
    mock.onGet("/organizations").reply(200, [org()]);
    const u = userEvent.setup();
    renderWithProviders(<AdminOrganizations />);

    await u.click(await screen.findByRole("button", { name: "Edit Acme Corp" }));
    await u.type(screen.getByLabelText("Trainee cap"), "-5");
    await u.click(screen.getByRole("button", { name: "Save changes" }));

    expect(toastMock).toHaveBeenCalledWith({ variant: "destructive", title: "The trainee cap must be a whole number of 0 or more." });
    expect(mock.history.put).toHaveLength(0);
  });

  it("an organization shown as uncapped sends no TraineeCap when every other field is unchanged", async () => {
    mock.onGet("/organizations").reply(200, [org()]);
    mock.onPut("/organizations/o1").reply(200, org({ Kind: "Organization" }));
    const u = userEvent.setup();
    renderWithProviders(<AdminOrganizations />);

    expect(await screen.findByText("Uncapped")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Edit Acme Corp" }));
    await u.click(screen.getByRole("combobox", { name: "Organization type" }));
    await u.click(await screen.findByRole("option", { name: "Organization" }));
    await u.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ Name: "Acme Corp", Slug: "acme", ContactEmail: "ops@acme.example", Kind: "Organization" });
  });

  it("suspends an organization from the row switch, but never the legacy one", async () => {
    mock.onGet("/organizations").reply(200, [org(), org({ Id: "legacy", Name: "Legacy Org", IsLegacy: true })]);
    mock.onPut("/organizations/o1/active").reply(204);
    const u = userEvent.setup();
    renderWithProviders(<AdminOrganizations />);

    expect(await screen.findByRole("switch", { name: "Active: Legacy Org" })).toBeDisabled();
    await u.click(screen.getByRole("switch", { name: "Active: Acme Corp" }));

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(mock.history.put[0].url).toBe("/organizations/o1/active");
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ IsActive: false });
  });
});
