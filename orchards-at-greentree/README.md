# Orchards at Greentree

Trash, recycling and bulk collection calendar with reminders, for the Orchards at
Greentree HOA in Marlton, NJ. One React Native codebase, shipped as both an iOS app
and an Android app.

---

## Why one codebase instead of two

Expo builds a genuine native iOS app **and** a genuine native Android app from this
single project — two separate store listings, two separate binaries, one set of
source files. The alternative (SwiftUI for iOS, Kotlin for Android) would mean
writing the calendar, the schedule logic and the notification scheduling twice, and
the iOS half could not be built on Windows at all, since Xcode is macOS-only.

Practically, that means your yearly update is one JSON edit instead of two.

---

## Getting set up

Unzip into `C:\Git\Repos\main\` so you end up with:

```
C:\Git\Repos\main\orchards-at-greentree\
```

Then, in a terminal:

```bash
cd C:\Git\Repos\main\orchards-at-greentree
npm install
code .          # open in VSCode
npm start       # start the dev server
```

`npm start` prints a QR code. Scan it with the Expo Go app on your phone and the
calendar loads over your local network.

VSCode will prompt to install the recommended extensions (Expo Tools, ESLint,
Prettier) on first open. `F5` runs the dev server through the debugger.

### Testing notifications

The calendar, the day pop-ups and the schedule list all work in Expo Go. **Scheduled
notifications do not reliably fire in Expo Go** — Expo has been pulling notification
support out of it over recent SDKs. To test reminders properly, make a development
build:

```bash
npx expo run:android      # needs Android Studio + a device or emulator
```

For iOS you need a Mac, or EAS Build in the cloud:

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile development
```

Inside the app, **Settings → Send a test** fires a sample banner five seconds later,
which is the quickest way to confirm permissions and the Android channel are wired up.

---

## The yearly update

This is the whole job. When the township publishes next year's schedule:

### 1. Replace one file

Overwrite `src/data/schedule.json`. Nothing else in the codebase references a
specific year — the year, the community name, the zones and every date are read
from this file.

### 2. Check it

```bash
npm run check-schedule
```

This validates the file without needing the app to run. It catches malformed dates,
dates in the wrong year, duplicates, bulk `curbsideBy` values that aren't Mondays,
windows that end before they start, and gaps in the weekly trash run. It exits
non-zero on any error, so you can gate a release on it.

```
Zones found: 3-4

Orchards at Greentree 2027: 52 trash, 26 recycling, 4 bulk windows

Schedule looks good. Safe to ship.
```

If the file is broken and you ship anyway, the app shows a plain-language error
screen naming the problem rather than a white screen.

### 3. Bump the version and ship

In `app.json`, raise three numbers — the stores reject a rebuild otherwise:

```jsonc
"version": "2027.1.0",        // both platforms
"ios":     { "buildNumber": "2" },
"android": { "versionCode": 2 }
```

```bash
eas build --platform all --profile production
eas submit --platform all
```

---

## The schedule file

```jsonc
{
  "year": 2026,
  "community": "Orchards at Greentree",
  "township": "Evesham Township, NJ",
  "website": "https://www.orchardsatgreentree.com/",
  "source": "Evesham Township 2026 Holiday Trash, Recycling & Bulk Collection Schedules",
  "regularTrashDay": "Thursday",
  "setOutHour": 18,
  "recyclingHotline": "609-267-6889",

  // Every pickup date, already adjusted for holiday shifts.
  // Add a "note" on any date that moved, and it shows in the app.
  "trash": [
    { "date": "2026-01-08" },
    { "date": "2026-01-23", "note": "Moved to Friday for Martin Luther King Jr. Day" }
  ],

  "recycling": [
    { "date": "2026-01-09" },
    { "date": "2026-05-30", "note": "Saturday pickup (Memorial Day week)" }
  ],

  // curbsideBy is the Monday residents may start putting items out (6 AM).
  // windowStart/windowEnd is when crews actually work the zone.
  "bulk": [
    { "zones": "3-4", "curbsideBy": "2026-10-12",
      "windowStart": "2026-10-13", "windowEnd": "2026-10-16" }
  ]
}
```

A few things worth knowing:

- **Trash dates are absolute, not computed.** The township's holiday table shifts the
  Thursday route to Friday (and once to Saturday, for Thanksgiving). Rather than
  encode holiday rules, every one of the 53 dates is listed outright. Nothing to
  re-derive, nothing to get subtly wrong.
- **`curbsideBy` must be a Monday.** The township's rule is "curbside by 6 AM on the
  Monday of the designated week," which is not always the first collection day — in
  October 2026, Zones 3 & 4 are collected Tue 13th–Fri 16th, but items go out Monday
  the 12th. The bulk reminder counts back from `curbsideBy`, so it lands correctly.
- **Both zone schedules are included.** Residents pick theirs in Settings. The
  Orchards is in Zones 3 & 4, which is the default.

---

## How the app behaves

**Calendar** — opens on the current month. Swipe or use the arrows to move through
every month in the schedule. Days with collections show their icons: black trash can,
blue recycling arrows, brown couch for bulk. Tapping a day with events opens a
detail sheet; tapping an empty day does nothing.

**Below the calendar** — "Coming up next" shows the next trash, next recycling and
next bulk pickup, then the full remaining schedule runs month by month to the end of
the year.

**Reminders** — off until the user turns them on. Default is one day before, at noon.
Each collection type has its own lead time, adjustable 0–14 days. Bulk counts back
from the Monday you may start setting items out, not from when crews arrive, so the
default puts the reminder on Sunday.

iOS caps an app at 64 pending local notifications, so the app schedules the soonest
60 and rebuilds the queue every time it opens or a setting changes.

---

## Project layout

```
App.tsx                      root, safe-area provider, error boundary
index.js                     Expo entry point
app.json                     name, icons, permissions, store version
scripts/validate-schedule.js the pre-ship data check

src/
  data/
    schedule.json            >>> the file you replace each year <<<
    index.ts                 loads and validates it at startup
  lib/
    dates.ts                 timezone-safe date handling
    schedule.ts              turns JSON into calendar events
    notifications.ts         permissions and local scheduling
    settings.ts              persisted user preferences
    useSafeArea.ts
  icons/index.tsx            all SVG icons, including the three markers
  components/
    Calendar.tsx             swipeable month grid
    EventModal.tsx           day detail pop-up
    UpcomingList.tsx         next-up cards + full schedule
    Header.tsx
  screens/
    HomeScreen.tsx           composes everything, drives scheduling
    SettingsScreen.tsx
  theme.ts                   colors sampled from orchardsatgreentree.com
```

### A note on dates

`new Date("2026-10-12")` parses as **UTC** midnight, which in New Jersey renders as
October 11th. Every date in this app goes through `parseISO()` in `src/lib/dates.ts`,
which splits the string and builds a local date. If you add date handling, use those
helpers rather than the `Date` constructor.

---

## Useful commands

| Command | What it does |
| --- | --- |
| `npm start` | Dev server + QR code |
| `npm run android` / `npm run ios` | Launch on a connected device or simulator |
| `npm run check-schedule` | Validate `schedule.json` before shipping |
| `npm run typecheck` | Full TypeScript check |
| `npm run fix-deps` | Realign package versions with the Expo SDK |

---

Schedule data transcribed from the Evesham Township 2026 Holiday Trash, Recycling &
Bulk Collection Schedules. The township's published schedule is authoritative if the
two ever disagree.
