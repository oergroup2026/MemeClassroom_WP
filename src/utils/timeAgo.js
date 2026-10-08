// Relative "posted X ago" labels for anything users publish.
// Accepts a Firestore Timestamp, {seconds}, Date, epoch ms, or ISO string.

const toMillis = (value) => {
  if (value == null) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;

/**
 * Minutes up to 1h, hours up to 24h, days up to 7d, weeks up to ~4w,
 * months up to 12mo, then years. Returns `fallback` when there is no date.
 */
export const formatTimeAgo = (value, fallback = "Just now", now = Date.now()) => {
  const ms = toMillis(value);
  if (ms == null) return fallback;

  const seconds = Math.max(0, Math.floor((now - ms) / 1000));
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return plural(minutes, "min");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour");

  const days = Math.floor(hours / 24);
  if (days < 7) return plural(days, "day");
  if (days < 30) return plural(Math.floor(days / 7), "week");

  if (days < 365) return plural(Math.floor(days / 30), "month");

  return plural(Math.floor(days / 365), "year");
};

/** Full date + time, for hover tooltips next to a relative label. */
export const formatFullDate = (value) => {
  const ms = toMillis(value);
  return ms == null ? "" : new Date(ms).toLocaleString();
};
