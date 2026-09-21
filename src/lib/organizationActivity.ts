import type { TFunction } from 'i18next';

/** Structured activity item returned by GET /Organization/stats (RecentActivity[]). */
export interface OrganizationActivity {
  Action?: string | null;
  ActorId?: string | null;
  ActorName?: string | null;
  ActorRole?: string | null;
  TargetId?: string | null;
  TargetName?: string | null;
  At?: string | null;
}

const ROLE_KEYS: Record<string, string> = {
  Admin: 'admin',
  Instructor: 'instructor',
  Organization: 'organization',
  Trainer: 'applicant',
};

/** Dot colour token for an activity action. */
export const activityTone = (action?: string | null): 'success' | 'info' | 'warn' =>
  action === 'completed' ? 'success' : 'info';

/**
 * Composes the localized sentence for an activity item from its structured fields.
 * Never uses the legacy `Event` / `Time` strings. Missing names use the localized "deleted" placeholders.
 */
export const describeActivity = (item: OrganizationActivity, t: TFunction): string => {
  const actor = item.ActorName ?? t('common:deletedUser');
  const target = item.TargetName ?? t('common:deletedCourse');
  switch (item.Action) {
    case 'enrolled':
      return t('organization:activity.enrolled', { actor, target });
    case 'completed':
      return t('organization:activity.completed', { actor, target });
    case 'joined': {
      const roleKey = item.ActorRole ? ROLE_KEYS[item.ActorRole] : undefined;
      if (roleKey) return t('organization:activity.joinedAs', { actor, role: t(`roles:${roleKey}.name`) });
      return t('organization:activity.joined', { actor });
    }
    default:
      return t('organization:activity.other', { actor });
  }
};
