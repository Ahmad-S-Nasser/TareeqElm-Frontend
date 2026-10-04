/**
 * `OrganizationReports` is a launcher: one card per dedicated report page, each shown only to a user holding the
 * permission its report's endpoint needs. It loads no report data itself (the old always-on department charts moved to
 * the Department Analytics report, behind its Generate button).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationReports from "./OrganizationReports";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
});
afterEach(() => mock.restore());

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "u1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  return user;
};

const EXPECTED = [
  ["financialOrders", "/organization/reports/financial"],
  ["departmentAnalytics", "/organization/reports/department-analytics"],
  ["traineePerformance", "/organization/reports/trainee-performance"],
  ["courseCompletion", "/organization/reports/course-completion"],
  ["instructorActivity", "/organization/reports/instructor-activity"],
] as const;

describe("OrganizationReports launcher", () => {
  it("renders the 5 report cards, each linking to its dedicated page", async () => {
    signIn(["organization.view", "invoices.view", "reports.view"]);
    renderWithProviders(<OrganizationReports />);

    for (const [id, path] of EXPECTED) {
      const card = await screen.findByTestId(`report-card-${id}`);
      const link = card.querySelector("a");
      expect(link).not.toBeNull();
      expect(link!.getAttribute("href")).toBe(path);
    }
    expect(screen.getAllByRole("link", { name: /Open report/ })).toHaveLength(5);
    expect(screen.getByText("Financial & orders report")).toBeInTheDocument();
    expect(screen.getByText("Department analytics")).toBeInTheDocument();
  });

  it("loads no report data and has no disabled coming-soon cards", async () => {
    signIn(["organization.view", "invoices.view", "reports.view"]);
    renderWithProviders(<OrganizationReports />);

    await screen.findByTestId("report-card-financialOrders");
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === "/Organization/departments")).toBe(false);
    expect(mock.history.get.some((r) => r.url?.startsWith("/organization/invoices"))).toBe(false);
  });

  it("only shows the cards the user has the permission for", async () => {
    signIn(["organization.view"]);
    renderWithProviders(<OrganizationReports />);

    expect(await screen.findByTestId("report-card-departmentAnalytics")).toBeInTheDocument();
    expect(screen.queryByTestId("report-card-financialOrders")).not.toBeInTheDocument();
    expect(screen.queryByTestId("report-card-traineePerformance")).not.toBeInTheDocument();
  });
});
