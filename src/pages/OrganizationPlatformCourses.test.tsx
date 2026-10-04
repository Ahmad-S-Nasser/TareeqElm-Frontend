import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationPlatformCourses from "./OrganizationPlatformCourses";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const platformCourse = (overrides: Record<string, unknown> = {}) => ({
  Id: "pc1",
  Title: "Cloud Architecture Essentials",
  Description: "A platform-owned course.",
  Category: "Cloud",
  Level: "Intermediate",
  ImageUrl: null,
  LicensePrice: { IsFree: false, Amount: 500, EffectiveAmount: 500, CompareAtAmount: null, SaleAmount: null, SaleStartsAt: null, SaleEndsAt: null, Currency: "USD", OnSale: false },
  Licensed: false,
  LicensedAt: null,
  ...overrides,
});

let mock: MockAdapter;

const signIn = () => {
  const user = makeUser({ Id: "org-1", Role: "Organization", Permissions: [] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  signIn();
});
afterEach(() => mock.restore());

describe("OrganizationPlatformCourses", () => {
  it("lists licensable platform courses with their price", async () => {
    mock.onGet("/Organization/platform-courses").reply(200, [platformCourse()], { "x-total-count": "1" });
    renderWithProviders(<OrganizationPlatformCourses />);

    expect(await screen.findByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "License this course" })).toBeInTheDocument();
  });

  it("shows the empty state when nothing is available to license", async () => {
    mock.onGet("/Organization/platform-courses").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<OrganizationPlatformCourses />);

    expect(await screen.findByText("No platform courses are available to license yet.")).toBeInTheDocument();
  });

  it("shows an already-licensed course as Licensed, with no license button", async () => {
    mock.onGet("/Organization/platform-courses").reply(200, [
      platformCourse({ Licensed: true, LicensedAt: "2026-09-01T00:00:00Z" }),
    ], { "x-total-count": "1" });
    renderWithProviders(<OrganizationPlatformCourses />);

    await screen.findByText("Cloud Architecture Essentials");
    expect(screen.queryByRole("button", { name: "License this course" })).not.toBeInTheDocument();
  });

  it("licenses a course through POST /checkout with a CourseLicense item", async () => {
    mock.onGet("/Organization/platform-courses").reply(200, [platformCourse()], { "x-total-count": "1" });
    mock.onPost("/checkout").reply(200, {
      OrderId: "o1", Provider: "manual", ProviderRef: "tq_1", Status: "PendingPayment", Currency: "USD", Total: 500,
      SessionId: null, RedirectUrl: null, Instructions: "Wire 500 USD to account 123.", RequiresManualCapture: true, Replayed: false,
    });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPlatformCourses />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "License this course" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "License this course" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/checkout")).toBe(true));
    const body = JSON.parse(mock.history.post.find((r) => r.url === "/checkout")!.data);
    expect(body).toMatchObject({ Items: [{ ItemType: "CourseLicense", ItemId: "pc1" }] });
    expect(await within(dialog).findByText("Wire 500 USD to account 123.")).toBeInTheDocument();
  });

  it("filters the catalog by the search term", async () => {
    mock.onGet("/Organization/platform-courses").reply(200, [platformCourse()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPlatformCourses />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.type(screen.getByLabelText("Search platform courses"), "cloud");
    await waitFor(() =>
      expect(mock.history.get.filter((r) => r.url === "/Organization/platform-courses").at(-1)?.params).toMatchObject({ search: "cloud" })
    );
  });
});
