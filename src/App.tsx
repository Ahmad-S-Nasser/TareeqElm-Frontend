import { lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { LegacyUniversityRedirect } from "@/components/routing/LegacyUniversityRedirect";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { StudySessionProvider } from "@/components/learning/StudySessionProvider";
import { AppErrorBoundary } from "@/components/routing/AppErrorBoundary";
import { PageLoader } from "@/components/routing/PageLoader";
import { RoleGuard } from "@/components/routing/RoleGuard";
import { RoleGroup } from "@/components/routing/RoleGroup";
import { createQueryClient } from "@/lib/queryClient";
import { roleHome } from "@/lib/roles";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = createQueryClient();

// ── Shared / onboarding ─────────────────────────────────────────────────────
const Onboarding = lazy(() => import("./pages/Onboarding"));
const UserProfile = lazy(() => import("./pages/UserProfile"));

// ── Trainer (role "applicant") ──────────────────────────────────────────────
const ApplicantDashboard = lazy(() => import("./pages/ApplicantDashboard"));
const CourseCatalog = lazy(() => import("./pages/CourseCatalog"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const LessonPlayer = lazy(() => import("./pages/LessonPlayer"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const MockExamRunner = lazy(() => import("./pages/MockExamRunner"));
const TrainerProgress = lazy(() => import("./pages/TrainerProgress"));
const TrainerNotifications = lazy(() => import("./pages/TrainerNotifications"));
const TrainerAITutor = lazy(() => import("./pages/TrainerAITutor"));
const TrainerSettings = lazy(() => import("./pages/TrainerSettings"));
const TimeBlocking = lazy(() => import("./pages/TimeBlocking"));
const SpacedRepetition = lazy(() => import("./pages/SpacedRepetition"));
const LearningAnalytics = lazy(() => import("./pages/LearningAnalytics"));
const AIStudyCoach = lazy(() => import("./pages/AIStudyCoach"));
const Achievements = lazy(() => import("./pages/Achievements"));
const TrainerQuizzes = lazy(() => import("./pages/TrainerQuizzes"));
const QuizRunner = lazy(() => import("./pages/QuizRunner"));

// ── Instructor ──────────────────────────────────────────────────────────────
const InstructorDashboard = lazy(() => import("./pages/InstructorDashboard"));
const InstructorCourses = lazy(() => import("./pages/InstructorCourses"));
const CourseEditor = lazy(() => import("./pages/CourseEditor"));
const CourseTrainers = lazy(() => import("./pages/CourseTrainers"));
const InstructorAI = lazy(() => import("./pages/InstructorAI"));
const SyllabusUpload = lazy(() => import("./pages/SyllabusUpload"));
const CreateCourse = lazy(() => import("./pages/CreateCourse"));
const InstructorAnalytics = lazy(() => import("./pages/InstructorAnalytics"));
const InstructorSettings = lazy(() => import("./pages/InstructorSettings"));
const InstructorContent = lazy(() => import("./pages/InstructorContent"));
const InstructorNotifications = lazy(() => import("./pages/InstructorNotifications"));
const AllTrainers = lazy(() => import("./pages/AllTrainers"));
const InstructorCurriculum = lazy(() => import("./pages/InstructorCurriculum"));
const InstructorAssignments = lazy(() => import("./pages/InstructorAssignments"));
const InstructorQuizzes = lazy(() => import("./pages/InstructorQuizzes"));
const InstructorDiscussions = lazy(() => import("./pages/InstructorDiscussions"));
const InstructorAnnouncements = lazy(() => import("./pages/InstructorAnnouncements"));
const InstructorFlashcards = lazy(() => import("./pages/InstructorFlashcards"));
const InstructorLeaderboard = lazy(() => import("./pages/InstructorLeaderboard"));

// ── Organization ──────────────────────────────────────────────────────────────
const OrganizationDashboard = lazy(() => import("./pages/OrganizationDashboard"));
const OrganizationDepartments = lazy(() => import("./pages/OrganizationDepartments"));
const OrganizationInstructors = lazy(() => import("./pages/OrganizationInstructors"));
const OrganizationTrainers = lazy(() => import("./pages/OrganizationTrainers"));
const OrganizationCourses = lazy(() => import("./pages/OrganizationCourses"));
const OrganizationAnalytics = lazy(() => import("./pages/OrganizationAnalytics"));
const OrganizationSettings = lazy(() => import("./pages/OrganizationSettings"));
const OrganizationAcademicTerms = lazy(() => import("./pages/OrganizationAcademicTerms"));
const OrganizationSections = lazy(() => import("./pages/OrganizationSections"));
const OrganizationEnrollment = lazy(() => import("./pages/OrganizationEnrollment"));
const OrganizationExams = lazy(() => import("./pages/OrganizationExams"));
const OrganizationAnnouncements = lazy(() => import("./pages/OrganizationAnnouncements"));
const OrganizationContentLibrary = lazy(() => import("./pages/OrganizationContentLibrary"));
const OrganizationReports = lazy(() => import("./pages/OrganizationReports"));
const OrganizationAIInsights = lazy(() => import("./pages/OrganizationAIInsights"));
const OrganizationRoles = lazy(() => import("./pages/OrganizationRoles"));

// ── Admin ───────────────────────────────────────────────────────────────────
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminEnrollments = lazy(() => import("./pages/AdminEnrollments"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));

/** "/" sends guests to sign-in and signed-in users to their own dashboard. */
const RootRedirect = () => {
  const { user, role, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={roleHome(role)} replace />;
};

const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<RootRedirect />} />
    <Route path="/auth" element={<Auth />} />
    <Route path="/login" element={<Auth />} />
    <Route path="/signup" element={<Auth />} />

    {/* Any signed-in user: onboarding + shared pages */}
    <Route element={<RoleGuard />}>
      <Route element={<RoleGroup />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/profile" element={<UserProfile />} />
      </Route>
    </Route>

    {/* Trainer (16). To add a page: add a lazy import above and a <Route> here. */}
    <Route element={<RoleGuard roles={["applicant"]} />}>
      <Route element={<RoleGroup />}>
        <Route path="/dashboard" element={<ApplicantDashboard />} />
        <Route path="/catalog" element={<CourseCatalog />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseId" element={<CourseDetail />} />
        <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPlayer />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/mock-exam" element={<MockExamRunner />} />
        <Route path="/progress" element={<TrainerProgress />} />
        <Route path="/notifications" element={<TrainerNotifications />} />
        <Route path="/ai-tutor" element={<TrainerAITutor />} />
        <Route path="/settings" element={<TrainerSettings />} />
        <Route path="/time-blocking" element={<TimeBlocking />} />
        <Route path="/spaced-repetition" element={<SpacedRepetition />} />
        <Route path="/analytics" element={<LearningAnalytics />} />
        <Route path="/ai-coach" element={<AIStudyCoach />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/quizzes" element={<TrainerQuizzes />} />
        <Route path="/quizzes/:quizId" element={<QuizRunner />} />
      </Route>
    </Route>

    {/* Instructor (19) */}
    <Route element={<RoleGuard roles={["instructor"]} />}>
      <Route element={<RoleGroup />}>
        <Route path="/instructor" element={<InstructorDashboard />} />
        <Route path="/instructor/courses" element={<InstructorCourses />} />
        <Route path="/instructor/courses/:courseId" element={<CourseEditor />} />
        <Route path="/instructor/courses/:courseId/trainers" element={<CourseTrainers />} />
        <Route path="/instructor/ai-tools" element={<InstructorAI />} />
        <Route path="/syllabus-upload" element={<SyllabusUpload />} />
        <Route path="/instructor/create-course" element={<CreateCourse />} />
        <Route path="/instructor/analytics" element={<InstructorAnalytics />} />
        <Route path="/instructor/settings" element={<InstructorSettings />} />
        <Route path="/instructor/content" element={<InstructorContent />} />
        <Route path="/instructor/notifications" element={<InstructorNotifications />} />
        <Route path="/instructor/trainers" element={<AllTrainers />} />
        <Route path="/instructor/curriculum" element={<InstructorCurriculum />} />
        <Route path="/instructor/assignments" element={<InstructorAssignments />} />
        <Route path="/instructor/quizzes" element={<InstructorQuizzes />} />
        <Route path="/instructor/discussions" element={<InstructorDiscussions />} />
        <Route path="/instructor/announcements" element={<InstructorAnnouncements />} />
        <Route path="/instructor/flashcards" element={<InstructorFlashcards />} />
        <Route path="/instructor/leaderboard" element={<InstructorLeaderboard />} />
      </Route>
    </Route>

    {/* Legacy /university/* -> /organization/* redirects */}
    <Route path="/university" element={<LegacyUniversityRedirect />} />
    <Route path="/university/*" element={<LegacyUniversityRedirect />} />

    {/* Organization (16 + catch-all) */}
    <Route element={<RoleGuard roles={["organization"]} />}>
      <Route element={<RoleGroup />}>
        <Route path="/organization" element={<OrganizationDashboard />} />
        <Route path="/organization/departments" element={<OrganizationDepartments />} />
        <Route path="/organization/instructors" element={<OrganizationInstructors />} />
        <Route path="/organization/trainers" element={<OrganizationTrainers />} />
        <Route path="/organization/courses" element={<OrganizationCourses />} />
        <Route path="/organization/analytics" element={<OrganizationAnalytics />} />
        <Route path="/organization/settings" element={<OrganizationSettings />} />
        <Route path="/organization/terms" element={<OrganizationAcademicTerms />} />
        <Route path="/organization/sections" element={<OrganizationSections />} />
        <Route path="/organization/enrollment" element={<OrganizationEnrollment />} />
        <Route path="/organization/exams" element={<OrganizationExams />} />
        <Route path="/organization/announcements" element={<OrganizationAnnouncements />} />
        <Route path="/organization/content" element={<OrganizationContentLibrary />} />
        <Route path="/organization/reports" element={<OrganizationReports />} />
        <Route path="/organization/ai-insights" element={<OrganizationAIInsights />} />
        <Route path="/organization/roles" element={<OrganizationRoles />} />
        <Route path="/organization/*" element={<NotFound />} />
      </Route>
    </Route>

    {/* Admin (6) */}
    <Route element={<RoleGuard roles={["admin"]} />}>
      <Route element={<RoleGroup />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/courses" element={<AdminCourses />} />
        <Route path="/admin/enrollments" element={<AdminEnrollments />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Route>
    </Route>

    {/* Catch-all */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <StudySessionProvider>
              <AppRoutes />
            </StudySessionProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
