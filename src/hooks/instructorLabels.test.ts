import { describe, it, expect } from "vitest";
import i18n from "@/i18n";
import { weekLabel, courseStatusLabel } from "@/hooks/useInstructorStats";
import { lessonTypeLabel } from "@/hooks/useCourseEditor";

describe("instructor code labels", () => {
  it("translates API codes in English", async () => {
    await i18n.changeLanguage("en");
    const t = i18n.getFixedT("en", "instructor") as never;
    expect(weekLabel(t, "W2")).toBe("Week 2");
    expect(courseStatusLabel(t, "Published")).toBe("Published");
    expect(lessonTypeLabel(t, "text")).toBe("Article / Text");
  });
  it("translates API codes in Arabic", async () => {
    await i18n.changeLanguage("ar");
    const t = i18n.getFixedT("ar", "instructor") as never;
    expect(weekLabel(t, "W1")).toBe("الأسبوع 1");
    expect(courseStatusLabel(t, "Draft")).toBe("مسودة");
    expect(lessonTypeLabel(t, "Quiz")).toBe("اختبار");
  });
});
