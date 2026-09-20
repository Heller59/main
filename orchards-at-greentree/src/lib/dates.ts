/**
 * All schedule dates are plain calendar days ("2026-10-12"), not instants.
 * `new Date("2026-10-12")` parses as UTC midnight, which lands on the previous
 * day for anyone west of Greenwich — so we always split the string by hand.
 */

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

/** Today with the clock stripped off. */
export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function todayISO(): string {
  return toISO(today());
}

/** "Thursday, September 24" */
export function fmtLong(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Thu, Sep 24" */
export function fmtShort(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

/** "September 2026" */
export function fmtMonthYear(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** Whole days from today to `iso`. Negative means it has already passed. */
export function daysUntil(iso: string): number {
  const ms = parseISO(iso).getTime() - today().getTime();
  return Math.round(ms / 86400000);
}

/** "Today" / "Tomorrow" / "in 5 days" */
export function relativeLabel(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 0) return `${Math.abs(n)} days ago`;
  return `in ${n} days`;
}

export { MONTHS, WEEKDAYS };
