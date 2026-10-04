import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { RefundRequestsQueue } from "./RefundRequestsQueue";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

const request = (overrides: Record<string, unknown> = {}) => ({
  Id: "rr1",
  OrderId: "o1",
  OrganizationId: "org1",
  UserId: "u1",
  UserName: "Trainer One",
  LineIds: [],
  ItemTitles: ["Cloud Architecture Essentials"],
  RequestedAmount: 25,
  Currency: "USD",
  OrderTotal: 59.25,
  OrderRefundedAmount: 0,
  Reason: "Bought the wrong course",
  Status: "Pending",
  DecidedBy: null,
  DecidedByName: null,
  DecidedAt: null,
  DecisionNote: null,
  ResultingRefundId: null,
  RequestedAt: "2026-09-20T10:00:00Z",
  ...overrides,
});

let mock: MockAdapter;

const listCalls = () => mock.history.get.filter((r) => r.url === "/refund-requests");
const lastListCall = () => listCalls().pop();

beforeEach(() => {
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "org-1", Role: "Organization", Permissions: ["refund-requests.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

describe("RefundRequestsQueue", () => {
  it("lists requests with trainee, amount, reason, date and status, pending first by default", async () => {
    mock.onGet("/refund-requests").reply(200, [request(), request({ Id: "rr2", RequestedAmount: null, UserName: null })], {
      "x-total-count": "2",
    });
    renderWithProviders(<RefundRequestsQueue />);

    const row = await screen.findByTestId("refund-request-row-rr1");
    expect(row).toHaveTextContent("Trainer One");
    expect(row).toHaveTextContent("Cloud Architecture Essentials");
    expect(row).toHaveTextContent("$25.00");
    expect(row).toHaveTextContent("Bought the wrong course");
    expect(within(row).getByTestId("refund-request-status-badge")).toHaveTextContent("Pending review");
    // A whole-order request and a deleted account read as words, not blanks.
    expect(screen.getByTestId("refund-request-row-rr2")).toHaveTextContent("Everything refundable");
    expect(screen.getByTestId("refund-request-row-rr2")).toHaveTextContent("Deleted account");
    expect(lastListCall()?.params?.status).toBe("Pending");
  });

  it("offers no actions on a request that has already been decided", async () => {
    mock.onGet("/refund-requests").reply(200, [request({ Status: "Approved" })], { "x-total-count": "1" });
    renderWithProviders(<RefundRequestsQueue />);

    await screen.findByTestId("refund-request-row-rr1");
    expect(screen.queryByTestId("refund-request-approve-rr1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("refund-request-reject-rr1")).not.toBeInTheDocument();
  });

  it("re-queries as the status and date filters change", async () => {
    mock.onGet("/refund-requests").reply(200, [request()], { "x-total-count": "1" });
    const user = userEvent.setup();
    renderWithProviders(<RefundRequestsQueue />);
    await screen.findByTestId("refund-request-row-rr1");

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "All statuses" }));
    await waitFor(() => expect(lastListCall()?.params?.status).toBeUndefined());

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Rejected" }));
    await waitFor(() => expect(lastListCall()?.params?.status).toBe("Rejected"));

    await user.type(screen.getByLabelText("From"), "2026-09-01");
    await waitFor(() => expect(lastListCall()?.params?.from).toBe("2026-09-01"));
    await user.type(screen.getByLabelText("To"), "2026-09-30");
    await waitFor(() => expect(lastListCall()?.params?.to).toBe("2026-09-30"));
  });

  it("shows the empty and error states", async () => {
    mock.onGet("/refund-requests").replyOnce(200, [], { "x-total-count": "0" });
    const { unmount } = renderWithProviders(<RefundRequestsQueue />);
    expect(await screen.findByTestId("refund-requests-empty")).toHaveTextContent("No refund requests match these filters.");
    unmount();

    mock.onGet("/refund-requests").reply(500);
    renderWithProviders(<RefundRequestsQueue />);
    expect(await screen.findByTestId("refund-requests-error")).toBeInTheDocument();
  });

  it("pages through results when there is more than one page", async () => {
    mock.onGet("/refund-requests").reply(200, [request()], { "x-total-count": "45" });
    const user = userEvent.setup();
    renderWithProviders(<RefundRequestsQueue />);

    expect(await screen.findByTestId("refund-requests-pagination")).toHaveTextContent("Page 1 of 3 · 45 requests");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastListCall()?.params?.page).toBe(2), { timeout: 5000 });
  });

  it("approves immediately and refreshes the list", async () => {
    mock.onGet("/refund-requests").reply(200, [request()], { "x-total-count": "1" });
    mock.onPost("/refund-requests/rr1/approve").reply(200, request({ Status: "Approved", ResultingRefundId: "rf1" }));
    const user = userEvent.setup();
    renderWithProviders(<RefundRequestsQueue />);

    const before = listCalls().length;
    await user.click(await screen.findByTestId("refund-request-approve-rr1"));

    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual(["/refund-requests/rr1/approve"]));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({});
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    expect(screen.queryByTestId("refund-request-error-rr1")).not.toBeInTheDocument();
  });

  it("shows the refund's real reason on the row when an approval cannot run", async () => {
    mock.onGet("/refund-requests").reply(200, [request()], { "x-total-count": "1" });
    mock.onPost("/refund-requests/rr1/approve").reply(400, {
      code: "refund.invalid",
      title: "Use an amount above zero that does not exceed what is left to refund.",
    });
    const user = userEvent.setup();
    renderWithProviders(<RefundRequestsQueue />);

    await user.click(await screen.findByTestId("refund-request-approve-rr1"));

    expect(await screen.findByTestId("refund-request-error-rr1")).toHaveTextContent(
      "Use an amount above zero that does not exceed what is left to refund."
    );
  });

  it("requires a note to reject, then sends it", async () => {
    mock.onGet("/refund-requests").reply(200, [request()], { "x-total-count": "1" });
    mock.onPost("/refund-requests/rr1/reject").reply(200, request({ Status: "Rejected", DecisionNote: "Too late" }));
    const user = userEvent.setup();
    renderWithProviders(<RefundRequestsQueue />);

    await user.click(await screen.findByTestId("refund-request-reject-rr1"));
    await user.click(await screen.findByTestId("refund-request-reject-submit"));
    expect(screen.getByTestId("refund-request-reject-error")).toHaveTextContent("A note is required to reject a request.");
    expect(mock.history.post).toHaveLength(0);

    await user.type(screen.getByLabelText("Note"), "Too late");
    await user.click(screen.getByTestId("refund-request-reject-submit"));

    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual(["/refund-requests/rr1/reject"]));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Note: "Too late" });
    await waitFor(() => expect(screen.queryByTestId("refund-request-reject-submit")).not.toBeInTheDocument());
  });
});
