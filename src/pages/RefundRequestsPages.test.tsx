import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationRefundRequests from "./OrganizationRefundRequests";
import AdminRefundRequests from "./AdminRefundRequests";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

let mock: MockAdapter;

const signIn = (role: "Organization" | "Admin", permissions: string[]) => {
  const user = makeUser({ Id: `${role}-1`, Role: role, Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

const row = () => ({
  Id: "rr1",
  OrderId: "o1",
  OrganizationId: "org1",
  UserId: "u1",
  UserName: "Trainer One",
  LineIds: [],
  ItemTitles: [],
  RequestedAmount: null,
  Currency: "USD",
  OrderTotal: 10,
  OrderRefundedAmount: 0,
  Reason: "Please",
  Status: "Pending",
  DecidedBy: null,
  DecidedByName: null,
  DecidedAt: null,
  DecisionNote: null,
  ResultingRefundId: null,
  RequestedAt: "2026-09-20T10:00:00Z",
});

beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet("/refund-requests").reply(200, [row()], { "x-total-count": "1" });
});
afterEach(() => mock.restore());

describe.each([
  ["OrganizationRefundRequests", "Organization" as const, OrganizationRefundRequests],
  ["AdminRefundRequests", "Admin" as const, AdminRefundRequests],
])("%s", (_name, role, Page) => {
  it("mounts the shared review queue for a holder of refund-requests.manage", async () => {
    signIn(role, ["refund-requests.manage"]);
    renderWithProviders(<Page />);

    expect(screen.getByRole("heading", { name: "Refund requests" })).toBeInTheDocument();
    expect(await screen.findByTestId("refund-request-row-rr1")).toHaveTextContent("Trainer One");
    expect(screen.queryByTestId("refund-requests-no-access")).not.toBeInTheDocument();
  });

  it("shows a no-access message without refund-requests.manage and never queries", async () => {
    // refunds.manage (the direct admin refund) is a different permission and does not open this page.
    signIn(role, ["refunds.manage", "orders.manage"]);
    renderWithProviders(<Page />);

    expect(await screen.findByTestId("refund-requests-no-access")).toHaveTextContent(
      "You do not have permission to review refund requests."
    );
    expect(mock.history.get.some((r) => r.url === "/refund-requests")).toBe(false);
  });
});
