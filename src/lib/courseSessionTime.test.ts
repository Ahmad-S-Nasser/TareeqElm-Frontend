import { describe, it, expect } from "vitest";
import { zonedInputToUtcIso, utcIsoToZonedInput } from "./courseSessionTime";

describe("courseSessionTime", () => {
  it("converts a UTC zone's wall time to UTC unchanged", () => {
    expect(zonedInputToUtcIso("2026-06-15T10:00", "UTC")).toBe("2026-06-15T10:00:00.000Z");
  });

  it("converts a wall time in a fixed positive offset zone to the correct UTC instant", () => {
    // Asia/Riyadh is UTC+3 year-round (no DST), so 10:00 there is 07:00 UTC.
    expect(zonedInputToUtcIso("2026-06-15T10:00", "Asia/Riyadh")).toBe("2026-06-15T07:00:00.000Z");
  });

  it("round-trips a UTC instant back to the same wall time in the zone it was scheduled in", () => {
    const utcIso = zonedInputToUtcIso("2026-06-15T10:00", "Asia/Riyadh");
    expect(utcIsoToZonedInput(utcIso, "Asia/Riyadh")).toBe("2026-06-15T10:00");
  });

  it("shows the same instant with different wall times in different zones", () => {
    const utcIso = zonedInputToUtcIso("2026-06-15T10:00", "Asia/Riyadh");
    expect(utcIsoToZonedInput(utcIso, "UTC")).toBe("2026-06-15T07:00");
  });
});
