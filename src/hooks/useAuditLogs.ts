/**
 * The audit trail (`GET /api/admin/audit-logs`, permission `audit.view`).
 *
 * The endpoint and its `AuditLogDto` predate phase 5 — every service in the app has been writing to it since phase 4.5
 * through `IAuditService.RecordAsync`. Wave F2c is simply the first screen to *read* it, so this hook wraps the shape
 * that already exists rather than proposing a new one:
 *
 *   GET /api/admin/audit-logs?actor=&action=&targetType=&from=&to=&page=&pageSize=   (total in X-Total-Count)
 *
 * `From` and `To` are both inclusive, and a bare date as `To` covers that whole day — the same rule every other admin
 * date filter follows. `Actor` matches an actor **id**, so the page turns a clicked name into that id rather than
 * asking anyone to type one.
 *
 * Names arrive resolved (`ActorName`, `TargetName`): the server does one users query plus one query per distinct
 * target type for the whole page, so no screen here ever renders a raw id where a name exists.
 *
 * Audit rows are append-only, so there is nothing to invalidate and no mutation in this file.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** `AuditLogDto` — one entry. */
export interface AuditLogEntry {
  Id: string;
  ActorId: string | null;
  /** The actor's base role at the time, as the API spells it ("Admin", "Instructor"...). */
  ActorRole: string | null;
  /** Resolved full name; null when there is no actor (a system action) or the account is gone. */
  ActorName: string | null;
  /** A stable dotted code, e.g. `coupon.create` — translated through `auditActionLabel`, never shown raw. */
  Action: string;
  TargetType: string;
  TargetId: string | null;
  /** Resolved name of the target; null when it no longer exists or its type has no name. */
  TargetName: string | null;
  Detail: string | null;
  Ip: string | null;
  At: string;
}

export interface AuditLogFilters {
  /** An actor **id**, not a name. */
  actor?: string;
  action?: string;
  targetType?: string;
  /** ISO-8601 or a bare date; both ends inclusive. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogsPage {
  items: AuditLogEntry[];
  total: number;
}

export const AUDIT_PAGE_SIZE = 25;
/** `AuditService.MaxPageSize` — the server clamps anything larger. */
export const AUDIT_MAX_PAGE_SIZE = 100;

/**
 * react-query keys for the audit trail. It is not billing data, so it deliberately sits outside `billingKeys`: a
 * refund invalidating every `['billing']` cache must not drag the audit table along with it.
 */
export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (filters: AuditLogFilters = {}) =>
    [
      'audit-logs',
      'list',
      filters.actor ?? '',
      filters.action ?? '',
      filters.targetType ?? '',
      filters.from ?? '',
      filters.to ?? '',
      filters.page ?? 1,
      filters.pageSize ?? AUDIT_PAGE_SIZE,
    ] as const,
};

/** `GET /api/admin/audit-logs` — newest first, paged. */
export const useAuditLogsQuery = (filters: AuditLogFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: async (): Promise<AuditLogsPage> => {
      const res = await api.get<AuditLogEntry[]>('/admin/audit-logs', {
        params: {
          actor: filters.actor?.trim() || undefined,
          action: filters.action || undefined,
          targetType: filters.targetType || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          page: filters.page ?? 1,
          pageSize: Math.min(filters.pageSize ?? AUDIT_PAGE_SIZE, AUDIT_MAX_PAGE_SIZE),
        },
      });
      const total = Number(res.headers['x-total-count'] ?? res.data.length);
      return { items: res.data, total: Number.isFinite(total) ? total : res.data.length };
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
};

/**
 * Every action code the backend records, for the filter dropdown. Each one has an `admin:audit.actions.*` label (the
 * code with its dots turned into underscores); `auditActionLabel` falls back to a neutral sentence for anything
 * recorded by a newer service than this list, so an unknown code degrades instead of leaking a raw string.
 */
export const AUDIT_ACTIONS = [
  'auth.login.success',
  'auth.login.failure',
  'auth.register',
  'auth.password.change',
  'user.create',
  'user.update',
  'user.delete',
  'user.role.change',
  'user.activate',
  'user.deactivate',
  'user.password.reset',
  'preferences.update',
  'role.create',
  'role.update',
  'role.delete',
  'course.create',
  'course.update',
  'course.delete',
  'course.publish',
  'course.archive',
  'course.status.change',
  'course.pricing.update',
  'course.pricing.grandfather',
  'chapter.pricing.update',
  'track.create',
  'track.update',
  'track.delete',
  'track.courses.update',
  'track.pricing.update',
  'order.create',
  'order.paid',
  'order.mark_paid',
  'order.cancel',
  'order.expired',
  'order.reapply',
  'order.reconciled',
  'order.refund',
  'order.refund.access_kept',
  'order.refund.failed',
  'payment.amount_mismatch',
  'payment.event.abandoned',
  'coupon.create',
  'coupon.update',
  'coupon.delete',
  'coupon.deactivate',
  'entitlement.grant',
  'entitlement.grant.enroll',
  'entitlement.revoke',
  'entitlement.revoke.unenroll',
  'payout.create',
  'payout.approve',
  'payout.mark_paid',
  'payout.cancel',
  'payout.commission',
  'enrollment.bulk',
  'enrollment.unenroll',
  'announcement.create',
  'announcement.update',
  'announcement.delete',
  'assignment.create',
  'assignment.update',
  'assignment.delete',
  'assignment.grade',
  'discussion.create',
  'discussion.update',
  'discussion.delete',
  'discussion.reply',
  'discussion.reply_delete',
  'discussion.state',
  'deck.create',
  'deck.update',
  'deck.delete',
  'deck.card.create',
  'deck.card.update',
  'deck.card.delete',
  'deck.card.import',
  'deck.add_to_my_cards',
  'content.create',
  'content.delete',
  'quiz.delete',
  'section.create',
  'section.update',
  'section.delete',
  'department.create',
  'department.update',
  'department.delete',
  'term.create',
  'term.update',
  'term.delete',
  'lead.status.update',
  'settings.update',
] as const;

/**
 * The target types worth filtering by. The table renders whatever type an entry carries (falling back to the raw
 * type name for anything not listed) — this is only the dropdown, kept short on purpose.
 */
export const AUDIT_TARGET_TYPES = [
  'User',
  'Course',
  'Chapter',
  'Track',
  'Order',
  'Refund',
  'Coupon',
  'Payout',
  'Entitlement',
  'Enrollment',
  'Role',
  'Lead',
  'PlatformSettings',
] as const;
