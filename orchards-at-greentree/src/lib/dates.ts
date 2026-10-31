/**
 * All schedule dates are plain calendar days ("2026-10-12"), not instants.
 * `new Date("2026-10-12")` parses as UTC midnight, which lands on the previous
 * day for anyone west of Greenwich — so we always split the string by hand.
 */
import { translations, type Locale } from '../i18n/translations';

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

/** "Thursday, September 24" / "jueves, 24 de septiembre" */
export function fmtLong(iso: string, locale: Locale = 'en'): string {
  const d = parseISO(iso);
  const { weekdays, months } = translations[locale];
  if (locale === 'es') {
    return `${weekdays[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
  }
  return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

/** "Thu, Sep 24" / "jue, 24 sept" */
export function fmtShort(iso: string, locale: Locale = 'en'): string {
  const d = parseISO(iso);
  const { weekdays, months } = translations[locale];
  if (locale === 'es') {
    return `${weekdays[d.getDay()].slice(0, 3)}, ${d.getDate()} ${months[d.getMonth()].slice(0, 4)}`;
  }
  return `${weekdays[d.getDay()].slice(0, 3)}, ${months[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

/** "September 2026" / "septiembre de 2026" */
export function fmtMonthYear(year: number, month: number, locale: Locale = 'en'): string {
  const { months } = translations[locale];
  return locale === 'es' ? `${months[month]} de ${year}` : `${months[month]} ${year}`;
}

/** Whole days from today to `iso`. Negative means it has already passed. */
export function daysUntil(iso: string): number {
  const ms = parseISO(iso).getTime() - today().getTime();
  return Math.round(ms / 86400000);
}

/** "Today" / "Tomorrow" / "in 5 days" */
export function relativeLabel(iso: string, locale: Locale = 'en'): string {
  const n = daysUntil(iso);
  const t = translations[locale].event;
  if (n === 0) return t.today;
  if (n === 1) return t.tomorrow;
  if (n < 0) return t.daysAgo(Math.abs(n));
  return t.inDays(n);
}
