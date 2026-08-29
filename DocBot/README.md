# Doc Chatbot — Homebrew Prototype

Converts a Word document (with embedded screenshots) into a locally-hosted
RAG chatbot, with versioning built in. Runs entirely on your machine —
no AWS/Google account needed for this phase.

## What's here

| File | Purpose |
|---|---|
| `chunk_docx.py` | Extracts text + screenshots directly from a `.docx`, no HTML step |
| `build_index.py` | Embeds chunks (via Ollama) into a versioned Chroma vector store |
| `chatbot.py` | Core RAG logic: retrieve relevant chunks, ask a local model to answer |
| `run_tests.py` | Regression checks against a small set of sample Q&A |
| `server.py` | Minimal local API + serves screenshots to the widget |
| `widget.html` | Standalone preview of the embeddable chat widget |
| `sample_docs/` | A test `.docx` with an embedded screenshot, so you can see it work immediately |
| `test_questions.json` | Sample questions/expected keywords for `run_tests.py` |

## One-time setup

```bash
pip install -r requirements.txt

# Chat models -- you already have these:
#   qwen3:8b          (fast, used by default for Q&A)
#   qwen3-coder:30b    (swap in later for action-chaining / tool use)

# Embedding model -- you'll need to pull this one:
ollama pull nomic-embed-text
```

## Running the pipeline

```bash
# 1. Extract text + screenshots from your Word doc
python chunk_docx.py --docx sample_docs/getting-started.docx --out chunks.json --version v1.0

# 2. Embed and index (creates a Chroma collection named docs_v1.0)
python build_index.py --chunks chunks.json --version v1.0

# 3. Ask it something from the command line
python chatbot.py --version v1.0 --question "How do I create an order?"

# 4. Run the regression tests
python run_tests.py --version v1.0

# 5. Start the local API
python server.py

# 6. Open widget.html in a browser to try the chat UI (talks to step 5's server)
```

## Versioning a new release

When a new product version's docs are ready, just repeat steps 1–2 with a
new `--version` label, e.g. `v1.1`. Nothing about `v1.0`'s collection is
touched — old and new versions coexist in the same `chroma_store/` folder.
Point the widget's `DOC_VERSION` (or a page-level config, in the real
front end) at whichever version that page of your site should use.

## Notes on the docx → chunk pipeline

- Every `.docx` gets round-tripped through LibreOffice before parsing.
  This is a reliability step: Word files saved by different tools/exporters
  sometimes have inconsistent style linkage that trips up the reader
  otherwise. It's cheap, so it always runs.
- Screenshots are extracted as real image files (not embedded as base64)
  and associated with whichever paragraph they appeared next to in the
  source doc. They're returned alongside the answer whenever the chunk
  they belong to is one of the retrieved matches.
- Legacy vector formats (`.emf`/`.wmf`, common in older Office docs) are
  auto-converted to PNG so they render in a browser.

## What's intentionally deferred

- **Action-chaining / role-based permissions**: the current bot only
  answers questions grounded in the docs. Once this retrieval loop is
  solid, `qwen3-coder:30b` is the better model to build the tool-calling
  layer on top of `chatbot.py`.
- **Persistent session logging**: `server.py` logs to memory only right
  now (`/log` endpoint). Swap in SQLite before this leaves your machine.
- **Real hosting**: this whole pipeline maps cleanly onto AWS/Google when
  you're ready — Chroma's storage becomes S3/GCS, the local model calls
  become Bedrock/Vertex, and `server.py` becomes a Lambda or Cloud Run
  service. Nothing here is throwaway.
