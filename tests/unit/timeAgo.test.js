import { describe, it, expect } from "vitest";
import { formatTimeAgo } from "../../src/utils/timeAgo";

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
const ago = (ms) => ({ seconds: (NOW - ms) / 1000 });
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatTimeAgo", () => {
  it("falls back when there is no date", () => {
    expect(formatTimeAgo(null, "Unknown")).toBe("Unknown");
    expect(formatTimeAgo(undefined)).toBe("Just now");
  });

  it("uses minutes below an hour", () => {
    expect(formatTimeAgo(ago(30_000), "x", NOW)).toBe("Just now");
    expect(formatTimeAgo(ago(5 * MIN), "x", NOW)).toBe("5 mins ago");
  });

  it("uses hours up to 24h", () => {
    expect(formatTimeAgo(ago(HOUR), "x", NOW)).toBe("1 hour ago");
    expect(formatTimeAgo(ago(23 * HOUR + 59 * MIN), "x", NOW)).toBe("23 hours ago");
  });

  it("uses days up to 7 days", () => {
    expect(formatTimeAgo(ago(24 * HOUR), "x", NOW)).toBe("1 day ago");
    expect(formatTimeAgo(ago(6 * DAY), "x", NOW)).toBe("6 days ago");
  });

  it("uses weeks up to 4 weeks", () => {
    expect(formatTimeAgo(ago(7 * DAY), "x", NOW)).toBe("1 week ago");
    expect(formatTimeAgo(ago(28 * DAY), "x", NOW)).toBe("4 weeks ago");
  });

  it("uses months up to 12 months, then years", () => {
    expect(formatTimeAgo(ago(30 * DAY), "x", NOW)).toBe("1 month ago");
    expect(formatTimeAgo(ago(364 * DAY), "x", NOW)).toBe("12 months ago");
    expect(formatTimeAgo(ago(365 * DAY), "x", NOW)).toBe("1 year ago");
    expect(formatTimeAgo(ago(800 * DAY), "x", NOW)).toBe("2 years ago");
  });

  it("accepts Date, ms and Firestore-style timestamps", () => {
    expect(formatTimeAgo(new Date(NOW - 2 * HOUR), "x", NOW)).toBe("2 hours ago");
    expect(formatTimeAgo(NOW - 3 * DAY, "x", NOW)).toBe("3 days ago");
    expect(formatTimeAgo({ toMillis: () => NOW - 2 * DAY }, "x", NOW)).toBe("2 days ago");
  });
});
