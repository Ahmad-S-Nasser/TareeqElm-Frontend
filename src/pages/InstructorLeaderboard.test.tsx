import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import InstructorLeaderboard from "./InstructorLeaderboard";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/InstructorSidebar", () => ({
  InstructorSidebar: () => null,
  InstructorSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const entry = (overrides: Record<string, unknown> = {}) => ({
  Rank: 1,
  TrainerId: "t1",
  TrainerName: "Ahmad Nasser",
  Points: 33,
  Breakdown: { Lessons: 0, Quizzes: 0, Courses: 0, Streak: 0, Sessions: 0 },
  LessonsCompleted: 0,
  QuizAverage: null,
  CoursesCompleted: 0,
  Streak: 1,
  LastActiveAt: null,
  ...overrides,
});

const board = (entries: ReturnType<typeof entry>[]) => ({
  Period: "all",
  CourseId: null,
  CourseTitle: null,
  Entries: entries,
  Total: entries.length,
  Me: null,
  GeneratedAt: "2026-10-01T00:00:00Z",
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "ins-1", Role: "Instructor" });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses/mine").reply(200, []);
  mock.onGet("/Leaderboard").reply(200, board([entry()]));
});
afterEach(() => mock.restore());

describe("InstructorLeaderboard", () => {
  it("shows each trainee's point total as translated text, not a raw i18n key", async () => {
    renderWithProviders(<InstructorLeaderboard />);

    expect(await screen.findByText("33 points")).toBeInTheDocument();
    expect(screen.queryByText("leaderboard.points")).not.toBeInTheDocument();
  });

  it("uses the singular form for exactly one point", async () => {
    mock.onGet("/Leaderboard").reply(200, board([entry({ Points: 1 })]));
    renderWithProviders(<InstructorLeaderboard />);

    expect(await screen.findByText("1 point")).toBeInTheDocument();
  });
});
