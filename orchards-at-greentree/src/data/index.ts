/**
 * The one file that changes each year.
 *
 * Replace src/data/schedule.json with the new year's data, bump the version in
 * app.json, and ship. No other source file references a specific year — the
 * year, the community name and every date are read from the JSON below.
 *
 * Run `npm run check-schedule` before shipping to validate a new file.
 */
import scheduleJson from './schedule.json';

export interface DatedEntry {
  date: string;
  note?: string;
  /** Spanish translation of `note`, shown when the app is in Spanish. */
  noteEs?: string;
}

export interface BulkWindow {
  zones: string;
  curbsideBy: string;
  windowStart: string;
  windowEnd: string;
}

export interface ScheduleFile {
  /** The latest year the file covers. */
  year: number;
  /** The earliest year the file covers, when it holds more than one. Defaults to `year`. */
  startYear?: number;
  community: string;
  township: string;
  website: string;
  source: string;
  regularTrashDay: string;
  setOutHour: number;
  recyclingUrl: string;
  trash: DatedEntry[];
  recycling: DatedEntry[];
  bulk: BulkWindow[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  throw new Error(
    `src/data/schedule.json is not usable: ${message}\n` +
      'Run "npm run check-schedule" for a full report.',
  );
}

function inRange(date: string, data: ScheduleFile): boolean {
  const y = Number(date.slice(0, 4));
  return y >= (data.startYear ?? data.year) && y <= data.year;
}

function yearsLabel(data: ScheduleFile): string {
  const start = data.startYear ?? data.year;
  return start === data.year ? `year ${data.year}` : `years ${start}-${data.year}`;
}

function checkDates(list: DatedEntry[], label: string, data: ScheduleFile) {
  if (!Array.isArray(list) || list.length === 0) fail(`"${label}" is missing or empty`);
  list.forEach((entry, i) => {
    if (!entry || !ISO_DATE.test(entry.date)) {
      fail(`${label}[${i}] needs a date formatted YYYY-MM-DD`);
    }
    if (!inRange(entry.date, data)) {
      fail(`${label}[${i}] (${entry.date}) is not in ${yearsLabel(data)}`);
    }
  });
}

function validate(data: ScheduleFile): ScheduleFile {
  if (typeof data.year !== 'number') fail('"year" must be a number');
  if (data.startYear !== undefined && (typeof data.startYear !== 'number' || data.startYear > data.year)) {
    fail('"startYear" must be a number no later than "year"');
  }
  checkDates(data.trash, 'trash', data);
  checkDates(data.recycling, 'recycling', data);

  if (!Array.isArray(data.bulk) || data.bulk.length === 0) fail('"bulk" is missing or empty');
  data.bulk.forEach((b, i) => {
    for (const field of ['curbsideBy', 'windowStart', 'windowEnd'] as const) {
      if (!ISO_DATE.test(b[field] ?? '')) fail(`bulk[${i}].${field} needs a YYYY-MM-DD date`);
    }
    if (!b.zones) fail(`bulk[${i}].zones is missing`);
    // curbsideBy is the Monday residents may start setting items out.
    const [y, m, d] = b.curbsideBy.split('-').map(Number);
    if (new Date(y, m - 1, d).getDay() !== 1) {
      fail(`bulk[${i}].curbsideBy (${b.curbsideBy}) is not a Monday`);
    }
  });

  return data;
}

export const schedule: ScheduleFile = validate(scheduleJson as ScheduleFile);

/** Every zone label present in the file, e.g. ["1-2", "3-4"]. */
export const availableZones: string[] = Array.from(
  new Set(schedule.bulk.map((b) => b.zones)),
).sort();
