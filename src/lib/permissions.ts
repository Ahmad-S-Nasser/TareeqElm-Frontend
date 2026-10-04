/**
 * Permission names (mirror of the backend catalog, Nafea.Domain/Authorization/Permissions.cs).
 * Role routing still uses the base role (RoleGuard); permissions only decide which items/actions are shown.
 */
export const PERMISSIONS = {
  coursesWrite: 'courses.write',
  quizzesManage: 'quizzes.manage',
  aiAuthor: 'ai.author',
  assignmentsManage: 'assignments.manage',
  assignmentsSubmit: 'assignments.submit',
  discussionsManage: 'discussions.manage',
  discussionsParticipate: 'discussions.participate',
  decksManage: 'decks.manage',
  examsView: 'exams.view',
  instructorsView: 'instructors.view',
  organizationView: 'organization.view',
  adminStats: 'admin.stats',
  contentView: 'content.view',
  contentManage: 'content.manage',
  announcementsManage: 'announcements.manage',
  materialsView: 'materials.view',
  notificationsUse: 'notifications.use',
  leaderboardView: 'leaderboard.view',
  departmentsManage: 'departments.manage',
  sectionsManage: 'sections.manage',
  termsManage: 'terms.manage',
  /** Manage buildings and rooms used for offline lesson sessions. Organization + Admin. */
  facilitiesManage: 'facilities.manage',
  /** Schedule Live-online/Offline lesson occurrences and read the organization calendar. Instructor + Organization + Admin. */
  sessionsManage: 'sessions.manage',
  enrollmentsManage: 'enrollments.manage',
  /** Manage academic years and grades. Organization + Admin; the API also refuses any non-School organization. */
  academicStructureManage: 'academic-structure.manage',
  usersManage: 'users.manage',
  rolesManage: 'roles.manage',
  settingsManage: 'settings.manage',
  auditView: 'audit.view',
  /** Read the B2B lead inbox and move a lead along its pipeline. Admin. */
  leadsManage: 'leads.manage',
  /** Cross-tenant CRUD of Organization itself (provision, rename, set kind, suspend). Admin only. */
  organizationsManage: 'organizations.manage',
  enrollmentsSelf: 'enrollments.self',
  quizzesTake: 'quizzes.take',
  flashcardsUse: 'flashcards.use',
  studyUse: 'study.use',
  timeblocksUse: 'timeblocks.use',
  trainerStats: 'trainer.stats',

  // ---- monetization (phase 5, backend category "monetization") ----
  /** Set course / chapter / track prices. Organization + Admin. */
  pricingManage: 'pricing.manage',
  /** Create and curate learning tracks (bundles of courses). Organization + Admin. */
  tracksManage: 'tracks.manage',
  /** Read the platform-wide revenue dashboards. Organization + Admin. */
  revenueView: 'revenue.view',
  /** Read the caller organization's issued invoices. Organization. */
  invoicesView: 'invoices.view',
  /** Run the trainee-performance / course-completion / instructor-activity reports. Organization. */
  reportsView: 'reports.view',
  /** Browse every order, mark manual orders paid, re-apply fulfillment. Admin. */
  ordersManage: 'orders.manage',
  /** Issue refunds. Admin. */
  refundsManage: 'refunds.manage',
  /** Review trainee refund requests (approve = the refund runs immediately; reject with a note). Organization (own org) + Admin (all). */
  refundRequestsManage: 'refund-requests.manage',
  /** Review Trainees who requested to join without a join code (approve/reject). Organization (own org) + Admin (all). */
  pendingMembersManage: 'pending-members.manage',
  /** Manage discount coupons. Admin. */
  couponsManage: 'coupons.manage',
  /** Grant and revoke access (entitlements) by hand. Admin. */
  entitlementsManage: 'entitlements.manage',
  /** Create, approve and pay instructor payouts; set commission rates. Admin. */
  payoutsManage: 'payouts.manage',
  /** Read one's own earnings ledger and payouts. Instructor (scoped to the caller). */
  earningsSelf: 'earnings.self',
  /** Start a checkout and validate coupons. Trainer (LearnerScoped). */
  checkoutSelf: 'checkout.self',
  /** Read and cancel one's own orders. Trainer (LearnerScoped). */
  ordersSelf: 'orders.self',
  /** Read one's own entitlements. Trainer (LearnerScoped). */
  entitlementsSelf: 'entitlements.self',

  // ---- certificates and course assistants (catalog v8; endpoints land in later phases) ----
  /** Configure a course's/track's certificate. Instructor (own courses) + Organization + Admin. */
  certificatesManage: 'certificates.manage',
  /** Issue academic certificates by hand. Organization + Admin. */
  certificatesIssue: 'certificates.issue',
  /** One's own certificates. Trainer (LearnerScoped). */
  certificatesSelf: 'certificates.self',
  /** Assign teaching assistants to a course. Instructor (own courses) + Organization + Admin. */
  courseAssistantsManage: 'course-assistants.manage',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Fails closed: a missing permission list grants nothing. */
export const hasPermission = (granted: readonly string[] | null | undefined, permission: string): boolean =>
  Array.isArray(granted) && granted.includes(permission);

/** True when at least one of `wanted` is granted (an empty `wanted` is always allowed). */
export const hasAnyPermission = (granted: readonly string[] | null | undefined, wanted: readonly string[]): boolean =>
  wanted.length === 0 || wanted.some((p) => hasPermission(granted, p));
