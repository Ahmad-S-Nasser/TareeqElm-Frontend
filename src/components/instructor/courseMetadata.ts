/** Mirrors the server's normalization caps (CourseService.MaxTags / MaxTagLength / MaxOutcomes / MaxOutcomeLength / MaxCourseRefs). */
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const MAX_OUTCOMES = 15;
export const MAX_OUTCOME_LENGTH = 200;
export const MAX_COURSE_REFS = 20;

/** Trim, drop blanks, keep the first case-insensitive spelling, cap count: the same rules the server applies. */
export const cleanTags = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH).trim();
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    result.push(tag);
  }
  return result.slice(0, MAX_TAGS);
};

/** Trim and drop blanks, keeping the instructor's order. */
export const cleanOutcomes = (outcomes: string[]): string[] =>
  outcomes.map((o) => o.trim()).filter(Boolean).slice(0, MAX_OUTCOMES);
