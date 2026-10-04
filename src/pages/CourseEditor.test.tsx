import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import CourseEditor from "./CourseEditor";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/InstructorSidebar", () => ({
  InstructorSidebar: () => null,
  InstructorSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const course = {
  Id: "course-1",
  Title: "Existing Course",
  Description: "Desc",
  Category: "Cat",
  Level: "beginner",
  ImageUrl: null,
  Status: "Draft",
  LessonsCount: 0,
  InstructorId: "u1",
  CreatedAt: "2026-01-01T00:00:00Z",
  UpdatedAt: "2026-01-01T00:00:00Z",
};

const renderEditor = () =>
  renderWithProviders(
    <Routes>
      <Route path="/instructor/courses/:courseId/edit" element={<CourseEditor />} />
    </Routes>,
    { initialEntries: ["/instructor/courses/course-1/edit"] }
  );

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Instructor" });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses/course-1").reply(200, course);
  mock.onGet("/Courses/course-1/curriculum").reply(200, []);
  mock.onGet("/Instructors/me/trainers").reply(200, []);
  mock.onGet("/Courses").reply(200, []); // the published catalog behind the prerequisite/related pickers
});
afterEach(() => mock.restore());

describe("CourseEditor - tags, outcomes, prerequisites and related courses", () => {
  const catalog = [
    { Id: "course-1", Title: "Existing Course" }, // the course itself: never offered
    { Id: "pre-1", Title: "Basics First" },
    { Id: "rel-1", Title: "Also Useful" },
    { Id: "other", Title: "Unrelated" },
  ].map((c) => ({ ...c, Description: null, Category: null, Level: "beginner", ImageUrl: null, InstructorId: "u1", InstructorName: null, Status: "Published", LessonsCount: 0, EnrolledCount: 0, IsFeatured: false, DurationHours: null }));

  it("loads the existing metadata and sends every field back on save", async () => {
    mock.onGet("/Courses/course-1").reply(200, {
      ...course, Tags: ["excel"], Outcomes: ["Read a chart"], PrerequisiteCourseIds: ["pre-1"], RelatedCourseIds: [],
    });
    mock.onGet("/Courses").reply(200, catalog);
    mock.onPut("/Courses/course-1").reply(204);
    const user = userEvent.setup();
    renderEditor();

    await screen.findByDisplayValue("Existing Course");
    expect(screen.getByTestId("course-tags")).toHaveTextContent("excel");
    expect(screen.getByDisplayValue("Read a chart")).toBeInTheDocument();

    const prereqs = screen.getByTestId("course-prerequisites");
    const related = screen.getByTestId("course-related");
    // The two pickers explain the difference between a hard requirement and a soft recommendation.
    expect(prereqs).toHaveTextContent("Trainees must complete these courses first");
    expect(related).toHaveTextContent("Optional courses you'd recommend alongside this one");
    await waitFor(() => expect(within(prereqs).getByText("Basics First")).toBeInTheDocument());

    // The course itself is never offered, and a course already required is not offered as "related".
    expect(within(related).queryByRole("button", { name: "Add Existing Course" })).not.toBeInTheDocument();
    expect(within(related).queryByRole("button", { name: "Add Basics First" })).not.toBeInTheDocument();
    await user.click(within(related).getByRole("button", { name: "Add Also Useful" }));

    await user.type(screen.getByLabelText("Tags"), "data{Enter}");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/course-1")).toBe(true));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/Courses/course-1")!.data);
    expect(body.Tags).toEqual(["excel", "data"]);
    expect(body.Outcomes).toEqual(["Read a chart"]);
    expect(body.PrerequisiteCourseIds).toEqual(["pre-1"]);
    expect(body.RelatedCourseIds).toEqual(["rel-1"]);
  });

  it("removes a prerequisite and toasts the server's message when a save is refused", async () => {
    mock.onGet("/Courses/course-1").reply(200, { ...course, PrerequisiteCourseIds: ["pre-1"] });
    mock.onGet("/Courses").reply(200, catalog);
    mock.onPut("/Courses/course-1").reply(400, { code: "course.related_courses_invalid", title: "Pick existing courses.", status: 400 });
    const user = userEvent.setup();
    renderEditor();

    const prereqs = await screen.findByTestId("course-prerequisites");
    await user.click(await within(prereqs).findByRole("button", { name: "Remove Basics First" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive", description: "Pick existing courses." })));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/Courses/course-1")!.data);
    expect(body.PrerequisiteCourseIds).toEqual([]);
  });
});

describe("CourseEditor - department", () => {
  const departments = [{ Id: "d-sci", Name: "Science" }, { Id: "d-art", Name: "Arts" }];

  it("shows the course's current department and sends a changed one on save", async () => {
    mock.onGet("/Courses/course-1").reply(200, { ...course, DepartmentId: "d-sci" });
    mock.onGet("/Courses/departments").reply(200, departments);
    mock.onPut("/Courses/course-1").reply(204);
    const user = userEvent.setup();
    renderEditor();

    await screen.findByDisplayValue("Existing Course");
    const picker = screen.getByRole("combobox", { name: "Department" });
    await waitFor(() => expect(picker).toHaveTextContent("Science"));

    await user.click(picker);
    await user.click(await screen.findByRole("option", { name: "Arts" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/course-1")).toBe(true));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/Courses/course-1")!.data);
    expect(body.DepartmentId).toBe("d-art");
  });

  it("clears the department with an empty string when \"No department\" is chosen", async () => {
    mock.onGet("/Courses/course-1").reply(200, { ...course, DepartmentId: "d-sci" });
    mock.onGet("/Courses/departments").reply(200, departments);
    mock.onPut("/Courses/course-1").reply(204);
    const user = userEvent.setup();
    renderEditor();

    await screen.findByDisplayValue("Existing Course");
    const picker = screen.getByRole("combobox", { name: "Department" });
    await waitFor(() => expect(picker).toHaveTextContent("Science"));
    await user.click(picker);
    await user.click(await screen.findByRole("option", { name: "No department" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/course-1")).toBe(true));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/Courses/course-1")!.data);
    expect(body.DepartmentId).toBe("");
  });

  it("toasts the server's message when the department is refused", async () => {
    mock.onGet("/Courses/departments").reply(200, departments);
    mock.onPut("/Courses/course-1").reply(400, { code: "course.department_invalid", title: "Pick one of your organization's departments.", status: 400 });
    const user = userEvent.setup();
    renderEditor();

    await screen.findByDisplayValue("Existing Course");
    await user.click(screen.getByRole("combobox", { name: "Department" }));
    await user.click(await screen.findByRole("option", { name: "Science" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive", description: "Pick one of your organization's departments." })));
  });
});

describe("CourseEditor - certificate tab", () => {
  const quiz = (overrides: Record<string, unknown> = {}) => ({
    Id: "quiz-1", CourseId: "course-1", CourseTitle: "Existing Course", Title: "Final exam", QuestionCount: 10,
    PassingScore: 75, TimeLimitMinutes: null, CreatedAt: "2026-01-01T00:00:00Z", ...overrides,
  });

  const openTab = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByDisplayValue("Existing Course");
    await user.click(screen.getByRole("tab", { name: "Certificate" }));
    return screen.findByTestId("course-certificate-config");
  };

  it("blocks saving when the exam is required but no quiz is chosen", async () => {
    mock.onGet("/Quizzes").reply(200, [quiz()]);
    mock.onPut("/Courses/course-1/certificate-config").reply(204);
    const user = userEvent.setup();
    renderEditor();
    await openTab(user);

    const save = screen.getByRole("button", { name: "Save certificate settings" });
    expect(save).toBeEnabled(); // no exam required: nothing to misconfigure

    await user.click(screen.getByRole("switch", { name: "Requires exam to certify" }));

    expect(await screen.findByTestId("course-certificate-error")).toHaveTextContent(
      "Choose the exam quiz, or turn off the exam requirement, before saving."
    );
    expect(save).toBeDisabled();
    await user.click(save);
    expect(mock.history.put.some((r) => r.url === "/Courses/course-1/certificate-config")).toBe(false);
  });

  it("loads the saved exam quiz, shows its passing score read-only and saves the configuration", async () => {
    mock.onGet("/Courses/course-1").reply(200, { ...course, CertificateRequiresExam: true, CertificateExamQuizId: "quiz-1" });
    mock.onGet("/Quizzes").reply(200, [quiz(), quiz({ Id: "quiz-2", Title: "Midterm", PassingScore: 60 })]);
    mock.onPut("/Courses/course-1/certificate-config").reply(204);
    const user = userEvent.setup();
    renderEditor();
    await openTab(user);

    const score = await screen.findByTestId("course-passing-score");
    expect(score).toHaveTextContent("Passing score: 75%");
    expect(within(score).getByRole("link", { name: "Edit quizzes" })).toHaveAttribute("href", "/instructor/quizzes");
    // The threshold is the quiz's own: there is no field to type a second one into.
    expect(within(screen.getByTestId("course-certificate-config")).queryByRole("spinbutton")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save certificate settings" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/course-1/certificate-config")).toBe(true));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/Courses/course-1/certificate-config")!.data);
    expect(body).toEqual({ CertificateRequiresExam: true, CertificateExamQuizId: "quiz-1" });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Certificate settings saved" })));
  });

  it("picks a quiz from the course's own quizzes and toasts the server's refusal", async () => {
    mock.onGet("/Quizzes").reply(200, [quiz()]);
    mock.onPut("/Courses/course-1/certificate-config").reply(400, {
      code: "certificate.exam_quiz_invalid", title: "Choose a quiz that belongs to this course.", status: 400,
    });
    const user = userEvent.setup();
    renderEditor();
    await openTab(user);

    await user.click(screen.getByRole("switch", { name: "Requires exam to certify" }));
    await user.click(screen.getByRole("combobox", { name: "Exam quiz" }));
    await user.click(await screen.findByRole("option", { name: "Final exam" }));

    expect(screen.queryByTestId("course-certificate-error")).not.toBeInTheDocument();
    expect(await screen.findByTestId("course-passing-score")).toHaveTextContent("75%");
    await user.click(screen.getByRole("button", { name: "Save certificate settings" }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", description: "Choose a quiz that belongs to this course.",
    })));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/Courses/course-1/certificate-config")!.data);
    expect(body).toEqual({ CertificateRequiresExam: true, CertificateExamQuizId: "quiz-1" });
  });
});

describe("CourseEditor - teaching assistants tab", () => {
  const assistant = (overrides: Record<string, unknown> = {}) => ({
    Id: "ca-1", CourseId: "course-1", UserId: "ta-1", Name: "Tara Assistant", Email: "tara@example.com",
    CanGrade: true, CanManageAttendance: false, CanMessage: false, AssignedBy: "u1", AssignedByName: "Owner",
    AssignedAt: "2026-01-01T00:00:00Z", ...overrides,
  });

  const openTab = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByDisplayValue("Existing Course");
    // Added alongside the existing tabs, none of which moved or disappeared.
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Course Info", "Curriculum", "Trainees", "Certificate", "Teaching Assistants", "Settings",
    ]);
    await user.click(screen.getByRole("tab", { name: "Teaching Assistants" }));
    return screen.findByTestId("course-assistants");
  };

  it("lists assistants and toggles one capability without touching the others", async () => {
    mock.onGet("/courses/course-1/assistants").reply(200, [assistant()]);
    mock.onPut("/courses/course-1/assistants/ca-1").reply(200, assistant({ CanMessage: true }));
    const user = userEvent.setup();
    renderEditor();
    await openTab(user);

    const row = await screen.findByTestId("assistant-row-ta-1");
    expect(row).toHaveTextContent("Tara Assistant");
    expect(row).toHaveTextContent("tara@example.com");
    expect(within(row).getByRole("switch", { name: "Can grade: Tara Assistant" })).toBeChecked();
    expect(within(row).getByRole("switch", { name: "Can manage attendance: Tara Assistant" })).not.toBeChecked();

    await user.click(within(row).getByRole("switch", { name: "Can message: Tara Assistant" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/courses/course-1/assistants/ca-1")).toBe(true));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/courses/course-1/assistants/ca-1")!.data);
    expect(body).toEqual({ CanGrade: true, CanManageAttendance: false, CanMessage: true });
  });

  it("adds an assistant chosen from the organization's instructors with the chosen capabilities", async () => {
    mock.onGet("/courses/course-1/assistants").reply(200, []);
    mock.onGet("/courses/course-1/assistants/candidates").reply(200, [
      { UserId: "ta-1", Name: "Tara Assistant", Email: "tara@example.com" },
      { UserId: "ta-2", Name: "Omar Helper", Email: "omar@example.com" },
    ]);
    mock.onPost("/courses/course-1/assistants").reply(200, assistant({ UserId: "ta-2", Name: "Omar Helper" }));
    const user = userEvent.setup();
    renderEditor();
    const panel = await openTab(user);

    expect(await within(panel).findByText("No teaching assistants yet.")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Add assistant" }));

    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Add assistant" });
    expect(confirm).toBeDisabled(); // nobody chosen yet

    await user.type(within(dialog).getByLabelText("Instructor"), "omar");
    expect(within(dialog).queryByRole("button", { name: "Choose Tara Assistant" })).not.toBeInTheDocument();
    await user.click(await within(dialog).findByRole("button", { name: "Choose Omar Helper" }));
    expect(within(dialog).getByTestId("assistant-selected")).toHaveTextContent("Omar Helper");

    await user.click(within(dialog).getByRole("switch", { name: "Can manage attendance" }));
    await user.click(confirm);

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/courses/course-1/assistants")).toBe(true));
    const body = JSON.parse(mock.history.post.find((r) => r.url === "/courses/course-1/assistants")!.data);
    expect(body).toEqual({ UserId: "ta-2", CanGrade: true, CanManageAttendance: true, CanMessage: false });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Teaching assistant added" })));
  });

  it("shows its own message for a refused assignment", async () => {
    mock.onGet("/courses/course-1/assistants").reply(200, []);
    mock.onGet("/courses/course-1/assistants/candidates").reply(200, [{ UserId: "ta-1", Name: "Tara Assistant", Email: "tara@example.com" }]);
    mock.onPost("/courses/course-1/assistants").reply(409, { code: "course_assistant.already_assigned", title: "Server text", status: 409 });
    const user = userEvent.setup();
    renderEditor();
    const panel = await openTab(user);

    await user.click(within(panel).getByRole("button", { name: "Add assistant" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: "Choose Tara Assistant" }));
    await user.click(within(dialog).getByRole("button", { name: "Add assistant" }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive", description: "This instructor is already a teaching assistant on this course.",
    })));
  });

  it("removes an assistant after confirmation", async () => {
    mock.onGet("/courses/course-1/assistants").reply(200, [assistant()]);
    mock.onDelete("/courses/course-1/assistants/ca-1").reply(204);
    const user = userEvent.setup();
    renderEditor();
    await openTab(user);

    await user.click(await screen.findByRole("button", { name: "Remove Tara Assistant" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Tara Assistant will immediately lose every capability on this course.");
    expect(mock.history.delete).toHaveLength(0); // nothing happens before confirming
    await user.click(within(confirm).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(mock.history.delete.some((r) => r.url === "/courses/course-1/assistants/ca-1")).toBe(true));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Teaching assistant removed" })));
  });
});

describe("CourseEditor - cover image", () => {
  it("uploads a cover image and sends ImageUrl when saving course info", async () => {
    mock.onPost("/Courses/upload").reply(200, { Url: "https://api.test/uploads/new-cover.png", FileType: "image", SizeBytes: 1234, Name: "cover.png" });
    mock.onPut("/Courses/course-1").reply(204);
    const user = userEvent.setup();
    renderEditor();

    await screen.findByDisplayValue("Existing Course");
    const fileInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    await user.upload(fileInput, new File(["bytes"], "cover.png", { type: "image/png" }));

    expect(await screen.findByRole("button", { name: /change image/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /existing course/i })).toHaveAttribute("src", "https://api.test/uploads/new-cover.png");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/course-1")).toBe(true));
    const put = mock.history.put.find((r) => r.url === "/Courses/course-1")!;
    expect(JSON.parse(put.data).ImageUrl).toBe("https://api.test/uploads/new-cover.png");
  });

  it("loads the course's existing cover image into the preview", async () => {
    mock.onGet("/Courses/course-1").reply(200, { ...course, ImageUrl: "/uploads/existing.png" });
    renderEditor();

    expect(await screen.findByRole("img", { name: /existing course/i })).toHaveAttribute("src", "/uploads/existing.png");
    expect(screen.getByRole("button", { name: /change image/i })).toBeInTheDocument();
  });
});
