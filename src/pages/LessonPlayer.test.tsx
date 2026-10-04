import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import LessonPlayer from "./LessonPlayer";
import { StudySessionContext, type StudySessionContextType } from "@/components/learning/studySessionContext";
import { LocationProbe, makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const session: StudySessionContextType = {
  activeLessonId: null,
  isTracking: true,
  sessionDuration: 0,
  startSession: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn().mockResolvedValue(undefined),
  pauseSession: vi.fn(),
  resumeSession: vi.fn(),
};

const course = (unlocked: boolean, deliveryMode?: string) => ({
  Id: "c1",
  Title: "Intro Course",
  ContentUnlocked: unlocked,
  Chapters: [
    {
      Id: "ch1",
      Title: "Chapter 1",
      Lessons: [
        {
          Id: "l1",
          Title: "First Lesson",
          LessonType: "Text",
          Content: "Hello lesson body",
          VideoUrl: null,
          OrderIndex: 0,
          DurationMinutes: 5,
          DeliveryMode: deliveryMode,
        },
      ],
    },
  ],
});

const liveSession = (overrides: Record<string, unknown> = {}) => ({
  Id: "s1",
  CourseId: "c1",
  LessonId: "l1",
  StartsAt: "2026-10-01T10:00:00Z",
  DurationMinutes: 60,
  TimeZone: "UTC",
  DeliveryMode: "LiveOnline",
  Status: "Scheduled",
  InstructorName: "Instructor One",
  RoomName: null,
  LocationNote: null,
  AttendanceStatus: null,
  ...overrides,
});

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  vi.clearAllMocks();
  seedSession(makeUser({ Role: "Trainer" }));
  mock.onGet("/Enrollments/c1/progress").reply(200, {
    CourseId: "c1",
    ProgressPercentage: 0,
    TotalLessons: 1,
    CompletedLessonIds: [],
    CompletedAt: null,
  });
  mock.onGet("/Courses").reply(200, []);
});
afterEach(() => mock.restore());

const renderPlayer = () =>
  renderWithProviders(
    <StudySessionContext.Provider value={session}>
      <LocationProbe />
      <Routes>
        <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPlayer />} />
        <Route path="/courses/:courseId" element={<div>Course page</div>} />
      </Routes>
    </StudySessionContext.Provider>,
    { initialEntries: ["/courses/c1/lessons/l1"] }
  );

const completionCalls = () => mock.history.put.filter((r) => r.url?.includes("/completion"));

describe("LessonPlayer", () => {
  it("viewing a lesson never calls the completion endpoint", async () => {
    mock.onGet("/Courses/c1").reply(200, course(true));
    renderPlayer();

    expect(await screen.findByText("Hello lesson body")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First Lesson" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete lesson/i })).toBeInTheDocument();
    expect(session.startSession).toHaveBeenCalledWith("c1", "l1");
    expect(completionCalls()).toHaveLength(0);
    expect(mock.history.put).toHaveLength(0);
  });

  it("pressing Complete lesson PUTs the completion endpoint and returns to the course", async () => {
    mock.onGet("/Courses/c1").reply(200, course(true));
    mock.onPut("/Enrollments/c1/lessons/l1/completion").reply(200, {
      CourseId: "c1",
      ProgressPercentage: 100,
      TotalLessons: 1,
      CompletedLessonIds: ["l1"],
      CompletedAt: null,
    });
    const user = userEvent.setup();
    renderPlayer();

    await user.click(await screen.findByRole("button", { name: /complete lesson/i }));

    await waitFor(() => expect(completionCalls()).toHaveLength(1));
    expect(JSON.parse(completionCalls()[0].data)).toEqual({ Completed: true });
    expect(await screen.findByText("Course page")).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Lesson completed" }));
  });

  it("shows the enroll prompt (and no lesson content) when ContentUnlocked is false", async () => {
    mock.onGet("/Courses/c1").reply(200, course(false));
    renderPlayer();

    expect(await screen.findByText("Enroll to view this lesson")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enroll now/i })).toBeInTheDocument();
    expect(screen.queryByText("Hello lesson body")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete lesson/i })).not.toBeInTheDocument();
    expect(session.startSession).not.toHaveBeenCalledWith("c1", "l1");
  });

  it("Enroll Now posts the enrollment", async () => {
    mock.onGet("/Courses/c1").reply(200, course(false));
    mock.onPost("/Enrollments").reply(201, {});
    const user = userEvent.setup();
    renderPlayer();

    await user.click(await screen.findByRole("button", { name: /enroll now/i }));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ CourseId: "c1" });
  });

  it("a LiveOnline lesson shows the scheduled session and a Join button instead of the video player", async () => {
    mock.onGet("/Courses/c1").reply(200, course(true, "LiveOnline"));
    mock.onGet("/courses/c1/lessons/l1/sessions").reply(200, [liveSession()]);
    renderPlayer();

    expect(await screen.findByText("Instructor One")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join/i })).toBeInTheDocument();
    expect(screen.queryByText("This lesson has no video. Read the material alongside.")).not.toBeInTheDocument();
  });

  it("a LiveOnline lesson with no scheduled session shows a not-yet-scheduled message", async () => {
    mock.onGet("/Courses/c1").reply(200, course(true, "LiveOnline"));
    mock.onGet("/courses/c1/lessons/l1/sessions").reply(200, []);
    renderPlayer();

    expect(await screen.findByText(/hasn't scheduled this session yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join/i })).not.toBeInTheDocument();
  });

  it("an Offline lesson shows the room instead of a Join button", async () => {
    mock.onGet("/Courses/c1").reply(200, course(true, "Offline"));
    mock.onGet("/courses/c1/lessons/l1/sessions").reply(200, [
      liveSession({ DeliveryMode: "Offline", RoomName: "Building A / Room 3", LocationNote: "2nd floor" }),
    ]);
    renderPlayer();

    expect(await screen.findByText(/Building A \/ Room 3/)).toBeInTheDocument();
    expect(screen.getByText(/2nd floor/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join/i })).not.toBeInTheDocument();
  });

  it("hides the Join button once attendance is already recorded, showing the status badge instead", async () => {
    mock.onGet("/Courses/c1").reply(200, course(true, "LiveOnline"));
    mock.onGet("/courses/c1/lessons/l1/sessions").reply(200, [liveSession({ AttendanceStatus: "Present" })]);
    renderPlayer();

    expect(await screen.findByText("Present")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join/i })).not.toBeInTheDocument();
  });
});
