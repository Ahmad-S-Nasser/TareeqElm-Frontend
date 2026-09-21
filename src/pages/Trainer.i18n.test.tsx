import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import i18n from "@/i18n";
import api from "@/lib/api";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";
import TrainerQuizzes from "./TrainerQuizzes";
import QuizRunner from "./QuizRunner";
import CourseCatalog from "./CourseCatalog";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

let mock: MockAdapter;
beforeEach(async () => {
  mock = new MockAdapter(api);
  seedSession(makeUser({ Role: "Trainer" }));
  mock.onGet("/Quizzes/results/me").reply(200, []);
  mock.onGet("/Enrollments/me").reply(200, []);
  await i18n.changeLanguage("ar");
});
afterEach(() => mock.restore());

describe("Trainer pages in Arabic", () => {
  it("lists quizzes with translated chrome, plurals and the resolved course title", async () => {
    mock.onGet("/Quizzes").reply(200, [
      { Id: "q1", CourseId: "c1", CourseTitle: "الجبر", Title: "اختبار 1", QuestionCount: 3, PassingScore: 60, TimeLimitMinutes: 10, CreatedAt: "2025-01-01T00:00:00Z" },
      { Id: "q2", CourseId: "c2", CourseTitle: null, Title: "اختبار 2", QuestionCount: 1, PassingScore: 50, TimeLimitMinutes: null, CreatedAt: "2025-01-01T00:00:00Z" },
    ]);
    renderWithProviders(<TrainerQuizzes />);
    expect(await screen.findByRole("heading", { name: "الاختبارات" })).toBeInTheDocument();
    expect(await screen.findByText("3 أسئلة")).toBeInTheDocument();
    expect(screen.getByText("سؤال واحد")).toBeInTheDocument();
    expect(screen.getByText("بلا حدّ زمني")).toBeInTheDocument();
    // Deleted course falls back to the localized placeholder, never an id.
    expect(screen.getAllByText("دورة محذوفة").length).toBeGreaterThan(0);
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("renders the quiz runner in Arabic", async () => {
    mock.onGet("/Quizzes/q1").reply(200, {
      Id: "q1", CourseId: "c1", Title: "اختبار", Description: null, PassingScore: 60, TimeLimitMinutes: null,
      Questions: [{ Id: "qa", QuestionText: "س؟", Options: ["أ", "ب"], Points: 2 }],
    });
    renderWithProviders(
      <Routes>
        <Route path="/quizzes/:quizId" element={<QuizRunner />} />
      </Routes>,
      { initialEntries: ["/quizzes/q1"] }
    );
    expect(await screen.findByText("تسليم الاختبار")).toBeInTheDocument();
    expect(screen.getByText("نقطتان")).toBeInTheDocument();
    expect(screen.getByText("تمت الإجابة على 0 من 1")).toBeInTheDocument();
  });

  it("renders the course catalog in Arabic", async () => {
    mock.onGet("/Courses").reply(200, []);
    renderWithProviders(<CourseCatalog />);
    expect(await screen.findByText("دليل الدورات")).toBeInTheDocument();
    expect(screen.getByText("تصفّح الدورات")).toBeInTheDocument();
  });
});
