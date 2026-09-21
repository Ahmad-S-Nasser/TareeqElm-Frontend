import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import QuizRunner from "./QuizRunner";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const quiz = {
  Id: "q1",
  CourseId: "c1",
  Title: "Basics Quiz",
  Description: "Check your basics",
  PassingScore: 60,
  TimeLimitMinutes: null,
  Questions: [
    { Id: "qa", QuestionText: "Capital of France?", Options: ["Berlin", "Paris", "Rome"], Points: 1 },
    { Id: "qb", QuestionText: "2 + 2?", Options: ["3", "4", "5"], Points: 1 },
  ],
};

const attemptResult = {
  ResultId: "r1",
  QuizId: "q1",
  Score: 1,
  TotalPoints: 2,
  Percentage: 50,
  Passed: false,
  Review: [
    { QuestionId: "qa", Correct: true, YourAnswer: 1, CorrectOptionIndex: 1, Explanation: null },
    { QuestionId: "qb", Correct: false, YourAnswer: null, CorrectOptionIndex: 1, Explanation: "Basic arithmetic." },
  ],
};

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  seedSession(makeUser({ Role: "Trainer" }));
  mock.onGet("/Quizzes/q1").reply(200, quiz);
  mock.onGet("/Quizzes/results/me").reply(200, []);
  mock.onGet("/Enrollments/me").reply(200, []);
});
afterEach(() => mock.restore());

const renderRunner = () =>
  renderWithProviders(
    <Routes>
      <Route path="/quizzes/:quizId" element={<QuizRunner />} />
      <Route path="/quizzes" element={<div>Quiz list</div>} />
    </Routes>,
    { initialEntries: ["/quizzes/q1"] }
  );

describe("QuizRunner", () => {
  it("renders the questions and options without revealing any answers", async () => {
    renderRunner();
    expect(await screen.findByRole("heading", { name: "Basics Quiz" })).toBeInTheDocument();
    expect(screen.getByText(/1\. Capital of France\?/)).toBeInTheDocument();
    expect(screen.getByText(/2\. 2 \+ 2\?/)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByText("0 of 2 answered")).toBeInTheDocument();
    expect(screen.queryByText(/correct answer/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Review")).not.toBeInTheDocument();
  });

  it("asks for confirmation when questions are unanswered and does not submit on cancel", async () => {
    const user = userEvent.setup();
    renderRunner();
    await user.click(await screen.findByLabelText("Paris"));
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /submit quiz/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/1 unanswered question\./i)).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: /keep answering/i }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mock.history.post).toHaveLength(0);
  });

  it("submits only the answered questions and shows the server's review", async () => {
    mock.onPost("/Quizzes/q1/attempts").reply(200, attemptResult);
    const user = userEvent.setup();
    renderRunner();

    await user.click(await screen.findByLabelText("Paris"));
    await user.click(screen.getByRole("button", { name: /submit quiz/i }));
    await user.click(await screen.findByRole("button", { name: /submit anyway/i }));

    expect(await screen.findByText("Not passed this time")).toBeInTheDocument();
    const post = mock.history.post.find((r) => r.url === "/Quizzes/q1/attempts");
    expect(post).toBeDefined();
    const body = JSON.parse(post!.data);
    expect(body.Answers).toEqual({ qa: 1 });
    expect(typeof body.TimeTakenSeconds).toBe("number");

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("Unanswered")).toBeInTheDocument();
    expect(screen.getByText("Basic arithmetic.")).toBeInTheDocument();
    expect(screen.getByText("No answer")).toBeInTheDocument();
  });

  it("submits directly (no dialog) when everything is answered", async () => {
    mock.onPost("/Quizzes/q1/attempts").reply(200, { ...attemptResult, Score: 2, Percentage: 100, Passed: true });
    const user = userEvent.setup();
    renderRunner();

    await user.click(await screen.findByLabelText("Paris"));
    await user.click(screen.getByLabelText("4"));
    await user.click(screen.getByRole("button", { name: /submit quiz/i }));

    expect(await screen.findByText("You passed!")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(JSON.parse(mock.history.post[0].data).Answers).toEqual({ qa: 1, qb: 1 });
  });

  it("shows the enroll message when the quiz is forbidden (not enrolled)", async () => {
    mock.onGet("/Quizzes/q1").reply(403);
    renderRunner();
    expect(await screen.findByText("Enroll in the course first")).toBeInTheDocument();
  });
});
