import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminAuditLog from "./AdminAuditLog";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

/** Mirrors real rows from the live `GET /api/admin/audit-logs`. */
const entry = (overrides: Record<string, unknown> = {}) => ({
  Id: "a1",
  ActorId: "admin-1",
  ActorRole: "Admin",
  ActorName: "Admin User",
  Action: "payout.mark_paid",
  TargetType: "Payout",
  TargetId: "p1",
  TargetName: null,
  Detail: "instructor=i1 amount=55.30 USD earnings=1 reference=F2C-LIVE-001",
  Ip: "127.0.0.1",
  At: "2026-09-24T01:16:53.000Z",
  ...overrides,
});

let mock: MockAdapter;

const signIn = (permissions: string[] = ["audit.view"]) => {
  const user = makeUser({ Id: "admin-1", Role: "Admin", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

beforeEach(() => {
  mock = new MockAdapter(api);
  signIn();
});
afterEach(() => mock.restore());

describe("AdminAuditLog", () => {
  it("lists entries with the resolved actor, a translated action and the detail", async () => {
    mock.onGet("/admin/audit-logs").reply(200, [entry()], { "x-total-count": "1" });
    renderWithProviders(<AdminAuditLog />);

    expect(await screen.findByRole("button", { name: "Admin User" })).toBeInTheDocument();
    expect(screen.getByText("marked a payout as paid")).toBeInTheDocument();
    expect(screen.getByText("Payout")).toBeInTheDocument();
    expect(screen.getByText(/reference=F2C-LIVE-001/)).toBeInTheDocument();
  });

  it("shows the target's resolved name when the server could resolve one", async () => {
    mock.onGet("/admin/audit-logs").reply(
      200,
      [entry({ Id: "a2", Action: "coupon.create", TargetType: "Coupon", TargetName: "WELCOME25" })],
      { "x-total-count": "1" }
    );
    renderWithProviders(<AdminAuditLog />);

    expect(await screen.findByText("created a coupon")).toBeInTheDocument();
    expect(screen.getByText("· WELCOME25")).toBeInTheDocument();
  });

  it("falls back to a neutral sentence for an action code it has no label for", async () => {
    mock.onGet("/admin/audit-logs").reply(200, [entry({ Action: "something.brand_new" })], { "x-total-count": "1" });
    renderWithProviders(<AdminAuditLog />);
    expect(await screen.findByText("performed an action")).toBeInTheDocument();
  });

  it("names the system as the actor when an entry has none", async () => {
    mock.onGet("/admin/audit-logs").reply(
      200,
      [entry({ ActorId: null, ActorName: null, ActorRole: null, Action: "order.expired" })],
      { "x-total-count": "1" }
    );
    renderWithProviders(<AdminAuditLog />);
    expect(await screen.findByText("System")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "System" })).not.toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", async () => {
    mock.onGet("/admin/audit-logs").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<AdminAuditLog />);
    expect(await screen.findByText("No audit entries match these filters.")).toBeInTheDocument();
  });

  it("shows an error state when the read fails", async () => {
    mock.onGet("/admin/audit-logs").reply(500);
    renderWithProviders(<AdminAuditLog />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("explains a 403 for a caller without audit.view", async () => {
    mock.reset();
    signIn([]);
    mock.onGet("/admin/audit-logs").reply(403, { code: "forbidden" });
    renderWithProviders(<AdminAuditLog />);
    expect(await screen.findByText(/do not have permission/i)).toBeInTheDocument();
  });

  it("filters by action", async () => {
    mock.onGet("/admin/audit-logs").reply(200, [entry()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminAuditLog />);
    await screen.findByText("marked a payout as paid");

    await user.click(screen.getByRole("combobox", { name: "Action" }));
    await user.click(await screen.findByRole("option", { name: "created a coupon" }));

    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/audit-logs").pop();
      expect(call?.params?.action).toBe("coupon.create");
    });
  });

  it("filters by target type and by date", async () => {
    mock.onGet("/admin/audit-logs").reply(200, [entry()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminAuditLog />);
    await screen.findByText("marked a payout as paid");

    await user.click(screen.getByRole("combobox", { name: "Target" }));
    await user.click(await screen.findByRole("option", { name: "Coupon" }));
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/audit-logs").pop();
      expect(call?.params?.targetType).toBe("Coupon");
    });

    await user.type(screen.getByLabelText("From"), "2026-09-01");
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/audit-logs").pop();
      expect(call?.params?.from).toBe("2026-09-01");
    });
  });

  it("filters by actor when a name is clicked, and clears it again", async () => {
    mock.onGet("/admin/audit-logs").reply(200, [entry()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminAuditLog />);

    await user.click(await screen.findByRole("button", { name: "Admin User" }));
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/audit-logs").pop();
      expect(call?.params?.actor).toBe("admin-1");
    });
    expect(screen.getByText(/Actor: Admin User/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear the actor filter" }));
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/audit-logs").pop();
      expect(call?.params?.actor).toBeUndefined();
    });
  });

  it("pages through a long trail", async () => {
    mock.onGet("/admin/audit-logs").reply(200, [entry()], { "x-total-count": "60" });
    const user = userEvent.setup();
    renderWithProviders(<AdminAuditLog />);
    await screen.findByText("marked a payout as paid");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      const call = mock.history.get.filter((r) => r.url === "/admin/audit-logs").pop();
      expect(call?.params?.page).toBe(2);
    });
  });
});
