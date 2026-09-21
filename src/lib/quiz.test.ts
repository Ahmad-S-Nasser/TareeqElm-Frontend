import { describe, expect, it } from "vitest";
import {
  buildAnswersPayload,
  countUnanswered,
  elapsedSeconds,
  formatTimeRemaining,
  isTimeWarning,
  secondsRemaining,
} from "./quiz";

const questions = [{ Id: "a" }, { Id: "b" }, { Id: "c" }];

describe("quiz helpers", () => {
  it("formatTimeRemaining formats m:ss and h:mm:ss and clamps negatives", () => {
    expect(formatTimeRemaining(0)).toBe("0:00");
    expect(formatTimeRemaining(5)).toBe("0:05");
    expect(formatTimeRemaining(65)).toBe("1:05");
    expect(formatTimeRemaining(600)).toBe("10:00");
    expect(formatTimeRemaining(3600)).toBe("1:00:00");
    expect(formatTimeRemaining(3725)).toBe("1:02:05");
    expect(formatTimeRemaining(-10)).toBe("0:00");
    expect(formatTimeRemaining(59.9)).toBe("0:59");
  });

  it("secondsRemaining counts down from the limit and never goes below 0", () => {
    expect(secondsRemaining(10, 1_000, 1_000)).toBe(600);
    expect(secondsRemaining(10, 1_000, 61_000)).toBe(540);
    expect(secondsRemaining(10, 0, 500)).toBe(600); // ceil of 599.5
    expect(secondsRemaining(1, 0, 60_000)).toBe(0);
    expect(secondsRemaining(1, 0, 999_999)).toBe(0);
  });

  it("isTimeWarning is true only strictly between 0 and 60 seconds", () => {
    expect(isTimeWarning(61)).toBe(false);
    expect(isTimeWarning(60)).toBe(false);
    expect(isTimeWarning(59)).toBe(true);
    expect(isTimeWarning(1)).toBe(true);
    expect(isTimeWarning(0)).toBe(false);
  });

  it("countUnanswered counts questions without an answer (index 0 counts as answered)", () => {
    expect(countUnanswered(questions, {})).toBe(3);
    expect(countUnanswered(questions, { a: 0 })).toBe(2);
    expect(countUnanswered(questions, { a: 0, b: 2, c: 1 })).toBe(0);
    expect(countUnanswered([], {})).toBe(0);
  });

  it("buildAnswersPayload keeps only answered questions and ignores unknown ids", () => {
    expect(buildAnswersPayload(questions, { a: 0, c: 3, zzz: 1 })).toEqual({ a: 0, c: 3 });
    expect(buildAnswersPayload(questions, {})).toEqual({});
  });

  it("elapsedSeconds rounds and never returns negative", () => {
    expect(elapsedSeconds(0, 1_400)).toBe(1);
    expect(elapsedSeconds(0, 1_600)).toBe(2);
    expect(elapsedSeconds(5_000, 1_000)).toBe(0);
  });
});
