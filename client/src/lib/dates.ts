const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function formatDay(s: string, today: string) {
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yesterday';
  return parseISODate(s).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatLongDate(s: string) {
  return parseISODate(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Weekday names starting Monday, with their JS day index (0 = Sunday). */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
  day,
  short: new Date(2024, 0, day === 0 ? 7 : day).toLocaleDateString(undefined, { weekday: 'short' }),
}));

export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
