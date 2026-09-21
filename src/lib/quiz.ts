export interface QuizQuestionLike {
  Id: string;
}

/** Format seconds as m:ss (or h:mm:ss for an hour or more). Negative values clamp to 0. */
export const formatTimeRemaining = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

/** Seconds left given the limit in minutes, the start timestamp and now (ms). */
export const secondsRemaining = (limitMinutes: number, startedAtMs: number, nowMs: number): number =>
  Math.max(0, Math.ceil(limitMinutes * 60 - (nowMs - startedAtMs) / 1000));

/** True when the timer should show the "under a minute" warning. */
export const isTimeWarning = (remainingSeconds: number): boolean => remainingSeconds > 0 && remainingSeconds < 60;

/** Number of questions without a selected option. */
export const countUnanswered = (questions: QuizQuestionLike[], answers: Record<string, number>): number =>
  questions.filter((q) => answers[q.Id] === undefined).length;

/** Answers payload: only answered questions, keyed by question id. */
export const buildAnswersPayload = (
  questions: QuizQuestionLike[],
  answers: Record<string, number>
): Record<string, number> => {
  const payload: Record<string, number> = {};
  for (const q of questions) {
    const a = answers[q.Id];
    if (a !== undefined) payload[q.Id] = a;
  }
  return payload;
};

/** Elapsed whole seconds, never negative. */
export const elapsedSeconds = (startedAtMs: number, nowMs: number): number =>
  Math.max(0, Math.round((nowMs - startedAtMs) / 1000));
