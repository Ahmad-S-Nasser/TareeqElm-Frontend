import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import AdminAnalytics from "./AdminAnalytics";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/AdminSidebar", () => ({
  AdminSidebar: () => null,
  AdminSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const stats = { TotalTrainers: 42, ActiveInstructors: 6, TotalCourses: 12, AvgCompletion: 63 };
const atRiskRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  TrainerId: "t1",
  TrainerName: "Jane Doe",
  DepartmentId: "d1",
  DepartmentName: "Engineering",
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  EnrolledAt: "2026-01-01T00:00:00Z",
  LastActivityAt: "2026-01-05T00:00:00Z",
  DaysInactive: 21,
  ProgressPercentage: 15,
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Admin", Permissions: ["organization.view"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

describe("AdminAnalytics", () => {
  it("shows real KPIs from /Organization/stats and the at-risk count", async () => {
    mock.onGet("/Organization/stats").reply(200, stats);
    mock.onGet("/Organization/at-risk-trainers").reply(200, [atRiskRow()]);
    renderWithProviders(<AdminAnalytics />);
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("63%")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("lists at-risk trainers with resolved names, course, department, and progress", async () => {
    mock.onGet("/Organization/stats").reply(200, stats);
    mock.onGet("/Organization/at-risk-trainers").reply(200, [atRiskRow()]);
    renderWithProviders(<AdminAnalytics />);
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Intro to Testing")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
  });

  it("shows the empty state when no trainer is at risk", async () => {
    mock.onGet("/Organization/stats").reply(200, stats);
    mock.onGet("/Organization/at-risk-trainers").reply(200, []);
    renderWithProviders(<AdminAnalytics />);
    expect(await screen.findByText("No trainees are currently at risk.")).toBeInTheDocument();
  });

  it("shows an error state when the at-risk query fails", async () => {
    mock.onGet("/Organization/stats").reply(200, stats);
    mock.onGet("/Organization/at-risk-trainers").reply(500);
    renderWithProviders(<AdminAnalytics />);
    expect(await screen.findAllByText(/server ran into a problem/i)).not.toHaveLength(0);
  });
});
