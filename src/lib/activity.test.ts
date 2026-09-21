import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { activitySentence, activityTone, auditActionLabel } from "./activity";

describe("activitySentence", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    await i18n.loadNamespaces(["admin", "roles", "common"]);
  });

  it("composes English sentences from structured data", () => {
    const t = i18n.t.bind(i18n);
    expect(activitySentence({ Action: "enrolled", ActorName: "Sara Ali", TargetName: "React Basics" }, t)).toBe(
      "Sara Ali enrolled in React Basics"
    );
    expect(activitySentence({ Action: "completed", ActorName: "Sara Ali", TargetName: "React Basics" }, t)).toBe(
      "Sara Ali completed React Basics"
    );
    expect(activitySentence({ Action: "joined", ActorName: "Omar", ActorRole: "Instructor" }, t)).toBe(
      "Omar joined as Instructor"
    );
  });

  it("composes Arabic sentences and localizes the joined role", async () => {
    await i18n.changeLanguage("ar");
    const t = i18n.t.bind(i18n);
    expect(activitySentence({ Action: "enrolled", ActorName: "Sara Ali", TargetName: "React Basics" }, t)).toBe(
      "سجّل Sara Ali في React Basics"
    );
    expect(activitySentence({ Action: "joined", ActorName: "Omar", ActorRole: "Trainer" }, t)).toBe(
      "انضم Omar بصفة متدرّب"
    );
  });

  it("uses placeholders for deleted entities and never a raw id or generic word", async () => {
    const t = i18n.t.bind(i18n);
    expect(activitySentence({ Action: "enrolled", ActorName: null, TargetName: null }, t)).toBe(
      "Deleted user enrolled in Deleted course"
    );
    await i18n.changeLanguage("ar");
    expect(activitySentence({ Action: "completed", ActorName: null, TargetName: "X" }, i18n.t.bind(i18n))).toContain(
      "X"
    );
  });

  it("handles joined without a known role and unknown actions", () => {
    const t = i18n.t.bind(i18n);
    expect(activitySentence({ Action: "joined", ActorName: "Omar", ActorRole: null }, t)).toBe(
      "Omar joined the platform"
    );
    expect(activitySentence({ Action: "something-new" }, t)).toBe("New activity");
  });

  it("maps actions to tones", () => {
    expect(activityTone({ Action: "completed" })).toBe("success");
    expect(activityTone({ Action: "enrolled" })).toBe("info");
    expect(activityTone({ Action: "joined" })).toBe("primary");
    expect(activityTone({})).toBe("muted");
  });

  it("translates audit action codes and hides unknown codes", async () => {
    const t = i18n.t.bind(i18n);
    expect(auditActionLabel("user.role.change", t)).toBe("changed a user role");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(auditActionLabel("weird.code", t)).toBe("performed an action");
    warn.mockRestore();
    await i18n.changeLanguage("ar");
    expect(auditActionLabel("course.delete", i18n.t.bind(i18n))).toBe("حذف دورة");
  });
});
