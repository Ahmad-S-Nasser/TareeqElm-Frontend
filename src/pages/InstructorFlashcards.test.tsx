import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import InstructorFlashcards from "./InstructorFlashcards";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/layout/InstructorSidebar", () => ({
  InstructorSidebar: () => null,
  InstructorSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const courses = [
  { Id: "c1", Title: "Intro to Testing", InstructorId: "u1", Status: "Published", LessonsCount: 4, CreatedAt: "", UpdatedAt: "" },
];

const deck = (overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: "d1",
  Title: "Unit Testing 101",
  Description: "Core testing concepts",
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  OwnerId: "u1",
  OwnerName: "Jane Instructor",
  Kind: "Instructor",
  Visibility: "Published",
  CardCount: 3,
  CreatedAt: new Date().toISOString(),
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Instructor", Permissions: ["decks.manage", "flashcards.use"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses/mine").reply(200, courses);
});
afterEach(() => mock.restore());

describe("InstructorFlashcards", () => {
  it("lists the instructor's own decks", async () => {
    mock.onGet("/decks").reply(200, [deck()]);
    renderWithProviders(<InstructorFlashcards />);

    expect(await screen.findByText("Unit Testing 101")).toBeInTheDocument();
    expect(screen.getByText("Core testing concepts")).toBeInTheDocument();
  });

  it("shows the empty state when the instructor has no decks", async () => {
    mock.onGet("/decks").reply(200, []);
    renderWithProviders(<InstructorFlashcards />);

    expect(await screen.findByText(/haven't created any flashcard decks/i)).toBeInTheDocument();
  });

  it("filters out decks owned by another instructor even if returned by the API", async () => {
    mock.onGet("/decks").reply(200, [deck(), deck({ Id: "d2", Title: "Someone Else's Deck", OwnerId: "other-instructor" })]);
    renderWithProviders(<InstructorFlashcards />);

    await screen.findByText("Unit Testing 101");
    expect(screen.queryByText("Someone Else's Deck")).not.toBeInTheDocument();
  });

  it("creates an Instructor deck for a course via the dialog", async () => {
    mock.onGet("/decks").replyOnce(200, []);
    mock.onPost("/decks/instructor").reply(201, deck({ Id: "new-1", Title: "New Deck" }));
    mock.onGet("/decks").reply(200, [deck({ Id: "new-1", Title: "New Deck" })]);

    const user = userEvent.setup();
    renderWithProviders(<InstructorFlashcards />);

    await user.click(await screen.findByRole("button", { name: /create deck/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/title/i), "New Deck");
    await user.click(within(dialog).getByRole("combobox", { name: /course/i }));
    await user.click(await screen.findByText("Intro to Testing"));
    await user.click(within(dialog).getByRole("button", { name: /create deck/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/decks/instructor")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      Title: "New Deck",
      Description: null,
      CourseId: "c1",
      Visibility: "Published",
    });
    expect(await screen.findByText("New Deck")).toBeInTheDocument();
  });

  it("requires a course before creating a deck", async () => {
    mock.onGet("/decks").reply(200, []);
    const user = userEvent.setup();
    renderWithProviders(<InstructorFlashcards />);

    await user.click(await screen.findByRole("button", { name: /create deck/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/title/i), "No Course Deck");
    await user.click(within(dialog).getByRole("button", { name: /create deck/i }));

    expect(await screen.findByText(/choose a course/i)).toBeInTheDocument();
    expect(mock.history.post.filter((r) => r.url === "/decks/instructor")).toHaveLength(0);
  });

  it("toggles a deck's publish state from the deck manager", async () => {
    mock.onGet("/decks").reply(200, [deck({ Visibility: "Private" })]);
    mock.onGet("/decks/d1/cards").reply(200, []);
    mock.onPut("/decks/d1").reply(200, deck({ Visibility: "Published" }));

    const user = userEvent.setup();
    renderWithProviders(<InstructorFlashcards />);

    await user.click(await screen.findByRole("button", { name: "Unit Testing 101" }));
    const publishSwitch = await screen.findByRole("switch");
    expect(publishSwitch).not.toBeChecked();
    await user.click(publishSwitch);

    await waitFor(() => expect(mock.history.put.filter((r) => r.url === "/decks/d1")).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toMatchObject({ Visibility: "Published" });
  });
});
