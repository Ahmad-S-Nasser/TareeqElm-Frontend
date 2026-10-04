import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { OrganizationSidebarContent } from "./OrganizationSidebar";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "org-1", Role: "Organization", Permissions: ["organization.view", "terms.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

describe("OrganizationSidebar academic structure entries", () => {
  it("shows Academic Years and Grades for a School organization", async () => {
    mock.onGet("/Organization/profile").reply(200, { Id: "o1", Name: "Green Valley", LogoUrl: null, Kind: "School" });
    renderWithProviders(<OrganizationSidebarContent collapsed={false} />);

    expect(await screen.findByRole("link", { name: /Academic Years/ })).toHaveAttribute("href", "/organization/academic-years");
    expect(screen.getByRole("link", { name: /Grades/ })).toHaveAttribute("href", "/organization/grades");
  });

  it("hides them for any other organization kind", async () => {
    mock.onGet("/Organization/profile").reply(200, { Id: "o1", Name: "Acme", LogoUrl: null, Kind: "Company" });
    renderWithProviders(<OrganizationSidebarContent collapsed={false} />);

    expect(await screen.findByRole("link", { name: /Academic Terms/ })).toBeInTheDocument();
    await waitFor(() => expect(mock.history.get.some((r) => r.url === "/Organization/profile")).toBe(true));
    expect(screen.queryByRole("link", { name: /Academic Years/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Grades/ })).not.toBeInTheDocument();
  });
});
