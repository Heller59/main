"""
build_index.py

Reads a chunks.json (from chunk_docs.py), embeds each chunk with a local
Ollama embedding model, and stores it in a Chroma collection named after
the doc version. Re-running this for a new version just creates a new
collection -- old versions are untouched.

Usage:
    python build_index.py --chunks chunks.json --version v1.0
"""
import argparse
import json
from pathlib import Path

import chromadb
import ollama

EMBED_MODEL = "nomic-embed-text"  # ollama pull nomic-embed-text
STORE_DIR = "chroma_store"


def embed(text: str):
    resp = ollama.embeddings(model=EMBED_MODEL, prompt=text)
    return resp["embedding"]


def build_index(chunks_path: Path, version: str):
    chunks = json.loads(chunks_path.read_text(encoding="utf-8"))

    client = chromadb.PersistentClient(path=STORE_DIR)
    collection_name = f"docs_{version}"

    # Fresh collection each build so re-indexing a version doesn't duplicate entries
    try:
        client.delete_collection(collection_name)
    except Exception:
        pass
    collection = client.create_collection(collection_name)

    ids, embeddings, documents, metadatas = [], [], [], []
    for i, chunk in enumerate(chunks):
        print(f"Embedding {i + 1}/{len(chunks)}: {chunk['id']}")
        ids.append(chunk["id"])
        embeddings.append(embed(chunk["text"]))
        documents.append(chunk["text"])
        metadatas.append({
            "source_file": chunk["source_file"],
            "heading": chunk["heading"],
            "version": chunk["version"],
            # Chroma metadata values must be scalars, so join image paths into one string
            "images": "|".join(chunk.get("images", [])),
        })

    collection.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
    print(f"\nIndexed {len(chunks)} chunks into collection '{collection_name}' at ./{STORE_DIR}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunks", required=True, help="Path to chunks.json")
    parser.add_argument("--version", required=True, help="Version label, e.g. v1.0")
    args = parser.parse_args()

    build_index(Path(args.chunks), args.version)
