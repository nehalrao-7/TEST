import { describe, expect, it } from "vitest";
import { WEEKDAY_ORDER, formatTime, formatTimeRange, weekdayLabel } from "@/lib/schedule";

describe("schedule helpers", () => {
  it("formats 24h times to 12h", () => {
    expect(formatTime("18:00")).toBe("6:00 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:30")).toBe("12:30 PM");
    expect(formatTime("09:05")).toBe("9:05 AM");
  });

  it("formats a time range", () => {
    expect(formatTimeRange("17:00", "18:30")).toBe("5:00 PM – 6:30 PM");
  });

  it("labels weekdays (0=Sunday)", () => {
    expect(weekdayLabel(0)).toBe("Sunday");
    expect(weekdayLabel(6)).toBe("Saturday");
    expect(weekdayLabel(99)).toBe("-");
  });

  it("orders the week Monday-first", () => {
    expect(WEEKDAY_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});
