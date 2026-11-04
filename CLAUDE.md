# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo holds several independent projects that share nothing at build or run time:

| Path | Project | Stack | README |
|---|---|---|---|
| `ChatBotAdmin/`, `ChatBotServer/`, `SampleApplication/` | Mentor Chatbot platform | .NET 9 / .NET 4.8 | `CHATBOT.md` |
| `orchards-at-greentree/` | The Orchards Trash & Recycling phone app | React Native (Expo SDK 57), iOS + Android | `orchards-at-greentree/README.md` |
| `DocBot/` | Doc Chatbot homebrew prototype | Python, Ollama, Chroma | `DocBot/README.md` |
| `docs/` | Static privacy policy and support pages for the phone app's store listings (served by GitHub Pages from `main` `/docs`) | HTML | — |

## README maintenance

The root `README.md` is just an index linking to each project's own README. Keep each project's README current with that project's code:

- **ChatBot**: after any ChatBot code change that affects user-facing behaviour, new capabilities, configuration, architecture, or the embed/deployment workflow, update `CHATBOT.md`. This includes (but is not limited to): new pages or API endpoints, changes to `appsettings.json` keys, changes to the widget embed contract, new rate-limit or kill-switch behaviour, and changes to the processing pipeline.
- **Phone app**: after any change to the app's user-facing behaviour, the `schedule.json` format or validation rules, settings, localization, the release/version process, build configuration, or project layout, update `orchards-at-greentree/README.md`. If a change affects what data the app stores or sends, or how users get support, also update `docs/privacy-policy.html` / `docs/support.html`.

---

# ChatBot platform

## Commands

```bash
# Build
dotnet build ChatBotAdmin/ChatBotAdmin.csproj
dotnet build ChatBotServer/ChatBotServer.csproj

# Run (start Admin first — it owns migrations)
dotnet run --project ChatBotAdmin
dotnet run --project ChatBotServer --urls "http://0.0.0.0:5017"

# EF Core migrations (always run from repo root, always target ChatBotAdmin)
dotnet ef migrations add <Name> --project ChatBotAdmin
dotnet ef migrations remove --project ChatBotAdmin
dotnet ef database update --project ChatBotAdmin
```

No .NET test projects exist in this repo.

## Architecture

### Three projects

| Project | Type | Purpose |
|---|---|---|
| `ChatBotAdmin` | Blazor Server (.NET 9) | Admin UI — upload docs, configure bots, monitor sessions and rate limits |
| `ChatBotServer` | ASP.NET Minimal API (.NET 9) | Public widget backend — handles chat requests, serves `chatbot.js` |
| `SampleApplication` | ASP.NET MVC 5 (.NET 4.8) | Demo site showing the single-script embed pattern |

### Shared SQLite database

Both .NET 9 apps point at the same `.db` file (`ChatBotAdmin/chatbotadmin.db`). **ChatBotAdmin owns all EF migrations**; ChatBotServer calls `db.Database.Migrate()` at startup to apply them. Never add migrations to ChatBotServer.

Both projects have parallel `Models/` and `Data/AppDbContext.cs` files that map to the same tables. When adding a new column, update both models and both `OnModelCreating` configs, then add the migration in ChatBotAdmin only.

### RAG pipeline (document → chat)

1. **Ingest** (`DocumentChatBotService.CreateAsync`): `.docx` uploaded → saved to `Uploads/` → `RunPipelineAsync` fires as a background `Task.Run`
2. **Chunk** (`DocumentChunkerService.Chunk`): OpenXml walks paragraphs in order; headings start new sections; sections are split into ~150-word chunks with 30-word overlap; images are extracted per-paragraph and attached to the chunk whose words came from that paragraph
3. **Embed** (`OllamaService.EmbedAsync`): each chunk text is sent to Ollama (`nomic-embed-text`); the float[] is serialized and stored in `DocumentChunk.Embedding`
4. **Retrieve** (`VectorSearchService.RetrieveAsync`): loads all chunks for a bot, scores by cosine similarity in-process (no vector DB), returns top-k
5. **Answer** (`ChatService.AnswerAsync`): embeds the question, retrieves chunks, builds a system prompt from `bot.Instructions` + `bot.ChatInstructions`, calls Ollama chat model; `[IMAGE: url]` markers in the LLM response are extracted and returned as a separate list

### Widget (`ChatBotServer/wwwroot/chatbot.js`)

Self-contained Shadow DOM widget. Key internals:
- Reads `data-org-id` from its own `<script>` tag at load time
- Calls `/api/info/{botId}` for branding; `/api/history/{botId}/{sessionToken}` to restore prior conversation (sessionToken persisted in `localStorage`)
- Calls `POST /api/chat/{botId}` for each message
- `applyBrandColor(hex)` replaces a hardcoded teal token (`#499CB4`) in all generated inline CSS via regex
- `formatAnswer(text)` is a block-level markdown renderer (tables, blockquotes, lists, headings, bold, italic, inline code)
- HTTP 429 and 503 responses are surfaced as readable chat bubbles, not error alerts

### Rate limiting (`RateLimitService` — singleton in ChatBotServer)

- Sliding window per `"{botId}:{clientIp}"` key; tracks minute / hour / day counts via a `ConcurrentDictionary<string, Queue<long>>`
- Config (RPM, RPH, RPD, `IsEnabled`, `ServiceEnabled`, `UnavailableMessage`) loaded from `RateLimitConfigs` table, cached 60 seconds
- `ServiceEnabled = false` is the kill switch — middleware returns 503 before any rate check
- `RequestLog` rows are written via a `Channel<T>` drain loop every 5 seconds; purged after 7 days
- **DI rule**: ChatBotServer registers only `AddDbContextFactory<AppDbContext>()` (no `AddDbContext`). The factory is singleton; it also implicitly registers a scoped `AppDbContext` for the endpoints. Never re-add `AddDbContext` alongside it — this causes a captive-dependency error at startup.

### Blazor patterns

- `@inject AppInfo AppMeta` is global via `Components/_Imports.razor` — use `@AppMeta.Name` everywhere for the product name; never hardcode "Mentor Chatbot"
- `AppInfo` reads `App:Name` from `appsettings.json`
- `StatusBadge` shared component maps `ProcessingStatus` → CSS pill class (`badge-pill-success`, `badge-pill-danger`, etc.)
- Pages that need interactivity declare `@rendermode InteractiveServer`
- Inside an `else { }` block in Razor, variables are declared as plain C# — no `@{ }` wrapper needed (already in C# context)
- The `/simulate/{botId}` page uses `@layout BlankLayout` (no sidebar/header) and injects the live `chatbot.js` script for testing

### Styling

`wwwroot/app.css` is a full custom design system — do not use raw Bootstrap color utilities for brand colors. Use CSS custom properties defined at `:root`:
- `--brand-primary: #3C6B85`, `--brand-accent: #499DB5`, `--brand-orange: #E27023`
- Alert classes (`alert-success`, etc.) are overridden to solid full-color with white text
- Breadcrumb nav (`article > nav[aria-label="breadcrumb"]`) uses a full-bleed gradient via negative margins on desktop
- Nav icons are CSS `background-image` SVG data URIs with `fill='%23499DB5'`; active items invert to white via `filter: brightness(0) invert(1)`

### File locations

- Uploaded `.docx` files → `ChatBotAdmin/Uploads/` (flat, GUID filename)
- Extracted images → `ChatBotAdmin/Uploads/images/{botId}/`
- Bot icon → `ChatBotAdmin/Uploads/images/{botId}/icon{ext}` (always same name, re-upload replaces)
- Both apps serve `/uploads/*` pointing at this same directory

---

# Orchards phone app (`orchards-at-greentree/`)

Trash, recycling and bulk-pickup calendar with local reminders for the Orchards at Greentree community (Evesham Township, NJ). One Expo/React Native TypeScript codebase builds both the iOS and Android apps. Store name is **The Orchards Trash & Recycling**; bundle ID / package is `com.theorchardstrashrecycling`. The app is deliberately *not* branded as an official HOA app: don't put the HOA name back into the store name or the package ID. The in-app header still shows the community name, read from `schedule.json`.

## Commands

Run all of these from `orchards-at-greentree/`:

```bash
npm install
npm start                    # Expo dev server + QR code (Expo Go)
npm run android / npm run ios  # dev build on a device or simulator (expo run:*)
npm run typecheck            # tsc --noEmit
npm run check-schedule       # validate src/data/schedule.json (exits non-zero on errors)
npm run fix-deps             # expo install --fix: realign deps to the SDK
npx expo-doctor              # config/dependency health check; keep it at all checks passed

eas build --platform all --profile production   # store builds (.aab / iOS store)
eas build --platform android --profile apk      # sideloadable test APK
eas submit --platform all                       # uses submit.production (ascAppId set for iOS)
```

There's no test runner. Verify changes with `npm run typecheck` and, if the schedule data or its rules changed, `npm run check-schedule`. Run `npx expo-doctor` after changing dependencies or `app.json`.

Scheduled notifications don't reliably fire in Expo Go. Test reminders in a dev build (`npx expo run:android`, or `eas build --profile development` for iOS).

## Architecture

- **Entry**: `index.js` → `App.tsx` (`SafeAreaProvider` → `LocaleProvider` → `ErrorBoundary` → `HomeScreen`). The error boundary shows a readable "schedule could not be loaded" screen when `schedule.json` is invalid.
- **Data**: `src/data/schedule.json` is the only year-specific file. `src/data/index.ts` imports it, validates it at import time (and throws on bad data), and exports the typed `ScheduleFile`. `src/data/schedule.schema.json` gives editor validation (wired up in `.vscode/settings.json`). `scripts/validate-schedule.js` is a standalone Node validator with stricter checks: duplicates, gaps in the weekly trash run, window ordering, and missing `noteEs` (a warning only). **If you change the schedule format, update all three**: the TS types/validator, the JSON schema, and the Node script.
- **Events**: `src/lib/schedule.ts` `buildEvents(zone, locale)` turns the JSON into `CollectionEvent`s (`kind`: `trash | recycling | bulk`). Each event has a `markerDate` (the day shown on the calendar) and an `anchorDate` (the day reminders count back from). For bulk, both are `curbsideBy`, the Monday residents may start putting items out, not the day crews arrive.
- **Dates**: always use `parseISO` / `toISO` / `addDays` / `todayISO` from `src/lib/dates.ts`. `new Date("YYYY-MM-DD")` parses as UTC and shows the previous day in New Jersey. Dates are passed around as ISO `YYYY-MM-DD` strings and compared as strings.
- **"Today"**: `HomeScreen` keeps `today` in state and refreshes it when `AppState` returns to `active`. Pass that value down (to `Calendar` and to `upcoming` / `nextOfEachKind`); don't call `todayISO()` inside render or memos. Doing that caused the stale-highlight bug when the app stayed open past midnight.
- **Notifications** (`src/lib/notifications.ts`): `rescheduleAll` cancels everything and rebuilds the queue on every app open and every settings change. It schedules only the soonest 60 reminders (iOS caps an app at 64 pending), at noon local (`REMINDER_HOUR`), N days before `anchorDate`. Android uses the `collections` channel. Triggers are regular `DATE` triggers. **Don't add `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`**: they were removed on purpose because Google Play restricts them, and noon reminders don't need exact timing.
- **Settings** (`src/lib/settings.ts`): stored in AsyncStorage under `orchards.settings.v1`. Reminders are on by default, with a lead time of 1 day per kind (allowed range 0–14). The zone is fixed at `3-4`: only the Orchards' bulk zone is in the data, and Settings shows it as a read-only About row. If you add a settings field, merge it with defaults in `loadSettings` so older saved settings still load. Bump the key only for a breaking shape change.
- **Localization** (`src/i18n/`): English and Spanish. `translations.ts` has parallel `en` / `es` objects typed against one `Strings` interface, so a key missing from either language fails `typecheck`. Components get strings from `useLocale().t`. Non-React code such as `notifications.ts` reads `translations[locale]` directly, with `locale` passed in by the caller. Notification text must be localized too. Holiday notes in `schedule.json` come as `note` / `noteEs` pairs. The language override (System / English / Español) is saved separately from the other settings.
- **UI**: `screens/HomeScreen.tsx` composes `Header`, `Calendar` (swipeable month grid), `UpcomingList`, and `EventModal`, and drives rescheduling. `SettingsScreen.tsx` holds the reminder, language and About settings. All icons are SVG components in `src/icons/index.tsx` (`react-native-svg`). Colors, spacing and typography come from `src/theme.ts`; use those tokens rather than adding new literal colors. The brand teal is `#527F7A`.

## Config and release gotchas

- `android/` and `ios/` are gitignored and generated by `expo prebuild` / `expo run:*` (Continuous Native Generation). Make native changes through `app.json` and config plugins, never by editing the generated folders.
- **Dependencies**: use `npx expo install <pkg>` or `npm run fix-deps` so versions match SDK 57. Don't hand-bump Expo packages, and don't list a package in both `dependencies` and `devDependencies` (a duplicate `typescript` entry once broke expo-doctor).
- **`app.json`**: keep it valid against the current schema. `newArchEnabled` and `android.edgeToEdgeEnabled` are gone (both are mandatory now), and splash screen config belongs in the `expo-splash-screen` plugin, not a top-level `splash` key.
- **Settings to leave alone**:
  - `ios.supportsTablet: false`: the app is iPhone-only.
  - `ITSAppUsesNonExemptEncryption: false`: the export compliance declaration.
  - R8 minify/shrink via `expo-build-properties`: Google Play requires it from Feb 2027.
  - `promptToConfigurePushNotifications: false` in `eas.json`.
  - `appVersionSource: "remote"` with `autoIncrement`: EAS manages build numbers.
- If a release build crashes and a dev build doesn't, suspect R8 first: check `android/app/build/outputs/mapping/release/mapping.txt`, and add keep rules through `expo-build-properties`.
- **Yearly update**:
  1. Replace `schedule.json`.
  2. Run `npm run check-schedule`.
  3. Bump `expo.version` in `app.json` (`YYYY.N.0`). iOS `buildNumber` and Android `versionCode` are handled by EAS remote versioning.
  4. `eas build` + `eas submit`.

  The app README has the full walkthrough.
- **Secrets**: never commit signing credentials (`credentials.json`, `credentials/`, `*.jks`). They're gitignored.
