/**
 * Instructor Activity report: sessions taught, attendance rate, content uploads and current course load per instructor,
 * gated on reports.view, loaded only after "Generate report" from GET /organization/reports/instructor-activity.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import InstructorActivityReport from "./InstructorActivityReport";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const REPORT = {
  Rows: [
    { InstructorId: "i1", InstructorName: "Amal Haddad", SessionsTaught: 4, AttendanceRate: 0.85, ContentUploads: 3, ActiveCourses: 2, ActiveEnrollments: 17 },
    { InstructorId: "i2", InstructorName: "Basel Nour", SessionsTaught: 0, AttendanceRate: null, ContentUploads: 1, ActiveCourses: 1, ActiveEnrollments: 0 },
  ],
};

const EMPTY_REPORT = { Rows: [] };

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet("/Organization/instructors").reply(200, [
    { Id: "i1", FullName: "Amal Haddad" },
    { Id: "i2", FullName: "Basel Nour" },
  ]);
});
afterEach(() => mock.restore());

const signIn = (permissions: string[]) => {
  const user = makeUser({ Id: "u1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

const reportCalls = () => mock.history.get.filter((r) => r.url === "/organization/reports/instructor-activity");

describe("InstructorActivityReport", () => {
  it("loads nothing until Generate, then shows one row per instructor", async () => {
    signIn(["reports.view"]);
    mock.onGet("/organization/reports/instructor-activity").reply(200, REPORT);
    const user = userEvent.setup();
    renderWithProviders(<InstructorActivityReport />);

    expect(await screen.findByTestId("report-prompt")).toBeInTheDocument();
    expect(reportCalls()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Generate report" }));

    const table = await screen.findByTestId("instructor-activity-rows");
    expect(table).toHaveTextContent("Amal Haddad");
    expect(table).toHaveTextContent("Basel Nour");
    for (const header of ["Instructor", "Sessions taught", "Attendance rate", "Content uploads", "Active courses", "Active enrollments"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const amal = screen.getByTestId("instructor-activity-row-i1");
    expect(within(amal).getByTestId("attendance-rate")).toHaveTextContent("85%");
    expect(amal).toHaveTextContent("17");
    expect(reportCalls()).toHaveLength(1);
  });

  it("renders a null attendance rate as an em dash, never 0%", async () => {
    signIn(["reports.view"]);
    mock.onGet("/organization/reports/instructor-activity").reply(200, REPORT);
    const user = userEvent.setup();
    renderWithProviders(<InstructorActivityReport />);

    await user.click(await screen.findByRole("button", { name: "Generate report" }));

    const basel = await screen.findByTestId("instructor-activity-row-i2");
    const rate = within(basel).getByTestId("attendance-rate");
    expect(rate).toHaveTextContent("—");
    expect(rate).not.toHaveTextContent("0%");
    expect(rate.textContent).not.toMatch(/\d/);
  });

  it("has no ratings or reviews column", async () => {
    signIn(["reports.view"]);
    mock.onGet("/organization/reports/instructor-activity").reply(200, REPORT);
    const user = userEvent.setup();
    renderWithProviders(<InstructorActivityReport />);

    await user.click(await screen.findByRole("button", { name: "Generate report" }));

    const table = await screen.findByTestId("instructor-activity-rows");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    expect(document.body.textContent ?? "").not.toMatch(/rating|review/i);
  });

  it("shows the empty state when nothing matches the filters", async () => {
    signIn(["reports.view"]);
    mock.onGet("/organization/reports/instructor-activity").reply(200, EMPTY_REPORT);
    const user = userEvent.setup();
    renderWithProviders(<InstructorActivityReport />);

    await user.click(await screen.findByRole("button", { name: "Generate report" }));

    expect(await screen.findByTestId("report-empty")).toBeInTheDocument();
  });

  it("is refused without reports.view", async () => {
    signIn([]);
    renderWithProviders(<InstructorActivityReport />);

    expect(await screen.findByTestId("report-no-access")).toBeInTheDocument();
    expect(reportCalls()).toHaveLength(0);
  });
});
