# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## README maintenance

After any code change that affects user-facing behaviour, new capabilities, configuration, architecture, or the embed/deployment workflow, update `README.md` to reflect the change. This includes (but is not limited to): new pages or API endpoints, changes to `appsettings.json` keys, changes to the widget embed contract, new rate-limit or kill-switch behaviour, and changes to the processing pipeline.

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

No test projects exist in this repo.

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
