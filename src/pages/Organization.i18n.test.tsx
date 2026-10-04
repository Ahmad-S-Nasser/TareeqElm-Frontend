import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import i18n from "@/i18n";
import api from "@/lib/api";
import { describeActivity } from "@/lib/organizationActivity";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";
import OrganizationAcademicTerms from "./OrganizationAcademicTerms";
import OrganizationAnnouncements from "./OrganizationAnnouncements";
import OrganizationContentLibrary from "./OrganizationContentLibrary";
import OrganizationDepartments from "./OrganizationDepartments";
import OrganizationDashboard from "./OrganizationDashboard";
import OrganizationExams from "./OrganizationExams";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(api);
  seedSession(makeUser({ Role: "Organization" }));
});
afterEach(() => mock.restore());

describe("describeActivity", () => {
  it("composes the sentence from structured fields in English and Arabic", async () => {
    const t = i18n.getFixedT("en");
    expect(describeActivity({ Action: "enrolled", ActorName: "Sara", TargetName: "Algebra" }, t)).toBe("Sara enrolled in Algebra");
    expect(describeActivity({ Action: "joined", ActorName: "Omar", ActorRole: "Instructor" }, t)).toBe("Omar joined as Instructor");
    expect(describeActivity({ Action: "completed", ActorName: null, TargetName: null }, t)).toBe("Deleted user completed Deleted course");
    const ar = i18n.getFixedT("ar");
    expect(describeActivity({ Action: "enrolled", ActorName: "سارة", TargetName: "الجبر" }, ar)).toBe("سجّل سارة في دورة الجبر");
    expect(describeActivity({ Action: "joined", ActorName: "عمر", ActorRole: "Trainer" }, ar)).toBe("انضمّ عمر بصفة متدرّب");
  });
});

describe("Organization pages in Arabic", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("ar");
  });

  it("renders the exams page in Arabic", async () => {
    mock.onGet("/organization/exams").reply(200, []);
    mock.onGet("/Courses").reply(200, []);
    mock.onGet("/Departments").reply(200, []);
    renderWithProviders(<OrganizationExams />);
    expect(screen.getByText("الامتحانات")).toBeInTheDocument();
    expect(await screen.findByText("لا توجد اختبارات مطابقة لعوامل التصفية.")).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("academic terms show translated status/type and formatted dates", async () => {
    mock.onGet("/academic-terms").reply(200, [
      { Id: "t1", Name: "Fall 2026", Type: "fall", Year: 2026, StartDate: "2026-09-01T00:00:00Z", EndDate: "2026-12-20T00:00:00Z", Status: "active" },
    ]);
    renderWithProviders(<OrganizationAcademicTerms />);
    expect(await screen.findByText("Fall 2026")).toBeInTheDocument();
    expect(screen.getAllByText("نشط").length).toBeGreaterThan(0);
    expect(screen.getByText("فصل الخريف")).toBeInTheDocument();
    expect(screen.getByText(/2026/, { selector: "p" })).toBeInTheDocument();
  });

  it("announcements show the author name and translated audience", async () => {
    mock.onGet("/Announcements").reply(200, [
      { Id: "a1", Title: "Hello", Body: "Body", Audience: "trainers", AudienceDetail: null, Pinned: false, AuthorId: "u1", AuthorName: "Dr. Sam", CreatedAt: "2026-01-05T10:00:00Z" },
    ]);
    renderWithProviders(<OrganizationAnnouncements />);
    expect(await screen.findByText("بواسطة Dr. Sam")).toBeInTheDocument();
    expect(screen.getByText("المتدرّبون")).toBeInTheDocument();
  });

  it("departments with no head show the localized placeholder", async () => {
    mock.onGet("/Departments").reply(200, [
      { Id: "d1", Name: "Math", Head: null, CoursesCount: 2, TrainersCount: 3, Performance: 80, Trend: 1 },
    ]);
    renderWithProviders(<OrganizationDepartments />);
    expect(await screen.findByText("الرئيس: غير محدد")).toBeInTheDocument();
  });

  it("content library formats sizes with translated units and shows the uploader", async () => {
    mock.onGet("/content-library").reply(200, [
      { Id: "c1", Name: "notes.pdf", FileType: "pdf", Department: null, CourseName: null, FilePath: "/f/notes.pdf", FileSizeBytes: 2048, UploadedById: "u1", UploadedByName: "Dr. Sam", CreatedAt: "2026-01-05T10:00:00Z" },
    ]);
    mock.onGet("/Departments").reply(200, []);
    renderWithProviders(<OrganizationContentLibrary />);
    expect(await screen.findByText("notes.pdf")).toBeInTheDocument();
    expect(screen.getByText("رفعه Dr. Sam")).toBeInTheDocument();
    expect(screen.getAllByText(/2 كيلوبايت/).length).toBeGreaterThan(0);
  });

  it("dashboard composes the activity feed from structured data", async () => {
    mock.onGet("/Organization/stats").reply(200, {
      Stats: { TotalTrainers: 5, ActiveInstructors: 2, TotalCourses: 3, AvgCompletion: 40 },
      Departments: [],
      RecentActivity: [{ Action: "enrolled", ActorName: "سارة", TargetName: "الجبر", At: new Date().toISOString() }],
    });
    renderWithProviders(<OrganizationDashboard />);
    expect(await screen.findByText("سجّل سارة في دورة الجبر")).toBeInTheDocument();
  });
});
