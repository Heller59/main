#!/usr/bin/env node
/**
 * Validates src/data/schedule.json before you ship a new year.
 *
 *   npm run check-schedule
 *
 * Exits non-zero on any error, so it can gate a release. Warnings are printed
 * but do not fail the run — they are things worth a second look, not defects.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'data', 'schedule.json');
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function readFile() {
  if (!fs.existsSync(FILE)) {
    console.error(`Not found: ${FILE}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    console.error(`schedule.json is not valid JSON: ${e.message}`);
    process.exit(1);
  }
}

function checkList(data, key) {
  const list = data[key];
  if (!Array.isArray(list) || list.length === 0) {
    err(`"${key}" must be a non-empty array`);
    return [];
  }
  const seen = new Set();
  list.forEach((entry, i) => {
    if (!entry || typeof entry.date !== 'string' || !ISO.test(entry.date)) {
      err(`${key}[${i}]: "date" must look like 2027-01-08`);
      return;
    }
    const d = parseISO(entry.date);
    if (Number.isNaN(d.getTime())) err(`${key}[${i}]: ${entry.date} is not a real date`);
    if (Number(entry.date.slice(0, 4)) !== data.year) {
      err(`${key}[${i}]: ${entry.date} is not in year ${data.year}`);
    }
    if (seen.has(entry.date)) err(`${key}: ${entry.date} appears more than once`);
    seen.add(entry.date);
  });

  const sorted = list.map((e) => e.date).slice().sort();
  if (JSON.stringify(sorted) !== JSON.stringify(list.map((e) => e.date))) {
    warn(`"${key}" is not in chronological order (the app sorts it anyway)`);
  }
  return list;
}

const data = readFile();

for (const field of ['year', 'community', 'township', 'regularTrashDay']) {
  if (data[field] === undefined || data[field] === '') err(`"${field}" is required`);
}
if (typeof data.year !== 'number') err('"year" must be a number, not a string');

const trash = checkList(data, 'trash');
const recycling = checkList(data, 'recycling');

// Weekly trash: flag any gap that is not 7 days, which usually means a missed week.
for (let i = 1; i < trash.length; i++) {
  if (!ISO.test(trash[i].date) || !ISO.test(trash[i - 1].date)) continue;
  const gap = Math.round((parseISO(trash[i].date) - parseISO(trash[i - 1].date)) / 86400000);
  if (gap < 4 || gap > 10) {
    warn(`trash: ${trash[i - 1].date} to ${trash[i].date} is a ${gap}-day gap — is a week missing?`);
  }
}

// Every trash date should be the regular day, or carry a note explaining the shift.
const regularIdx = DAY.indexOf(data.regularTrashDay);
if (regularIdx === -1) {
  err(`"regularTrashDay" must be a weekday name, got "${data.regularTrashDay}"`);
} else {
  trash.forEach((e, i) => {
    if (!ISO.test(e.date)) return;
    const wd = parseISO(e.date).getDay();
    if (wd !== regularIdx && !e.note) {
      warn(`trash[${i}] ${e.date} falls on ${DAY[wd]}, not ${data.regularTrashDay}, and has no note`);
    }
  });
}

// Bulk windows
if (!Array.isArray(data.bulk) || data.bulk.length === 0) {
  err('"bulk" must be a non-empty array');
} else {
  data.bulk.forEach((b, i) => {
    if (!b.zones) err(`bulk[${i}]: "zones" is required (for example "3-4")`);
    for (const f of ['curbsideBy', 'windowStart', 'windowEnd']) {
      if (!ISO.test(b[f] || '')) {
        err(`bulk[${i}]: "${f}" must look like 2027-10-11`);
        return;
      }
    }
    const cb = parseISO(b.curbsideBy);
    if (cb.getDay() !== 1) {
      err(`bulk[${i}]: curbsideBy ${b.curbsideBy} is a ${DAY[cb.getDay()]}, must be a Monday`);
    }
    if (b.windowEnd < b.windowStart) {
      err(`bulk[${i}]: windowEnd ${b.windowEnd} is before windowStart ${b.windowStart}`);
    }
    if (b.windowStart < b.curbsideBy) {
      err(`bulk[${i}]: windowStart ${b.windowStart} is before curbsideBy ${b.curbsideBy}`);
    }
    if (Number(b.curbsideBy.slice(0, 4)) !== data.year) {
      err(`bulk[${i}]: ${b.curbsideBy} is not in year ${data.year}`);
    }
  });

  const zones = [...new Set(data.bulk.map((b) => b.zones))];
  zones.forEach((z) => {
    const n = data.bulk.filter((b) => b.zones === z).length;
    if (n !== 4) warn(`zone ${z} has ${n} bulk windows — the township normally runs 4 per year`);
  });
  console.log(`Zones found: ${zones.join(', ')}`);
}

// Report
console.log(
  `\n${data.community || 'schedule'} ${data.year}: ` +
    `${trash.length} trash, ${recycling.length} recycling, ` +
    `${(data.bulk || []).length} bulk windows`,
);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log(`  ! ${w}`));
}

if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.log(`  x ${e}`));
  console.log('\nFix these before shipping.');
  process.exit(1);
}

console.log('\nSchedule looks good. Safe to ship.');
