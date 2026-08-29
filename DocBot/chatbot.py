"""
chatbot.py

Core RAG logic. Given a user question, a doc version, and an optional role,
retrieves the most relevant chunks from that version's Chroma collection and
asks a local Ollama chat model to answer using only that context.

This is the piece you'll extend later for action-chaining: for now it only
answers questions grounded in the docs, it doesn't take actions.

Usage (CLI test):
    python chatbot.py --version v1.0 --question "How do I create an order?"
"""
import argparse

import chromadb
import ollama

from build_index import embed, STORE_DIR

CHAT_MODEL = "qwen3.8:latest"       # fast, good for general Q&A
# CHAT_MODEL = "qwen3-coder:30b"  # swap in later for action-chaining / tool use

SYSTEM_PROMPT = """You are a support assistant for our product documentation.

Rules:
- Answer ONLY using the CONTEXT provided below. Do not use outside knowledge.
- If the context doesn't contain the answer, say you don't know and suggest
  the user contact support -- do not guess.
- Keep answers concise and reference the relevant doc section by heading
  when helpful.
- If the user's question implies an action that requires a specific role
  or permission (mentioned in the context), tell them what role is needed.
"""


def retrieve(question: str, version: str, top_k: int = 4):
    client = chromadb.PersistentClient(path=STORE_DIR)
    collection = client.get_collection(f"docs_{version}")
    query_embedding = embed(question)
    results = collection.query(query_embeddings=[query_embedding], n_results=top_k)
    return results["documents"][0], results["metadatas"][0]


def answer_question(question: str, version: str, role: str = "user", top_k: int = 4):
    docs, metas = retrieve(question, version, top_k)

    if not docs:
        return "I couldn't find anything in the docs for that version to answer this.", [], []

    context = "\n\n---\n\n".join(docs)
    user_role_note = f"\n\nThe user's role is: {role}." if role else ""

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"CONTEXT:\n{context}{user_role_note}\n\nQUESTION: {question}"},
    ]

    response = ollama.chat(model=CHAT_MODEL, messages=messages)
    answer = response["message"]["content"]

    sources = [f"{m['source_file']} ({m['heading']})" for m in metas]

    # Pull images only from the chunks that actually matched, dedup while preserving order
    images = []
    for m in metas:
        for path in m.get("images", "").split("|"):
            if path and path not in images:
                images.append(path)

    return answer, sources, images


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--question", required=True)
    parser.add_argument("--role", default="user")
    args = parser.parse_args()

    answer, sources, images = answer_question(args.question, args.version, args.role)
    print("\nANSWER:\n" + answer)
    print("\nSOURCES:")
    for s in sources:
        print(f"  - {s}")
    if images:
        print("\nIMAGES:")
        for img in images:
            print(f"  - {img}")
