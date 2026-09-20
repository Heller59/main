import { availableZones, schedule as raw } from '../data';
import { addDays, fmtLong, fmtShort, parseISO, toISO, todayISO } from './dates';

export type EventKind = 'trash' | 'recycling' | 'bulk';
/** Zone labels come from the JSON, so a new year can rename or add them. */
export type Zone = string;

export interface CollectionEvent {
  id: string;
  kind: EventKind;
  /** The day the icon sits on in the calendar grid. */
  markerDate: string;
  /** The day reminders count backwards from. */
  anchorDate: string;
  title: string;
  /** The single line of instruction: what to do and when. */
  note: string;
  /** Secondary line — holiday shifts, collection windows. */
  detail?: string;
}

export const KIND_LABEL: Record<EventKind, string> = {
  trash: 'Trash Collection',
  recycling: 'Recycling Collection',
  bulk: 'Bulk Collection',
};

export const ALL_KINDS: EventKind[] = ['trash', 'recycling', 'bulk'];

const KIND_ORDER: Record<EventKind, number> = { trash: 0, recycling: 1, bulk: 2 };

export const scheduleMeta = {
  year: raw.year,
  community: raw.community,
  township: raw.township,
  website: raw.website,
  source: raw.source,
  regularTrashDay: raw.regularTrashDay,
  setOutHour: raw.setOutHour,
  recyclingHotline: raw.recyclingHotline,
  zones: availableZones,
};

export function zoneLabel(zone: Zone): string {
  return zone.includes('-') ? `Zones ${zone.replace('-', ' & ')}` : `Zone ${zone}`;
}

/**
 * Trash and recycling both go out the evening before pickup, after 6 PM.
 * Bulk works differently: the township wants items curbside by 6 AM on the
 * Monday of the collection week, and crews work through that week.
 */
export function buildEvents(zone: Zone): CollectionEvent[] {
  const events: CollectionEvent[] = [];

  for (const e of raw.trash) {
    const evening = toISO(addDays(parseISO(e.date), -1));
    events.push({
      id: `trash-${e.date}`,
      kind: 'trash',
      markerDate: e.date,
      anchorDate: e.date,
      title: KIND_LABEL.trash,
      note: `Put out bins after 6 PM on ${fmtLong(evening)}.`,
      detail: e.note,
    });
  }

  for (const e of raw.recycling) {
    const evening = toISO(addDays(parseISO(e.date), -1));
    events.push({
      id: `recycling-${e.date}`,
      kind: 'recycling',
      markerDate: e.date,
      anchorDate: e.date,
      title: KIND_LABEL.recycling,
      note: `Put out bins after 6 PM on ${fmtLong(evening)}.`,
      detail: e.note,
    });
  }

  for (const b of raw.bulk) {
    if (b.zones !== zone) continue;
    events.push({
      id: `bulk-${b.curbsideBy}`,
      kind: 'bulk',
      markerDate: b.curbsideBy,
      anchorDate: b.curbsideBy,
      title: KIND_LABEL.bulk,
      note: `Put out bulk items starting ${fmtLong(b.curbsideBy)}.`,
      detail: `Curbside by 6 AM. Crews collect ${fmtShort(b.windowStart)} through ${fmtShort(
        b.windowEnd,
      )}.`,
    });
  }

  events.sort((a, b) => {
    if (a.markerDate !== b.markerDate) return a.markerDate < b.markerDate ? -1 : 1;
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });

  return events;
}

/** markerDate -> events on that day, for fast calendar lookups. */
export function indexByDate(events: CollectionEvent[]): Map<string, CollectionEvent[]> {
  const map = new Map<string, CollectionEvent[]>();
  for (const e of events) {
    const list = map.get(e.markerDate);
    if (list) list.push(e);
    else map.set(e.markerDate, [e]);
  }
  return map;
}

/** Everything from today onward, in order. */
export function upcoming(events: CollectionEvent[]): CollectionEvent[] {
  const t = todayISO();
  return events.filter((e) => e.markerDate >= t);
}

/** The single next event of each kind. */
export function nextOfEachKind(events: CollectionEvent[]): CollectionEvent[] {
  const ahead = upcoming(events);
  const out: CollectionEvent[] = [];
  for (const kind of ALL_KINDS) {
    const hit = ahead.find((e) => e.kind === kind);
    if (hit) out.push(hit);
  }
  return out;
}

/** Months the schedule spans, as {year, month} — drives the calendar pager. */
export function scheduleMonths(events: CollectionEvent[]): { year: number; month: number }[] {
  if (events.length === 0) return [];
  const first = parseISO(events[0].markerDate);
  const last = parseISO(events[events.length - 1].markerDate);
  const out: { year: number; month: number }[] = [];
  const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  while (
    cursor.getFullYear() < last.getFullYear() ||
    (cursor.getFullYear() === last.getFullYear() && cursor.getMonth() <= last.getMonth())
  ) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** Index of the month to open on: today's month, or the nearest one in range. */
export function initialMonthIndex(months: { year: number; month: number }[]): number {
  if (months.length === 0) return 0;
  const now = new Date();
  const key = now.getFullYear() * 12 + now.getMonth();
  let best = 0;
  let bestDist = Infinity;
  months.forEach((m, i) => {
    const dist = Math.abs(m.year * 12 + m.month - key);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}
