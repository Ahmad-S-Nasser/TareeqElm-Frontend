import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import Courses from "./Courses";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";
import type { PricingDto } from "@/hooks/useBilling";

vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const pricing = (overrides: Partial<PricingDto> = {}): PricingDto => ({
  IsFree: false,
  Amount: 79,
  EffectiveAmount: 79,
  CompareAtAmount: null,
  SaleAmount: null,
  SaleStartsAt: null,
  SaleEndsAt: null,
  Currency: "USD",
  OnSale: false,
  ...overrides,
});

const summary = (overrides: Record<string, unknown> = {}) => ({
  Id: "c-free",
  Title: "Foundations of Data Literacy",
  Description: "A free course",
  Category: "technology",
  Level: "beginner",
  ImageUrl: null,
  InstructorId: "i1",
  InstructorName: "Instructor One",
  Status: "Published",
  LessonsCount: 6,
  EnrolledCount: 4,
  IsFeatured: false,
  DurationHours: 3,
  AccessModel: "Free",
  RequiresApproval: false,
  Pricing: null,
  Owned: false,
  HasChapterPricing: false,
  ...overrides,
});

const paid = summary({
  Id: "c-paid",
  Title: "Cloud Architecture Essentials",
  AccessModel: "AlaCarte",
  Pricing: pricing(),
  HasChapterPricing: true,
});

const ownedPaid = summary({
  Id: "c-owned",
  Title: "Applied Machine Learning",
  AccessModel: "AlaCarte",
  Pricing: pricing({ Amount: 49.99, EffectiveAmount: 49.99 }),
  Owned: true,
});

/** The card for a course, found by its title. */
const cardFor = (title: string) => screen.getByText(title).closest("div.group") as HTMLElement;

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "t1", Role: "Trainer", Permissions: [] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Enrollments/me").reply(200, []);
});
afterEach(() => mock.restore());

describe("Courses catalog", () => {
  it("shows no price at all on a free course, exactly as before monetization", async () => {
    mock.onGet("/Courses").reply(200, [summary()]);
    renderWithProviders(<Courses />);

    await screen.findByText("Foundations of Data Literacy");
    expect(screen.queryByTestId("price-tag")).not.toBeInTheDocument();
    expect(screen.queryByTestId("price-tag-free")).not.toBeInTheDocument();
    expect(screen.queryByTestId("price-tag-owned")).not.toBeInTheDocument();
  });

  it("carries the price from CourseSummaryDto onto a paid course's card", async () => {
    mock.onGet("/Courses").reply(200, [paid]);
    renderWithProviders(<Courses />);

    await screen.findByText("Cloud Architecture Essentials");
    expect(within(cardFor("Cloud Architecture Essentials")).getByTestId("price-tag-amount")).toHaveTextContent(
      "$79.00"
    );
  });

  it("shows Owned instead of a price on a paid course the trainer already bought", async () => {
    mock.onGet("/Courses").reply(200, [ownedPaid]);
    renderWithProviders(<Courses />);

    await screen.findByText("Applied Machine Learning");
    const card = within(cardFor("Applied Machine Learning"));
    expect(card.getByTestId("price-tag-owned")).toHaveTextContent("Owned");
    expect(card.queryByTestId("price-tag-amount")).not.toBeInTheDocument();
  });

  it("renders a sale price in the currency the DTO carries", async () => {
    mock.onGet("/Courses").reply(200, [
      summary({
        Id: "c-sale",
        Title: "Discounted Course",
        AccessModel: "AlaCarte",
        Pricing: pricing({ Currency: "JOD", Amount: 20, SaleAmount: 12.5, EffectiveAmount: 12.5, OnSale: true }),
      }),
    ]);
    renderWithProviders(<Courses />);

    await screen.findByText("Discounted Course");
    const card = within(cardFor("Discounted Course"));
    expect(card.getByTestId("price-tag-amount")).toHaveTextContent("12.500");
    expect(card.getByTestId("price-tag-compare-at")).toHaveTextContent("20.000");
  });

  it("filters the grid down to free, paid and purchased courses", async () => {
    mock.onGet("/Courses").reply(200, [summary(), paid, ownedPaid]);
    renderWithProviders(<Courses />);

    await screen.findByText("Cloud Architecture Essentials");

    await userEvent.click(screen.getByRole("button", { name: /filters/i }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Free only" }));
    expect(screen.getByText("Foundations of Data Literacy")).toBeInTheDocument();
    expect(screen.queryByText("Cloud Architecture Essentials")).not.toBeInTheDocument();
    expect(screen.queryByText("Applied Machine Learning")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /filters/i }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Purchased" }));
    expect(screen.getByText("Applied Machine Learning")).toBeInTheDocument();
    expect(screen.queryByText("Foundations of Data Literacy")).not.toBeInTheDocument();
    expect(screen.queryByText("Cloud Architecture Essentials")).not.toBeInTheDocument();
  });

  it("opens the course detail page when a card is clicked", async () => {
    mock.onGet("/Courses").reply(200, [paid]);
    renderWithProviders(<Courses />);

    await screen.findByText("Cloud Architecture Essentials");
    // The card itself is the navigation affordance; the price is informational only, never a buy button here.
    expect(within(cardFor("Cloud Architecture Essentials")).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the empty state when nothing is published", async () => {
    mock.onGet("/Courses").reply(200, []);
    renderWithProviders(<Courses />);

    expect(await screen.findByText("No courses found")).toBeInTheDocument();
  });

  it("shows the error state when the catalog fails to load", async () => {
    mock.onGet("/Courses").reply(500);
    renderWithProviders(<Courses />);

    expect(await screen.findByText("Could not load courses")).toBeInTheDocument();
  });
});

describe("Courses catalog - department filter", () => {
  it("asks the server for one department's courses when a department is picked, and back for all on reset", async () => {
    mock.onGet("/Courses/departments").reply(200, [{ Id: "d-sci", Name: "Science" }, { Id: "d-art", Name: "Arts" }]);
    mock.onGet("/Courses").reply((config) =>
      config.params?.departmentId === "d-sci"
        ? [200, [summary({ Id: "c-sci", Title: "Physics 101", DepartmentId: "d-sci" })]]
        : [200, [summary({ Id: "c-sci", Title: "Physics 101", DepartmentId: "d-sci" }), summary({ Id: "c-art", Title: "Drawing Basics", DepartmentId: "d-art" })]]
    );
    const user = userEvent.setup();
    renderWithProviders(<Courses />);

    await screen.findByText("Drawing Basics");
    await user.click(await screen.findByRole("combobox", { name: "Department" }));
    await user.click(await screen.findByRole("option", { name: "Science" }));

    await waitFor(() => expect(screen.queryByText("Drawing Basics")).not.toBeInTheDocument());
    expect(screen.getByText("Physics 101")).toBeInTheDocument();
    const filtered = mock.history.get.filter((r) => r.url === "/Courses" && r.params?.departmentId === "d-sci");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].params.status).toBe("Published");

    await user.click(screen.getByRole("combobox", { name: "Department" }));
    await user.click(await screen.findByRole("option", { name: "All departments" }));
    expect(await screen.findByText("Drawing Basics")).toBeInTheDocument();
  });

  it("shows no department filter when the organization has no departments", async () => {
    mock.onGet("/Courses/departments").reply(200, []);
    mock.onGet("/Courses").reply(200, [summary()]);
    renderWithProviders(<Courses />);

    await screen.findByText("Foundations of Data Literacy");
    expect(screen.queryByRole("combobox", { name: "Department" })).not.toBeInTheDocument();
  });
});
