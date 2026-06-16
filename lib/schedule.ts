export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// Mon-first ordering for the weekly schedule grid.
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS[weekday] ?? "-";
}

// "18:00" -> "6:00 PM"
export function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? 0);
  if (!Number.isFinite(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}
