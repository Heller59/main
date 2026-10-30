# Mentor Chatbot

A self-hosted, document-grounded AI chatbot platform built on .NET 9 and Ollama.
Upload a Word document, and within minutes you have an embeddable chat widget that answers questions using only the content of that document — no hallucination from general knowledge.

---

## Projects

### `ChatBotAdmin` — Administration Portal
**ASP.NET Blazor Server (.NET 9)**

The management UI used by administrators to create, configure, and monitor chatbots.

**Key capabilities:**
- **Upload & process** Word documents (`.docx`) — text and images are extracted, chunked, and embedded automatically
- **Configure** each chatbot's greeting, document context notes, and chat instructions (system prompt)
- **Brand** each widget with a custom icon and hex color
- **Review** extracted document text and images before going live
- **Monitor chat sessions** — view conversation history per session with user details
- **Rate Limits & Usage** page — live 24-hour bar chart, per-bot activity breakdown, global and per-bot rate-limit config, and a **kill switch** that blocks all widget traffic within 60 seconds without a server restart
- **Dashboard** — at-a-glance totals with an inline service-online/offline status indicator
- **Simulator** — one-click button on each chatbot's detail page opens a clean browser tab with the live widget loaded, so admins can test a bot without embedding it anywhere

**Stack:** Blazor Server · EF Core 9 · SQLite · Bootstrap 5 · Inter font

---

### `ChatBotServer` — Widget API Server
**ASP.NET Minimal API (.NET 9)**

The lightweight backend the embedded widget talks to. Designed to be publicly accessible (CORS open to any origin) while the Admin portal stays on an internal network.

**Key capabilities:**
- `POST /api/chat/{botId}` — receives a question, runs vector search over the document chunks, calls the Ollama LLM with retrieved context, and streams back an answer with any relevant image references
- `GET /api/history/{botId}/{sessionToken}` — restores the last 30 messages so the widget survives page reloads
- `GET /api/info/{botId}` — lightweight check used by the widget on load (branding, greeting, status)
- Serves `chatbot.js` (the embeddable Shadow DOM widget) as a static file
- **Rate limiting** — per-IP per-bot sliding windows (minute / hour / day) enforced in middleware; config hot-reloads from the shared database every 60 seconds
- **Kill switch** — when activated in ChatBotAdmin, all chat requests return HTTP 503 with a configurable message; widget surfaces this as a readable chat bubble
- **Request logging** — every request (allowed or throttled) is persisted asynchronously; logs older than 7 days are auto-purged

**Stack:** ASP.NET Minimal API · EF Core 9 · SQLite (shared with Admin) · Ollama HTTP client

---

### `SampleApplication` — Embedding Demo
**ASP.NET MVC 5 (.NET Framework 4.8)**

A minimal host application showing how to embed the chatbot widget into any existing web page with a single script tag:

```html
<script src="https://<chatbot-server>/chatbot.js"
        data-org-id="<your-bot-id>"
        defer></script>
```

No framework dependency — the widget is a self-contained Shadow DOM component that works in any HTML page.

---

## How it works

```
┌─────────────────┐        ┌──────────────────────┐
│  Any Website    │  POST  │                      │
│  (widget embed) │───────▶│   ChatBotServer      │
│                 │        │   :5017              │
└─────────────────┘        │                      │
                           │  Rate Limiter        │
                           │  Kill Switch         │
                           │  Vector Search       │
                           │        │             │
                           │        ▼             │
                           │   Ollama (local LLM) │
                           └──────────┬───────────┘
                                      │ shared SQLite DB
                           ┌──────────▼───────────┐
                           │   ChatBotAdmin       │
                           │   (internal only)    │
                           │                      │
                           │  Upload Docs         │
                           │  Configure Bots      │
                           │  Monitor Sessions    │
                           │  Rate Limit Control  │
                           └──────────────────────┘
```

1. Admin uploads a `.docx` — ChatBotAdmin extracts text and images, splits into chunks, and generates vector embeddings via Ollama (`nomic-embed-text`)
2. Widget user asks a question — ChatBotServer embeds the question, finds the most relevant chunks, builds a prompt, and calls the Ollama chat model (`qwen3.8`)
3. The answer (with optional image references) is returned to the widget and rendered as formatted markdown

---

## Configuration

### `ChatBotServer/appsettings.json`
| Key | Description |
|-----|-------------|
| `ChatBotServer:DbPath` | Absolute path to the shared SQLite database file |
| `ChatBotServer:UploadsPath` | Absolute path to the Uploads folder (serves extracted images) |
| `Ollama:BaseUrl` | Ollama server URL (e.g. `http://192.168.1.209:11434`) |
| `Ollama:EmbedModel` | Embedding model name (default: `nomic-embed-text`) |
| `Ollama:ChatModel` | Chat model name (default: `qwen3.8:latest`) |

### `ChatBotAdmin/appsettings.json`
| Key | Description |
|-----|-------------|
| `App:Name` | Product name shown throughout the UI (default: `Mentor Chatbot`) |
| `ChatBotServer:BaseUrl` | Public URL of ChatBotServer — used by the Simulator page to inject the widget script tag |
| `Widget:DefaultBrandColor` | Default hex color for new chatbot widgets |
| `Ollama:BaseUrl` | Ollama server URL (used during document processing) |

---

## Running locally

```bash
# Terminal 1 — Admin portal
dotnet run --project ChatBotAdmin

# Terminal 2 — Widget API server
dotnet run --project ChatBotServer --urls "http://0.0.0.0:5017"
```

The database and migrations are managed by ChatBotAdmin. ChatBotServer applies any pending migrations automatically on startup, so ChatBotAdmin should be started (or migrated) before ChatBotServer on a fresh database.

### Prerequisites
- [.NET 9 SDK](https://dotnet.microsoft.com/download)
- [Ollama](https://ollama.ai) running locally or on the network with `nomic-embed-text` and a chat model pulled
- No other external dependencies — SQLite is file-based and bundled

---

## Embedding the widget

Add one script tag to any HTML page. The widget loads asynchronously, renders into a Shadow DOM bubble, and does not interfere with the host page's styles or scripts.

```html
<script
  src="https://<your-chatbot-server>/chatbot.js"
  data-org-id="<bot-id-from-admin>"
  defer>
</script>
```

The bot ID is shown on each chatbot's detail page in ChatBotAdmin.
