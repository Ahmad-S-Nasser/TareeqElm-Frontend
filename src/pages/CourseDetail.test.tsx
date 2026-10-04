import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import CourseDetail from "./CourseDetail";
import { makeUser, renderWithProviders, seedSession, LocationProbe } from "@/test/renderWithProviders";
import type { PricingDto } from "@/hooks/useBilling";

vi.mock("@/components/layout/ApplicantSidebar", () => ({
  ApplicantSidebar: () => null,
  ApplicantSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const COURSE_ID = "course-1";

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

const lesson = (id: string, title: string, locked = false) => ({
  Id: id,
  Title: title,
  LessonType: "video",
  Content: locked ? null : "Lesson body",
  VideoUrl: null,
  OrderIndex: 0,
  DurationMinutes: 10,
});

const chapter = (overrides: Record<string, unknown> = {}) => ({
  Id: "ch-1",
  Title: "Chapter one",
  Description: "First chapter",
  OrderIndex: 0,
  Lessons: [lesson("l-1", "Lesson one")],
  Pricing: null,
  IsPreview: false,
  IsLocked: false,
  Owned: true,
  ...overrides,
});

/** A free course exactly as every pre-monetization course still comes back today. */
const freeCourse = (overrides: Record<string, unknown> = {}) => ({
  Id: COURSE_ID,
  Title: "Foundations of Data Literacy",
  Description: "A free course",
  Category: "technology",
  Level: "Beginner",
  InstructorName: "Instructor One",
  LessonsCount: 1,
  EnrolledCount: 4,
  DurationHours: 3,
  ContentUnlocked: false,
  Chapters: [chapter({ IsLocked: true, Owned: false })],
  AccessModel: "Free",
  Pricing: null,
  Owned: false,
  HasChapterPricing: false,
  UnlockedChapterIds: [],
  InTracks: [],
  ...overrides,
});

const paidCourse = (overrides: Record<string, unknown> = {}) =>
  freeCourse({
    Title: "Cloud Architecture Essentials",
    AccessModel: "AlaCarte",
    Pricing: pricing(),
    ...overrides,
  });

let mock: MockAdapter;

const seed = (course: Record<string, unknown>, progress: unknown = null) => {
  mock.onGet(`/Courses/${COURSE_ID}`).reply(200, course);
  if (progress === null) mock.onGet(`/Enrollments/${COURSE_ID}/progress`).reply(404);
  else mock.onGet(`/Enrollments/${COURSE_ID}/progress`).reply(200, progress);
};

const renderDetail = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/courses/:courseId" element={<CourseDetail />} />
        <Route path="/checkout" element={<div>checkout page</div>} />
      </Routes>
      <LocationProbe />
    </>,
    { initialEntries: [`/courses/${COURSE_ID}`] }
  );

beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "t1", Role: "Trainer", Permissions: [] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Trainers/stats").reply(200, {});
  mock.onGet("/Trainers/activity-summary").reply(200, {});
  mock.onGet("/study-sessions").reply(200, []);
  mock.onGet("/Quizzes/results/me").reply(200, []);
  mock.onGet("/content-library").reply(200, []);
});
afterEach(() => mock.restore());

describe("CourseDetail — free course (unchanged behaviour)", () => {
  it("offers Enroll now and no purchase UI at all", async () => {
    seed(freeCourse());
    renderDetail();

    expect(await screen.findAllByText("Enroll now")).toHaveLength(2); // action row + unlock banner
    expect(screen.getByText("Enroll to start learning")).toBeInTheDocument();
    expect(screen.getByText("Enroll to unlock this course")).toBeInTheDocument();
    expect(screen.queryByTestId("course-buy-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("price-tag-amount")).not.toBeInTheDocument();
  });

  it("still posts to /Enrollments when the trainer enrolls", async () => {
    seed(freeCourse());
    mock.onPost("/Enrollments").reply(201, {});
    renderDetail();

    const [enroll] = await screen.findAllByRole("button", { name: /enroll now/i });
    await userEvent.click(enroll);

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/Enrollments")).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ CourseId: COURSE_ID });
  });
});

describe("CourseDetail — course metadata", () => {
  const catalogRow = (id: string, title: string) => ({
    Id: id, Title: title, Description: `${title} description`, Category: "technology", Level: "beginner", ImageUrl: null,
    InstructorId: "i1", InstructorName: "Instructor One", Status: "Published", LessonsCount: 2, EnrolledCount: 1,
    IsFeatured: false, DurationHours: 1, AccessModel: "Free", Pricing: null, Tags: [],
  });

  it("renders tags and a What you'll learn list, and nothing extra when they are empty", async () => {
    seed(freeCourse({ Tags: ["excel", "data"], Outcomes: ["Read a chart", "Clean a dataset"] }));
    renderDetail();

    expect(await screen.findByText("What you'll learn")).toBeInTheDocument();
    expect(screen.getByText("Read a chart")).toBeInTheDocument();
    expect(screen.getByText("Clean a dataset")).toBeInTheDocument();
    expect(screen.getByTestId("course-tags")).toHaveTextContent("excel");
    expect(screen.getByTestId("course-tags")).toHaveTextContent("data");
    expect(screen.queryByTestId("related-courses")).not.toBeInTheDocument();
  });

  it("hides the outcomes section when there are none", async () => {
    seed(freeCourse());
    renderDetail();

    await screen.findAllByText("Enroll now");
    expect(screen.queryByText("What you'll learn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("course-tags")).not.toBeInTheDocument();
  });

  it("shows prerequisites and related courses resolved from the catalog, skipping unknown ids", async () => {
    seed(freeCourse({ PrerequisiteCourseIds: ["pre-1"], RelatedCourseIds: ["rel-1", "gone"] }));
    mock.onGet("/Courses").reply(200, [catalogRow("pre-1", "Basics First"), catalogRow("rel-1", "Also Useful")]);
    renderDetail();

    const prereqs = await screen.findByTestId("course-prerequisites");
    expect(prereqs).toHaveTextContent("Basics First");
    const related = await screen.findByTestId("related-courses");
    expect(related).toHaveTextContent("Related courses");
    expect(related).toHaveTextContent("Also Useful");
    expect(related).not.toHaveTextContent("Basics First");
  });

  it("shows the prerequisites toast when enrolling is refused for missing prerequisites", async () => {
    seed(freeCourse({ PrerequisiteCourseIds: ["pre-1"] }));
    mock.onGet("/Courses").reply(200, [catalogRow("pre-1", "Basics First")]);
    mock.onPost("/Enrollments").reply(403, { code: "enrollment.prerequisites_not_met", title: "Complete the prerequisites.", status: 403 });
    renderDetail();

    const [enroll] = await screen.findAllByRole("button", { name: /enroll now/i });
    await userEvent.click(enroll);

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Prerequisites not completed", variant: "destructive" })));
  });
});

describe("CourseDetail — paid course the trainer does not own", () => {
  it("shows the price and a Buy link into checkout instead of Enroll now", async () => {
    seed(paidCourse());
    renderDetail();

    expect(await screen.findByTestId("course-buy-action")).toBeInTheDocument();
    expect(screen.getAllByTestId("price-tag-amount")[0]).toHaveTextContent("$79.00");
    expect(screen.queryByRole("button", { name: /enroll now/i })).not.toBeInTheDocument();
    expect(screen.getByText("Buy this course to start learning")).toBeInTheDocument();

    const buy = screen.getByTestId("buy-course");
    expect(buy).toHaveAttribute("href", `/checkout?itemType=Course&itemId=${COURSE_ID}`);
  });

  it("navigates to checkout rather than calling the enroll endpoint", async () => {
    seed(paidCourse());
    renderDetail();

    await userEvent.click(await screen.findByTestId("buy-course"));

    expect(screen.getByTestId("location")).toHaveTextContent(
      `/checkout?itemType=Course&itemId=${COURSE_ID}`
    );
    expect(mock.history.post.filter((r) => r.url === "/Enrollments")).toHaveLength(0);
  });

  it("turns the unlock banner into a buy-to-unlock banner", async () => {
    seed(paidCourse());
    renderDetail();

    expect(await screen.findByText("Buy this course to unlock it")).toBeInTheDocument();
    expect(screen.queryByText("Enroll to unlock this course")).not.toBeInTheDocument();
    expect(screen.getByTestId("buy-course-banner")).toHaveAttribute(
      "href",
      `/checkout?itemType=Course&itemId=${COURSE_ID}`
    );
  });
});

describe("CourseDetail — paid course the trainer owns", () => {
  it("shows the Owned state and full access, with no purchase UI", async () => {
    seed(
      paidCourse({
        Owned: true,
        ContentUnlocked: true,
        Chapters: [chapter()],
        UnlockedChapterIds: ["ch-1"],
      }),
      { ProgressPercentage: 25, CompletedLessonIds: [] }
    );
    renderDetail();

    expect(await screen.findByTestId("price-tag-owned")).toHaveTextContent("Owned");
    expect(screen.getByRole("button", { name: /continue: lesson one/i })).toBeInTheDocument();
    expect(screen.queryByTestId("course-buy-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("buy-course")).not.toBeInTheDocument();
    expect(screen.queryByText("Buy this course to unlock it")).not.toBeInTheDocument();
  });

  it("treats an owned course as enrolled even before the progress row exists", async () => {
    seed(paidCourse({ Owned: true, ContentUnlocked: true, Chapters: [chapter()], UnlockedChapterIds: ["ch-1"] }));
    renderDetail();

    expect(await screen.findByTestId("price-tag-owned")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enroll now/i })).not.toBeInTheDocument();
  });
});

describe("CourseDetail — chapter-level pricing", () => {
  const withChapters = () =>
    paidCourse({
      HasChapterPricing: true,
      UnlockedChapterIds: ["ch-preview"],
      Chapters: [
        chapter({
          Id: "ch-preview",
          Title: "Cloud foundations",
          OrderIndex: 0,
          IsPreview: true,
          IsLocked: false,
          Owned: true,
          Lessons: [lesson("l-preview", "Free sample lesson")],
        }),
        chapter({
          Id: "ch-paid",
          Title: "Designing for failure",
          OrderIndex: 1,
          IsLocked: true,
          Owned: false,
          Pricing: pricing({ Amount: 19, EffectiveAmount: 19 }),
          Lessons: [lesson("l-paid", "Paid lesson", true)],
        }),
        chapter({
          Id: "ch-locked",
          Title: "Cost and scaling",
          OrderIndex: 2,
          IsLocked: true,
          Owned: false,
          Pricing: null,
          Lessons: [lesson("l-locked", "Locked lesson", true)],
        }),
      ],
    });

  it("shows a per-chapter price and a Buy chapter link on a locked, separately-sold chapter", async () => {
    seed(withChapters());
    renderDetail();

    const buyChapter = await screen.findByTestId("chapter-buy-ch-paid");
    expect(buyChapter).toHaveTextContent("$19.00");
    expect(buyChapter.querySelector("a")).toHaveAttribute("href", "/checkout?itemType=Chapter&itemId=ch-paid");
  });

  it("shows no price on a locked chapter that is not sold separately", async () => {
    seed(withChapters());
    renderDetail();

    await screen.findByTestId("chapter-buy-ch-paid");
    expect(screen.queryByTestId("chapter-buy-ch-locked")).not.toBeInTheDocument();
  });

  it("marks a preview chapter as free and lets its lesson be opened without buying anything", async () => {
    seed(withChapters());
    renderDetail();

    expect(await screen.findByTestId("chapter-preview-ch-preview")).toHaveTextContent("Free preview");

    await userEvent.click(screen.getByRole("button", { name: /cloud foundations/i }));
    await userEvent.click(await screen.findByText("Free sample lesson"));

    expect(screen.getByTestId("location")).toHaveTextContent(`/courses/${COURSE_ID}/lessons/l-preview`);
  });

  it("keeps a locked chapter closed so its lessons cannot be opened", async () => {
    seed(withChapters());
    renderDetail();

    const locked = await screen.findByRole("button", { name: /designing for failure/i });
    expect(locked).toBeDisabled();
    expect(screen.queryByText("Paid lesson")).not.toBeInTheDocument();
  });
});

describe("CourseDetail — InTracks bundle banner", () => {
  const track = {
    Id: "track-1",
    Title: "Data Professional Path",
    Pricing: pricing({ Amount: 99, EffectiveAmount: 99 }),
    CoursesCount: 2,
    Owned: false,
  };

  it("offers the track bundle with its price and a checkout link", async () => {
    seed(paidCourse({ InTracks: [track] }));
    renderDetail();

    const banner = await screen.findByTestId("in-track-track-1");
    expect(banner).toHaveTextContent("Also part of Data Professional Path");
    expect(banner).toHaveTextContent("$99.00");
    expect(screen.getByTestId("buy-track-track-1")).toHaveAttribute(
      "href",
      "/checkout?itemType=Track&itemId=track-1"
    );
  });

  it("renders nothing when the course is in no track", async () => {
    seed(paidCourse());
    renderDetail();

    await screen.findByTestId("course-buy-action");
    expect(screen.queryByTestId("in-track-track-1")).not.toBeInTheDocument();
  });

  it("hides the banner for a track the trainer already owns", async () => {
    seed(paidCourse({ InTracks: [{ ...track, Owned: true }] }));
    renderDetail();

    await screen.findByTestId("course-buy-action");
    expect(screen.queryByTestId("in-track-track-1")).not.toBeInTheDocument();
  });
});

describe("CourseDetail — loading and failure states", () => {
  it("shows the error state when the course fails to load", async () => {
    mock.onGet(`/Courses/${COURSE_ID}`).reply(500);
    mock.onGet(`/Enrollments/${COURSE_ID}/progress`).reply(404);
    renderDetail();

    expect(await screen.findByText("Could not load this course")).toBeInTheDocument();
  });

  it("shows the not-found state when the course does not exist", async () => {
    mock.onGet(`/Courses/${COURSE_ID}`).reply(404);
    mock.onGet(`/Enrollments/${COURSE_ID}/progress`).reply(404);
    renderDetail();

    expect(await screen.findByText("Course not found")).toBeInTheDocument();
  });
});
