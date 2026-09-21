import type { TFunction } from "i18next";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { parseApiRole } from "@/lib/roles";

/**
 * Structured activity row returned by `GET /Admin/stats` and `GET /Organization/stats` (`RecentActivity[]`).
 * The legacy `Event` / `Time` strings must not be displayed.
 */
export interface RecentActivityItem {
  Action?: string | null;
  ActorId?: string | null;
  ActorName?: string | null;
  ActorRole?: string | null;
  TargetId?: string | null;
  TargetName?: string | null;
  At?: string | null;
}

export type ActivityTone = "success" | "info" | "primary" | "muted";

/** Colour hint for the activity dot: completed = success, enrolled = info, joined = primary. */
export const activityTone = (item: RecentActivityItem): ActivityTone => {
  switch (item.Action) {
    case "completed":
      return "success";
    case "enrolled":
      return "info";
    case "joined":
      return "primary";
    default:
      return "muted";
  }
};

/**
 * Composes the per-language sentence of an activity row from its structured fields, e.g.
 * "Sara enrolled in React Basics" / "سجّل Sara في React Basics".
 * A null name (deleted entity) shows the localized "Deleted user" / "Deleted course" placeholder.
 * `t` must be able to resolve the `admin`, `roles` and `common` namespaces (use `useActivitySentence`).
 */
export const activitySentence = (item: RecentActivityItem, t: TFunction): string => {
  const actor = item.ActorName ?? t("common:deletedUser");
  const course = item.TargetName ?? t("common:deletedCourse");

  switch (item.Action) {
    case "enrolled":
      return t("admin:activity.enrolled", { actor, target: course });
    case "completed":
      return t("admin:activity.completed", { actor, target: course });
    case "joined": {
      const appRole = parseApiRole(item.ActorRole ?? undefined);
      if (!appRole) return t("admin:activity.joinedNoRole", { actor });
      return t("admin:activity.joined", { actor, role: t(`roles:${appRole}.name`) });
    }
    default:
      return t("admin:activity.unknown");
  }
};

/** Hook returning a language-aware `(item) => sentence` (re-created when the language changes). */
export const useActivitySentence = () => {
  const { t } = useTranslation(["admin", "roles", "common"]);
  return useCallback((item: RecentActivityItem) => activitySentence(item, t), [t]);
};

/** Translates an audit-log action code such as `user.role.change`; unknown codes get a neutral label (never the raw code). */
export const auditActionLabel = (code: string | null | undefined, t: TFunction): string => {
  const key = (code ?? "").replace(/\./g, "_");
  const path = `admin:audit.actions.${key}`;
  return key && t(path, { defaultValue: "" }) ? t(path) : t("admin:audit.actions.unknown");
};
