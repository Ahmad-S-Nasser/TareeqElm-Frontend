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
const SetNewPassword = lazy(() => import("./pages/SetNewPassword"));

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
const TrainerAssignments = lazy(() => import("./pages/TrainerAssignments"));
const MyAttendance = lazy(() => import("./pages/MyAttendance"));
const TrainerDiscussions = lazy(() => import("./pages/TrainerDiscussions"));
const Checkout = lazy(() => import("./pages/Checkout"));
const MyPurchases = lazy(() => import("./pages/MyPurchases"));
const OrderReceipt = lazy(() => import("./pages/OrderReceipt"));
const MyCertificates = lazy(() => import("./pages/MyCertificates"));

// ── Public certificate verification (no sign-in) ─────────────────────────────
const CertificateVerify = lazy(() => import("./pages/CertificateVerify"));

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
const InstructorSessions = lazy(() => import("./pages/InstructorSessions"));
const InstructorQuizzes = lazy(() => import("./pages/InstructorQuizzes"));
const InstructorDiscussions = lazy(() => import("./pages/InstructorDiscussions"));
const InstructorAnnouncements = lazy(() => import("./pages/InstructorAnnouncements"));
const InstructorFlashcards = lazy(() => import("./pages/InstructorFlashcards"));
const InstructorLeaderboard = lazy(() => import("./pages/InstructorLeaderboard"));
const InstructorEarnings = lazy(() => import("./pages/InstructorEarnings"));

// ── Organization ──────────────────────────────────────────────────────────────
const OrganizationDashboard = lazy(() => import("./pages/OrganizationDashboard"));
const OrganizationDepartments = lazy(() => import("./pages/OrganizationDepartments"));
const OrganizationFacilities = lazy(() => import("./pages/OrganizationFacilities"));
const OrganizationInstructors = lazy(() => import("./pages/OrganizationInstructors"));
const OrganizationTrainers = lazy(() => import("./pages/OrganizationTrainers"));
const OrganizationCourses = lazy(() => import("./pages/OrganizationCourses"));
const OrganizationAnalytics = lazy(() => import("./pages/OrganizationAnalytics"));
const OrganizationSettings = lazy(() => import("./pages/OrganizationSettings"));
const OrganizationAcademicTerms = lazy(() => import("./pages/OrganizationAcademicTerms"));
const OrganizationAcademicYears = lazy(() => import("./pages/OrganizationAcademicYears"));
const OrganizationGrades = lazy(() => import("./pages/OrganizationGrades"));
const OrganizationCalendar = lazy(() => import("./pages/OrganizationCalendar"));
const OrganizationSections = lazy(() => import("./pages/OrganizationSections"));
const OrganizationEnrollment = lazy(() => import("./pages/OrganizationEnrollment"));
const OrganizationExams = lazy(() => import("./pages/OrganizationExams"));
const OrganizationAnnouncements = lazy(() => import("./pages/OrganizationAnnouncements"));
const OrganizationContentLibrary = lazy(() => import("./pages/OrganizationContentLibrary"));
const OrganizationReports = lazy(() => import("./pages/OrganizationReports"));
const FinancialOrdersReport = lazy(() => import("./pages/reports/FinancialOrdersReport"));
const DepartmentAnalyticsReport = lazy(() => import("./pages/reports/DepartmentAnalyticsReport"));
const TraineePerformanceReport = lazy(() => import("./pages/reports/TraineePerformanceReport"));
const CourseCompletionReport = lazy(() => import("./pages/reports/CourseCompletionReport"));
const InstructorActivityReport = lazy(() => import("./pages/reports/InstructorActivityReport"));
const OrganizationAIInsights = lazy(() => import("./pages/OrganizationAIInsights"));
const OrganizationRoles = lazy(() => import("./pages/OrganizationRoles"));
const OrganizationCatalogPricing = lazy(() => import("./pages/OrganizationCatalogPricing"));
const OrganizationRevenue = lazy(() => import("./pages/OrganizationRevenue"));
const OrganizationInvoices = lazy(() => import("./pages/OrganizationInvoices"));
const OrganizationRefundRequests = lazy(() => import("./pages/OrganizationRefundRequests"));
const OrganizationOrders = lazy(() => import("./pages/OrganizationOrders"));
const OrganizationPlatformCourses = lazy(() => import("./pages/OrganizationPlatformCourses"));
const OrganizationBilling = lazy(() => import("./pages/OrganizationBilling"));
const OrganizationCoupons = lazy(() => import("./pages/OrganizationCoupons"));
const OrganizationPayouts = lazy(() => import("./pages/OrganizationPayouts"));
const OrganizationPendingMembers = lazy(() => import("./pages/OrganizationPendingMembers"));
const InvoiceDocument = lazy(() => import("./pages/InvoiceDocument"));

// ── Admin ───────────────────────────────────────────────────────────────────
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminEnrollments = lazy(() => import("./pages/AdminEnrollments"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminRoles = lazy(() => import("./pages/AdminRoles"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminCatalogPricing = lazy(() => import("./pages/AdminCatalogPricing"));
const AdminRevenue = lazy(() => import("./pages/AdminRevenue"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminRefundRequests = lazy(() => import("./pages/AdminRefundRequests"));
const AdminCoupons = lazy(() => import("./pages/AdminCoupons"));
const AdminPayouts = lazy(() => import("./pages/AdminPayouts"));
const AdminLeads = lazy(() => import("./pages/AdminLeads"));
const AdminOrganizations = lazy(() => import("./pages/AdminOrganizations"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));

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
    {/* Anyone holding a printed certificate can check it here; the page itself needs no account. */}
    {/* RoleGroup without a RoleGuard: just the error boundary + Suspense for the lazy page. */}
    <Route element={<RoleGroup />}>
      <Route path="/verify/:code" element={<CertificateVerify />} />
    </Route>

    {/* Any signed-in user: onboarding + shared pages */}
    <Route element={<RoleGuard />}>
      <Route element={<RoleGroup />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/auth/set-password" element={<SetNewPassword />} />
      </Route>
    </Route>

    {/* Trainer (18). To add a page: add a lazy import above and a <Route> here. */}
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
        <Route path="/assignments" element={<TrainerAssignments />} />
        <Route path="/attendance" element={<MyAttendance />} />
        <Route path="/discussions" element={<TrainerDiscussions />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/purchases" element={<MyPurchases />} />
        <Route path="/purchases/:orderId" element={<OrderReceipt />} />
        <Route path="/certificates" element={<MyCertificates />} />
        <Route path="/certificates/:certificateId" element={<MyCertificates />} />
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
        <Route path="/instructor/sessions" element={<InstructorSessions />} />
        <Route path="/instructor/quizzes" element={<InstructorQuizzes />} />
        <Route path="/instructor/discussions" element={<InstructorDiscussions />} />
        <Route path="/instructor/announcements" element={<InstructorAnnouncements />} />
        <Route path="/instructor/flashcards" element={<InstructorFlashcards />} />
        <Route path="/instructor/leaderboard" element={<InstructorLeaderboard />} />
        <Route path="/instructor/earnings" element={<InstructorEarnings />} />
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
        <Route path="/organization/facilities" element={<OrganizationFacilities />} />
        <Route path="/organization/instructors" element={<OrganizationInstructors />} />
        <Route path="/organization/trainers" element={<OrganizationTrainers />} />
        <Route path="/organization/courses" element={<OrganizationCourses />} />
        <Route path="/organization/analytics" element={<OrganizationAnalytics />} />
        <Route path="/organization/settings" element={<OrganizationSettings />} />
        <Route path="/organization/terms" element={<OrganizationAcademicTerms />} />
        <Route path="/organization/academic-years" element={<OrganizationAcademicYears />} />
        <Route path="/organization/grades" element={<OrganizationGrades />} />
        <Route path="/organization/calendar" element={<OrganizationCalendar />} />
        <Route path="/organization/sections" element={<OrganizationSections />} />
        <Route path="/organization/enrollment" element={<OrganizationEnrollment />} />
        <Route path="/organization/exams" element={<OrganizationExams />} />
        <Route path="/organization/announcements" element={<OrganizationAnnouncements />} />
        <Route path="/organization/content" element={<OrganizationContentLibrary />} />
        <Route path="/organization/reports" element={<OrganizationReports />} />
        <Route path="/organization/reports/financial" element={<FinancialOrdersReport />} />
        <Route path="/organization/reports/department-analytics" element={<DepartmentAnalyticsReport />} />
        <Route path="/organization/reports/trainee-performance" element={<TraineePerformanceReport />} />
        <Route path="/organization/reports/course-completion" element={<CourseCompletionReport />} />
        <Route path="/organization/reports/instructor-activity" element={<InstructorActivityReport />} />
        <Route path="/organization/ai-insights" element={<OrganizationAIInsights />} />
        <Route path="/organization/roles" element={<OrganizationRoles />} />
        <Route path="/organization/catalog" element={<OrganizationCatalogPricing />} />
        <Route path="/organization/revenue" element={<OrganizationRevenue />} />
        <Route path="/organization/invoices" element={<OrganizationInvoices />} />
        <Route path="/organization/invoices/:invoiceId" element={<InvoiceDocument />} />
        <Route path="/organization/refund-requests" element={<OrganizationRefundRequests />} />
        <Route path="/organization/orders" element={<OrganizationOrders />} />
        <Route path="/organization/platform-courses" element={<OrganizationPlatformCourses />} />
        <Route path="/organization/billing" element={<OrganizationBilling />} />
        <Route path="/organization/coupons" element={<OrganizationCoupons />} />
        <Route path="/organization/payouts" element={<OrganizationPayouts />} />
        <Route path="/organization/pending-members" element={<OrganizationPendingMembers />} />
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
        <Route path="/admin/roles" element={<AdminRoles />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/catalog" element={<AdminCatalogPricing />} />
        <Route path="/admin/revenue" element={<AdminRevenue />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/refund-requests" element={<AdminRefundRequests />} />
        <Route path="/admin/coupons" element={<AdminCoupons />} />
        <Route path="/admin/payouts" element={<AdminPayouts />} />
        <Route path="/admin/leads" element={<AdminLeads />} />
        <Route path="/admin/organizations" element={<AdminOrganizations />} />
        <Route path="/admin/audit" element={<AdminAuditLog />} />
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
