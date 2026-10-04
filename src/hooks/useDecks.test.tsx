import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import { AuthProvider, useAuth } from "./useAuth";
import { makeUser, seedSession } from "@/test/renderWithProviders";
import { useFlashcardsQuery, useReviewFlashcard } from "./useFlashcards";
import {
  useDecksQuery,
  useCreatePersonalDeck,
  useCreateInstructorDeck,
  useAddToMyCards,
  useDeckCardsQuery,
  useAddDeckCard,
  useUpdateDeckCard,
  useDeleteDeckCard,
  useImportDeckCards,
  useExportDeckCards,
  useUpdateDeck,
} from "./useDecks";

let mock: MockAdapter;
let queryClient: QueryClient;

beforeEach(() => {
  mock = new MockAdapter(api);
  // AuthProvider refreshes the session via GET /Auth/me on mount; keep it harmless and out of the way of GET-history assertions.
  mock.onGet("/Auth/me").reply(200, {});
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
});
afterEach(() => mock.restore());

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

const deck = (overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: "d1",
  Title: "JS Basics",
  Description: null,
  CourseId: null,
  CourseTitle: null,
  OwnerId: "user-1",
  OwnerName: "Me",
  Kind: "Personal",
  Visibility: "Private",
  CardCount: 0,
  CreatedAt: new Date().toISOString(),
  ...overrides,
});

const setup = async <T,>(useHook: () => T) => {
  seedSession(makeUser({ Id: "user-1", Role: "Trainer", Permissions: ["flashcards.use", "decks.manage"] }));
  const hook = renderHook(() => ({ value: useHook(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.loading).toBe(false));
  return { get current() { return hook.result.current.value; } };
};

describe("useDecks: deck CRUD", () => {
  it("useDecksQuery loads the caller's decks plus published Instructor decks", async () => {
    mock.onGet("/decks").reply(200, [deck()]);
    const result = await setup(() => useDecksQuery());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].Title).toBe("JS Basics");
  });

  it("useCreatePersonalDeck POSTs /decks and invalidates the decks list", async () => {
    mock.onGet("/decks").reply(200, []);
    mock.onPost("/decks").reply(201, deck({ Id: "new-1" }));
    const result = await setup(() => ({ decks: useDecksQuery(), create: useCreatePersonalDeck() }));
    await waitFor(() => expect(result.current.decks.isSuccess).toBe(true));

    await act(async () => {
      await result.current.create.mutateAsync({ title: "New Deck", description: "  " });
    });

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Title: "New Deck", Description: null });
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === "/decks")).toHaveLength(2));
  });

  it("useCreateInstructorDeck POSTs /decks/instructor with course and visibility", async () => {
    mock.onGet("/decks").reply(200, []);
    mock.onPost("/decks/instructor").reply(201, deck({ Id: "new-2", Kind: "Instructor", CourseId: "c1" }));
    const result = await setup(() => useCreateInstructorDeck());

    await act(async () => {
      await result.current.mutateAsync({ title: "Course Deck", description: "", courseId: "c1", visibility: "Published" });
    });

    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      Title: "Course Deck",
      Description: null,
      CourseId: "c1",
      Visibility: "Published",
    });
  });

  it("useUpdateDeck PUTs only the changed visibility (publish toggle)", async () => {
    mock.onPut("/decks/d1").reply(200, deck({ Visibility: "Published" }));
    const result = await setup(() => useUpdateDeck());

    await act(async () => {
      await result.current.mutateAsync({ id: "d1", visibility: "Published" });
    });

    const body = JSON.parse(mock.history.put[0].data);
    expect(body.Visibility).toBe("Published");
  });
});

describe("useDecks: add-to-my-cards idempotency and shared state with useFlashcardsQuery", () => {
  it("a repeat add-to-my-cards call reports 0 newly added and invalidates the shared flashcards query", async () => {
    mock.onGet("/Flashcards").reply(200, []);
    mock.onPost("/decks/d1/add-to-my-cards").replyOnce(200, { Added: 2, AlreadyOwned: 0, Total: 2 });
    mock.onPost("/decks/d1/add-to-my-cards").reply(200, { Added: 0, AlreadyOwned: 2, Total: 2 });

    // Simulates both pages reading the SAME query key at once.
    const result = await setup(() => ({
      addToMyCards: useAddToMyCards(),
      flashcardsAsSeenByFlashcardsPage: useFlashcardsQuery(),
      flashcardsAsSeenBySpacedRepetitionPage: useFlashcardsQuery(),
    }));
    await waitFor(() => expect(result.current.flashcardsAsSeenByFlashcardsPage.isSuccess).toBe(true));
    expect(mock.history.get.filter((r) => r.url === "/Flashcards")).toHaveLength(1); // one shared cache entry, not two fetches

    let first: { Added: number; AlreadyOwned: number; Total: number } | undefined;
    await act(async () => {
      first = await result.current.addToMyCards.mutateAsync("d1");
    });
    expect(first).toEqual({ Added: 2, AlreadyOwned: 0, Total: 2 });
    // Both consumers of the shared key are invalidated by the single mutation.
    await waitFor(() => expect(mock.history.get.filter((r) => r.url === "/Flashcards")).toHaveLength(2));

    let second: { Added: number; AlreadyOwned: number; Total: number } | undefined;
    await act(async () => {
      second = await result.current.addToMyCards.mutateAsync("d1");
    });
    expect(second).toEqual({ Added: 0, AlreadyOwned: 2, Total: 2 });
  });

  it("useReviewFlashcard's update is visible to a second consumer of the same query key without a refetch", async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    mock.onGet("/Flashcards").reply(200, [
      { Id: "f1", Topic: "T", Question: "Q", Answer: "A", Hint: null, DeckId: null, EaseFactor: 2.5, IntervalDays: 1, Repetitions: 1, NextReview: past, LastReviewed: null, IsMastered: false },
    ]);

    const result = await setup(() => ({
      flashcardsPage: useFlashcardsQuery(),
      spacedRepetitionPage: useFlashcardsQuery(),
      review: useReviewFlashcard(),
    }));
    await waitFor(() => expect(result.current.flashcardsPage.isSuccess).toBe(true));

    mock.onPost("/Flashcards/f1/review").reply(200, {
      Id: "f1", Topic: "T", Question: "Q", Answer: "A", Hint: null, DeckId: null, EaseFactor: 2.6, IntervalDays: 4, Repetitions: 2, NextReview: new Date(Date.now() + 4 * 86_400_000).toISOString(), LastReviewed: new Date().toISOString(), IsMastered: false,
    });

    await act(async () => {
      await result.current.review.mutateAsync({ id: "f1", rating: "good" });
    });

    // No extra GET /Flashcards: the mutation writes the cache directly, and both "pages" see it.
    expect(mock.history.get.filter((r) => r.url === "/Flashcards")).toHaveLength(1);
    await waitFor(() => expect(result.current.flashcardsPage.data?.[0].interval).toBe(4));
    expect(result.current.spacedRepetitionPage.data?.[0].interval).toBe(4);
  });
});

describe("useDecks: deck cards CRUD", () => {
  it("adds, updates and deletes a deck card", async () => {
    mock.onGet("/decks/d1/cards").reply(200, []);
    const result = await setup(() => ({
      cards: useDeckCardsQuery("d1"),
      add: useAddDeckCard("d1"),
      update: useUpdateDeckCard("d1"),
      remove: useDeleteDeckCard("d1"),
    }));
    await waitFor(() => expect(result.current.cards.isSuccess).toBe(true));

    mock.onPost("/decks/d1/cards").reply(200, { Id: "c1", DeckId: "d1", Question: "Q", Answer: "A", Hint: null, CreatedAt: new Date().toISOString() });
    await act(async () => {
      await result.current.add.mutateAsync({ Question: "Q", Answer: "A" });
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ Question: "Q", Answer: "A" });

    mock.onPut("/decks/d1/cards/c1").reply(200, { Id: "c1", DeckId: "d1", Question: "Q2", Answer: "A", Hint: null, CreatedAt: new Date().toISOString() });
    await act(async () => {
      await result.current.update.mutateAsync({ cardId: "c1", Question: "Q2", Answer: "A" });
    });
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ Question: "Q2", Answer: "A" });

    mock.onDelete("/decks/d1/cards/c1").reply(204);
    await act(async () => {
      await result.current.remove.mutateAsync("c1");
    });
    expect(mock.history.delete).toHaveLength(1);
  });

  it("import posts multipart/form-data and reports the server's imported/skipped counts", async () => {
    mock.onGet("/decks/d1/cards").reply(200, []);
    const result = await setup(() => useImportDeckCards("d1"));
    await waitFor(() => expect(result.current.isIdle).toBe(true));

    mock.onPost("/decks/d1/cards/import").reply(200, { Imported: 3, Skipped: 1, Total: 4 });
    const file = new File(["question,answer\nQ1,A1"], "cards.csv", { type: "text/csv" });

    let outcome: { Imported: number; Skipped: number; Total: number } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync(file);
    });

    expect(outcome).toEqual({ Imported: 3, Skipped: 1, Total: 4 });
    expect(mock.history.post[0].headers?.["Content-Type"]).toContain("multipart/form-data");
    expect(mock.history.post[0].data).toBeInstanceOf(FormData);
  });

  it("import surfaces a 400 (invalid format) as a rejected mutation", async () => {
    const result = await setup(() => useImportDeckCards("d1"));
    mock.onPost("/decks/d1/cards/import").reply(400, { code: "DeckImportInvalidFormat" });
    const file = new File(["not a deck"], "bad.txt", { type: "text/plain" });

    await expect(
      act(async () => {
        await result.current.mutateAsync(file);
      })
    ).rejects.toBeTruthy();
  });

  it("export downloads a blob and names the file from the content-disposition header", async () => {
    // jsdom has no URL.createObjectURL/revokeObjectURL; stub only those two statics.
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    (URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectURL }).revokeObjectURL = revokeObjectURL;

    mock.onGet("/decks/d1/cards/export").reply(200, new Blob(["question,answer\nQ,A"]), {
      "content-disposition": 'attachment; filename="js-basics.csv"',
    });
    const result = await setup(() => useExportDeckCards("d1"));

    const realCreateElement = document.createElement.bind(document);
    const clickSpy = vi.fn();
    let anchor: HTMLAnchorElement | undefined;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreateElement(tag);
      if (tag === "a") {
        el.click = clickSpy;
        anchor = el as HTMLAnchorElement;
      }
      return el;
    });

    await act(async () => {
      await result.current.mutateAsync("csv");
    });

    const exportRequest = mock.history.get.find((r) => r.url === "/decks/d1/cards/export");
    expect(exportRequest?.params).toEqual({ format: "csv" });
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchor?.download).toBe("js-basics.csv");
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    createElementSpy.mockRestore();
  });
});
