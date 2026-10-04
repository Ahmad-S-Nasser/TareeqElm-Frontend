import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import Flashcards from "./Flashcards";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const past = new Date(Date.now() - 86_400_000).toISOString();

const deck = (overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: "d1",
  Title: "JS Basics",
  Description: "Core language concepts",
  CourseId: null,
  CourseTitle: null,
  OwnerId: "user-1",
  OwnerName: "Me",
  Kind: "Personal",
  Visibility: "Private",
  CardCount: 2,
  CreatedAt: new Date().toISOString(),
  ...overrides,
});

const card = (id: string, question: string, isMastered = false) => ({
  Id: id,
  Topic: "Testing",
  Question: question,
  Answer: `${question} answer`,
  Hint: null,
  DeckId: null,
  EaseFactor: 2.5,
  IntervalDays: isMastered ? 30 : 1,
  Repetitions: isMastered ? 4 : 1,
  NextReview: past,
  LastReviewed: null,
  IsMastered: isMastered,
});

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  seedSession(makeUser({ Id: "user-1", Role: "Trainer", Permissions: ["flashcards.use"] }));
  mock.onGet("/Auth/me").reply(200, {});
});
afterEach(() => mock.restore());

describe("Flashcards", () => {
  it("renders the deck grid and the stats derived from the caller's study cards", async () => {
    mock.onGet("/decks").reply(200, [deck()]);
    mock.onGet("/Flashcards").reply(200, [card("f1", "What is TDD?"), card("f2", "What is a mock?", true)]);
    renderWithProviders(<Flashcards />);

    expect(await screen.findByText("JS Basics")).toBeInTheDocument();
    expect(screen.getByText("Core language concepts")).toBeInTheDocument();

    // Multiple "Mastered" texts exist (the stat label and the per-card mastery badge); pick the stat tile.
    const statValue = (label: string) => {
      const el = screen.getAllByText(label).find((e) => e.parentElement?.querySelector("p.text-2xl"));
      return el?.parentElement?.querySelector("p.text-2xl")?.textContent;
    };
    // Total cards = 2, mastered = 1, due today = 2 (both cards are past-due), decks active = 1
    expect(statValue("Total Cards")).toBe("2");
    expect(statValue("Mastered")).toBe("1");
    expect(statValue("Due Today")).toBe("2");
    expect(statValue("Decks Active")).toBe("1");
  });

  it("shows the server-computed mastery badge for mastered cards only", async () => {
    mock.onGet("/decks").reply(200, []);
    mock.onGet("/Flashcards").reply(200, [card("f1", "Not mastered yet"), card("f2", "Mastered one", true)]);
    renderWithProviders(<Flashcards />);

    await screen.findByText("Mastered one");
    const masteredRow = screen.getByText("Mastered one").closest<HTMLElement>("div.flex");
    const notMasteredRow = screen.getByText("Not mastered yet").closest<HTMLElement>("div.flex");
    expect(masteredRow ? within(masteredRow).queryByText("Mastered") : null).toBeInTheDocument();
    expect(notMasteredRow ? within(notMasteredRow).queryByText("Mastered") : null).not.toBeInTheDocument();
  });

  it("creates a personal deck via the dialog", async () => {
    mock.onGet("/decks").replyOnce(200, []);
    mock.onGet("/Flashcards").reply(200, []);
    mock.onPost("/decks").reply(201, deck({ Id: "new-1", Title: "New Deck", CardCount: 0 }));
    mock.onGet("/decks").reply(200, [deck({ Id: "new-1", Title: "New Deck", CardCount: 0 })]);

    const user = userEvent.setup();
    renderWithProviders(<Flashcards />);

    await user.click(await screen.findByRole("button", { name: /create deck/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/deck name/i), "New Deck");
    await user.click(within(dialog).getByRole("button", { name: /create deck/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/decks")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Title: "New Deck", Description: null });
    expect(await screen.findByText("New Deck")).toBeInTheDocument();
  });

  it("blocks deck creation with no title and shows a validation error", async () => {
    mock.onGet("/decks").reply(200, []);
    mock.onGet("/Flashcards").reply(200, []);
    const user = userEvent.setup();
    renderWithProviders(<Flashcards />);

    await user.click(await screen.findByRole("button", { name: /create deck/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /create deck/i }));

    expect(await screen.findByText(/enter a deck name/i)).toBeInTheDocument();
    expect(mock.history.post.filter((r) => r.url === "/decks")).toHaveLength(0);
  });

  it("adding a deck's cards to my review set invalidates the shared flashcards cache (visible on SpacedRepetition too)", async () => {
    mock.onGet("/decks").reply(200, [deck({ OwnerId: "someone-else", Kind: "Instructor", OwnerName: "Ada" })]);
    mock.onGet("/Flashcards").reply(200, []);
    mock.onPost("/decks/d1/add-to-my-cards").reply(200, { Added: 2, AlreadyOwned: 0, Total: 2 });

    const user = userEvent.setup();
    renderWithProviders(<Flashcards />);

    await user.click(await screen.findByRole("button", { name: /add to my review set/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/decks/d1/add-to-my-cards")).toHaveLength(1));
    // The shared flashcardKeys.list query key is invalidated: a second GET /Flashcards fires,
    // which is exactly what makes SpacedRepetition.tsx (using the same hook) pick up the new cards.
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === "/Flashcards")).toHaveLength(2));
  });

  it("opens the deck manager and adds a card to a personal deck", async () => {
    mock.onGet("/decks").reply(200, [deck()]);
    mock.onGet("/Flashcards").reply(200, []);
    mock.onGet("/decks/d1/cards").reply(200, []);
    mock.onPost("/decks/d1/cards").reply(200, { Id: "c1", DeckId: "d1", Question: "What is JSX?", Answer: "Syntax sugar", Hint: null, CreatedAt: new Date().toISOString() });

    const user = userEvent.setup();
    renderWithProviders(<Flashcards />);

    await user.click(await screen.findByRole("button", { name: "JS Basics" }));
    await user.click(await screen.findByRole("button", { name: /add card/i }));
    await user.type(screen.getByLabelText(/^question$/i), "What is JSX?");
    await user.type(screen.getByLabelText(/^answer$/i), "Syntax sugar");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/decks/d1/cards")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Question: "What is JSX?", Answer: "Syntax sugar", Hint: null });
  });

  it("shows an error and a retry action when the deck list fails to load", async () => {
    mock.onGet("/decks").reply(500);
    mock.onGet("/Flashcards").reply(200, []);
    renderWithProviders(<Flashcards />);

    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
