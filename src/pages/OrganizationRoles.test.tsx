import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationRoles from "./OrganizationRoles";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

let mock: MockAdapter;
afterEach(() => mock.restore());

describe("OrganizationRoles", () => {
  it("an organization holding roles.manage (catalog v12 phase 5 default) reaches the real role editor", async () => {
    mock = new MockAdapter(api);
    const user = makeUser({ Role: "Organization", Permissions: ["roles.manage", "organization.view"] });
    seedSession(user);
    mock.onGet("/Auth/me").reply(200, user);
    mock.onGet("/permissions").reply(200, [{ Name: "exams.view", Category: "insight", Description: "View exams", LearnerScoped: false, AdminOnly: false }]);
    mock.onGet("/roles").reply(200, [
      { Id: "o", Name: "Organization", Description: null, Permissions: ["exams.view"], IsSystem: true, IsLocked: true, BaseRole: "Organization", UserCount: 1, CreatedAt: "2026-01-01T00:00:00Z", UpdatedAt: "2026-01-01T00:00:00Z" },
    ]);

    renderWithProviders(<OrganizationRoles />);

    expect(await screen.findByRole("list", { name: /^roles$/i })).toBeInTheDocument();
    // Locked for Organization: this is one of the three shared system roles, read-only even though it reaches the editor.
    expect(screen.getByText(/locked/i)).toBeInTheDocument();
  });

  it("an organization without roles.manage sees the read-only summary instead", async () => {
    mock = new MockAdapter(api);
    const user = makeUser({ Role: "Organization", Permissions: ["organization.view", "exams.view"] });
    seedSession(user);
    mock.onGet("/Auth/me").reply(200, user);

    renderWithProviders(<OrganizationRoles />);

    expect(await screen.findByText(/organization's or the platform's administrator/i)).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === "/roles")).toBe(false);
  });
});
