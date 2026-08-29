"""
server.py

Minimal local API. The lightweight front-end widget (widget.html) POSTs
here with a version, question, and role. This is the piece that would
eventually move to a real host (Lambda, Cloud Run, a small VM, etc.) --
for now it just runs on your machine.

Usage:
    python server.py
    # then POST to http://localhost:5000/chat
"""
from flask import Flask, request, jsonify, send_from_directory

from chatbot import answer_question

app = Flask(__name__)
MEDIA_ROOT = "media"  # matches --media-dir in chunk_docx.py

# In-memory session log for the homebrew phase.
# Swap this for a real SQLite/DB write when you're ready to persist across restarts.
SESSION_LOG = []


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    question = data.get("question", "")
    version = data.get("version", "v1.0")
    role = data.get("role", "user")

    if not question:
        return jsonify({"error": "question is required"}), 400

    answer, sources, images = answer_question(question, version, role)

    # images are stored as paths like "media/v1.0/media/image1.png" -- turn
    # them into URLs the widget can load directly
    image_urls = [f"/{path}" for path in images]

    SESSION_LOG.append({
        "question": question,
        "answer": answer,
        "version": version,
        "role": role,
        "sources": sources,
        "images": image_urls,
    })

    return jsonify({"answer": answer, "sources": sources, "images": image_urls})


@app.route("/media/<path:filepath>")
def serve_media(filepath):
    """Serves extracted screenshots so the widget can render them inline."""
    return send_from_directory(MEDIA_ROOT, filepath)


@app.route("/log", methods=["GET"])
def log():
    """Quick way to eyeball the session log during dev. Remove/protect before real deploy."""
    return jsonify(SESSION_LOG)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
