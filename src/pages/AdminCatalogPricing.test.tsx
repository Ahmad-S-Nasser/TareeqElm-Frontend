/**
 * Wave F3a — the Admin shell around the shared "Catalog & pricing" body.
 *
 * `AdminCatalogPricing` and `OrganizationCatalogPricing` are two shells around one `CatalogPricingManager`, the way
 * `AdminRevenue`/`OrganizationRevenue` share `RevenueDashboard`. The body's own behaviour is covered in depth by
 * `OrganizationCatalogPricing.test.tsx`; this file only proves the Admin route really mounts that same body, with both
 * tabs and the same gating, so the two screens cannot drift apart.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminCatalogPricing from "./AdminCatalogPricing";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const pricing = {
  IsFree: false,
  Amount: 99,
  EffectiveAmount: 99,
  CompareAtAmount: null,
  SaleAmount: null,
  SaleStartsAt: null,
  SaleEndsAt: null,
  Currency: "USD",
  OnSale: false,
};

const course = {
  Id: "c1",
  Title: "Cloud Architecture Essentials",
  Description: null,
  Category: "Cloud",
  Level: "Intermediate",
  ImageUrl: null,
  InstructorId: "i1",
  InstructorName: "Instructor One",
  Status: "Published",
  LessonsCount: 6,
  EnrolledCount: 1,
  AccessModel: "AlaCarte",
  RequiresApproval: false,
  Pricing: { ...pricing, Amount: 79, EffectiveAmount: 79 },
  Owned: false,
  HasChapterPricing: false,
};

const track = {
  Id: "t1",
  Title: "Data Professional Path",
  Description: null,
  ImageUrl: null,
  Status: "Published",
  CoursesCount: 2,
  Pricing: pricing,
  IsFeatured: true,
  EstimatedHours: 24,
  DepartmentId: null,
  DepartmentName: null,
  OwnerInstructorId: null,
  OwnerInstructorName: null,
  Owned: false,
  CreatedAt: "2026-09-20T00:00:00Z",
};

let mock: MockAdapter;

const signIn = (permissions: string[] = ["pricing.manage", "tracks.manage"]) => {
  const user = makeUser({ Id: "admin-1", Role: "Admin", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet("/Settings").reply(200, { Currency: "USD" });
  mock.onGet("/Courses").reply(200, [course]);
  mock.onGet("/tracks").reply(200, [track], { "x-total-count": "1" });
});
afterEach(() => mock.restore());

describe("AdminCatalogPricing", () => {
  it("renders the shared manager under the Admin shell, courses tab first", async () => {
    signIn();
    renderWithProviders(<AdminCatalogPricing />);

    expect(await screen.findByRole("heading", { name: "Catalog & pricing" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Courses & pricing" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tracks" })).toBeInTheDocument();

    expect(await screen.findByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByText("$79.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit price: Cloud Architecture Essentials" })).toBeInTheDocument();
  });

  it("shows the Tracks tab with the same track controls the Organization shell offers", async () => {
    signIn();
    const user = userEvent.setup();
    renderWithProviders(<AdminCatalogPricing />);
    await user.click(await screen.findByRole("tab", { name: "Tracks" }));

    expect(await screen.findByText("Data Professional Path")).toBeInTheDocument();
    expect(screen.getByText("2 courses")).toBeInTheDocument();
    expect(screen.getByText("$99.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New track" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Courses: Data Professional Path" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit track price: Data Professional Path" })).toBeInTheDocument();
  });

  it("keeps the body's per-permission gating — the page adds no gate of its own", async () => {
    signIn([]);
    const user = userEvent.setup();
    renderWithProviders(<AdminCatalogPricing />);

    await screen.findByText("Cloud Architecture Essentials");
    expect(screen.queryByRole("button", { name: /^Edit price/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tracks" }));
    await screen.findByText("Data Professional Path");
    expect(screen.queryByRole("button", { name: "New track" })).not.toBeInTheDocument();
    // Read-only, not blank: the figures stay, the controls do not.
    expect(screen.getByText("$99.00")).toBeInTheDocument();
  });
});
