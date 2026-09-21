import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import SpacedRepetition from "./SpacedRepetition";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/spaced-repetition/ForgettingCurveChart", () => ({ ForgettingCurveChart: () => null }));

const past = new Date(Date.now() - 86_400_000).toISOString();
const future = new Date(Date.now() + 5 * 86_400_000).toISOString();

const card = (id: string, question: string, next = past) => ({
  Id: id,
  Topic: "Testing",
  Question: question,
  Answer: `${question} answer`,
  EaseFactor: 2.5,
  IntervalDays: 1,
  Repetitions: 1,
  NextReview: next,
  LastReviewed: null,
});

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  seedSession(makeUser({ Role: "Trainer" }));
});
afterEach(() => mock.restore());

describe("SpacedRepetition", () => {
  it("rating a card POSTs /Flashcards/{id}/review with the rating and advances to the next card", async () => {
    mock.onGet("/Flashcards").reply(200, [card("f1", "What is TDD?"), card("f2", "What is a mock?")]);
    mock.onPost("/Flashcards/f1/review").reply(200, card("f1", "What is TDD?", future));
    const user = userEvent.setup();
    renderWithProviders(<SpacedRepetition />);

    await user.click(await screen.findByRole("button", { name: /start review \(2\)/i }));
    expect(await screen.findByText("1 / 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show answer/i }));
    await user.click(await screen.findByRole("button", { name: /^good/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/Flashcards/f1/review")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Rating: "good" });

    // Advanced: second card, answer hidden again.
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show answer/i })).toBeInTheDocument();
  });

  it("finishes the session after the last card and shows the summary", async () => {
    mock.onGet("/Flashcards").reply(200, [card("f1", "Only card")]);
    mock.onPost("/Flashcards/f1/review").reply(200, card("f1", "Only card", future));
    const user = userEvent.setup();
    renderWithProviders(<SpacedRepetition />);

    await user.click(await screen.findByRole("button", { name: /start review \(1\)/i }));
    await user.click(await screen.findByRole("button", { name: /show answer/i }));
    await user.click(await screen.findByRole("button", { name: /^again/i }));

    expect(await screen.findByText("Session Complete!")).toBeInTheDocument();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Rating: "again" });
  });

  it("does not advance when saving the review fails", async () => {
    mock.onGet("/Flashcards").reply(200, [card("f1", "Q one"), card("f2", "Q two")]);
    mock.onPost("/Flashcards/f1/review").reply(500);
    const user = userEvent.setup();
    renderWithProviders(<SpacedRepetition />);

    await user.click(await screen.findByRole("button", { name: /start review \(2\)/i }));
    await user.click(await screen.findByRole("button", { name: /show answer/i }));
    await user.click(await screen.findByRole("button", { name: /^easy/i }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByText("2 / 2")).not.toBeInTheDocument();
  });
});
