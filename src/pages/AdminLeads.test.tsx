import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminLeads from "./AdminLeads";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

/**
 * Mirrors the live row returned by `GET /api/admin/leads` right now (the "Verify Corp" enquiry submitted by curl
 * against https://localhost:9889) — PascalCase, `Sme` rather than `SME`, and nulls wherever the visitor left a field
 * blank, which is exactly the shape the empty-field placeholders below have to survive.
 */
const lead = (overrides: Record<string, unknown> = {}) => ({
  Id: "6ab5cd4b59702549915cd6a3",
  CompanyName: "Verify Corp",
  ContactName: "QA Check",
  Email: "qa@verify.example",
  Phone: null,
  OrganizationType: "Sme",
  EstimatedLearners: null,
  Message: null,
  Locale: "en",
  SourcePage: "verify",
  Status: "New",
  StatusNote: null,
  CreatedAt: "2026-09-25T01:24:27.69Z",
  UpdatedAt: "2026-09-25T01:24:27.69Z",
  ...overrides,
});

let mock: MockAdapter;

const signIn = (permissions: string[] = ["leads.manage"]) => {
  const user = makeUser({ Id: "admin-1", Role: "Admin", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  return user;
};

const lastListCall = () => mock.history.get.filter((r) => r.url === "/admin/leads").pop();

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  signIn();
});
afterEach(() => mock.restore());

describe("AdminLeads", () => {
  it("lists leads with company, contact, email, organization type, status and source page", async () => {
    mock.onGet("/admin/leads").reply(200, [lead()], { "x-total-count": "1" });
    renderWithProviders(<AdminLeads />);

    expect(await screen.findByRole("button", { name: "Open details for Verify Corp" })).toBeInTheDocument();
    expect(screen.getByText("QA Check")).toBeInTheDocument();
    expect(screen.getByText("qa@verify.example")).toBeInTheDocument();
    // `Sme` is rendered as a label, never as the raw enum value.
    expect(screen.getByText("Small or medium business")).toBeInTheDocument();
    expect(screen.queryByText("Sme")).not.toBeInTheDocument();
    expect(screen.getByTestId("lead-status-badge")).toHaveTextContent("New");
    expect(screen.getByText("verify")).toBeInTheDocument();
    // The Mongo id is a key and a test id, never text on the screen.
    expect(screen.queryByText("6ab5cd4b59702549915cd6a3")).not.toBeInTheDocument();
    expect(lastListCall()?.params).toMatchObject({ page: 1, pageSize: 25 });
  });

  it("shows the empty state when no lead matches", async () => {
    mock.onGet("/admin/leads").reply(200, [], { "x-total-count": "0" });
    renderWithProviders(<AdminLeads />);
    expect(await screen.findByTestId("leads-empty")).toHaveTextContent("No leads match these filters.");
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/admin/leads").reply(500);
    renderWithProviders(<AdminLeads />);
    expect(await screen.findByTestId("leads-error")).toHaveTextContent(/server ran into a problem/i);
  });

  it("re-queries with the debounced search and the status / organization type filters", async () => {
    mock.onGet("/admin/leads").reply(200, [lead()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminLeads />);
    await screen.findByText("QA Check");

    await user.type(screen.getByRole("textbox", { name: "Search" }), "verify");
    await waitFor(() => expect(lastListCall()?.params?.search).toBe("verify"));

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Contacted" }));
    await waitFor(() => expect(lastListCall()?.params?.status).toBe("Contacted"));

    await user.click(screen.getByRole("combobox", { name: "Organization type" }));
    await user.click(await screen.findByRole("option", { name: "University" }));
    await waitFor(() => expect(lastListCall()?.params?.organizationType).toBe("University"));

    // Every filter is paged from the first page again.
    expect(lastListCall()?.params?.page).toBe(1);
  });

  it("sends the date range filters", async () => {
    mock.onGet("/admin/leads").reply(200, [lead()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<AdminLeads />);
    await screen.findByText("QA Check");

    await user.type(screen.getByLabelText("From"), "2026-09-01");
    await waitFor(() => expect(lastListCall()?.params?.from).toBe("2026-09-01"));
    await user.type(screen.getByLabelText("To"), "2026-09-30");
    await waitFor(() => expect(lastListCall()?.params?.to).toBe("2026-09-30"));
  });

  it("opens the detail panel with the message, estimated learners and phone", async () => {
    const full = lead({
      Phone: "+962790000000",
      EstimatedLearners: "50-200",
      Message: "We would like a demo for our L&D team.",
    });
    mock.onGet("/admin/leads").reply(200, [full], { "x-total-count": "1" });
    mock.onGet(`/admin/leads/${full.Id}`).reply(200, full);
    const user = userEvent.setup();
    renderWithProviders(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "Open details for Verify Corp" }));

    const panel = await screen.findByTestId("lead-detail");
    expect(within(panel).getByTestId("lead-message")).toHaveTextContent("We would like a demo for our L&D team.");
    expect(within(panel).getByTestId("lead-estimated-learners")).toHaveTextContent("50-200");
    expect(within(panel).getByText("+962790000000")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "qa@verify.example" })).toHaveAttribute(
      "href",
      "mailto:qa@verify.example"
    );
  });

  it("falls back to placeholders for the fields the visitor left blank", async () => {
    mock.onGet("/admin/leads").reply(200, [lead()], { "x-total-count": "1" });
    mock.onGet(`/admin/leads/${lead().Id}`).reply(200, lead());
    const user = userEvent.setup();
    renderWithProviders(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "Open details for Verify Corp" }));

    const panel = await screen.findByTestId("lead-detail");
    expect(within(panel).getByTestId("lead-message")).toHaveTextContent("The visitor did not leave a message.");
    expect(within(panel).getByTestId("lead-estimated-learners")).toHaveTextContent("Not provided");
  });

  it("keeps showing the row's own data when the detail refresh fails, with a warning", async () => {
    const row = lead({ Message: "We would like a demo." });
    mock.onGet("/admin/leads").reply(200, [row], { "x-total-count": "1" });
    mock.onGet(`/admin/leads/${row.Id}`).reply(500);
    const user = userEvent.setup();
    renderWithProviders(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "Open details for Verify Corp" }));

    const panel = await screen.findByTestId("lead-detail");
    expect(await within(panel).findByTestId("lead-detail-error")).toBeInTheDocument();
    expect(within(panel).getByTestId("lead-message")).toHaveTextContent("We would like a demo.");
  });

  it("updates the status through PUT and invalidates the list", async () => {
    const row = lead();
    mock.onGet("/admin/leads").reply(200, [row], { "x-total-count": "1" });
    mock.onGet(`/admin/leads/${row.Id}`).reply(200, row);
    mock.onPut(`/admin/leads/${row.Id}/status`).reply(204);
    const user = userEvent.setup();
    renderWithProviders(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "Open details for Verify Corp" }));
    const panel = await screen.findByTestId("lead-detail");

    await user.click(within(panel).getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Qualified" }));
    await user.type(within(panel).getByLabelText("Status note"), "Budget confirmed.");
    await user.click(within(panel).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(mock.history.put[0].url).toBe(`/admin/leads/${row.Id}/status`);
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ Status: "Qualified", StatusNote: "Budget confirmed." });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Lead status updated." }));
    // The list is re-read, so the badge and "last updated" come back from the server rather than being guessed.
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === "/admin/leads").length).toBeGreaterThan(1));
  });

  it("surfaces a failed status update as an error toast", async () => {
    const row = lead();
    mock.onGet("/admin/leads").reply(200, [row], { "x-total-count": "1" });
    mock.onGet(`/admin/leads/${row.Id}`).reply(200, row);
    mock.onPut(`/admin/leads/${row.Id}/status`).reply(404, { code: "not_found", title: "Not found." });
    const user = userEvent.setup();
    renderWithProviders(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "Open details for Verify Corp" }));
    const panel = await screen.findByTestId("lead-detail");
    await user.click(within(panel).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Could not update the lead status.",
          description: "Not found.",
        })
      )
    );
  });

  it("blocks the inbox entirely without leads.manage — and never calls the endpoint", async () => {
    mock.reset();
    signIn([]);
    mock.onGet("/admin/leads").reply(200, [lead()], { "x-total-count": "1" });
    renderWithProviders(<AdminLeads />);

    expect(await screen.findByTestId("leads-forbidden")).toHaveTextContent(
      "You do not have permission to view leads."
    );
    expect(screen.queryByText("Verify Corp")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Search" })).not.toBeInTheDocument();
    await waitFor(() => expect(mock.history.get.some((r) => r.url === "/Auth/me")).toBe(true));
    expect(lastListCall()).toBeUndefined();
  });
});
