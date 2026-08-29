"""
chunk_docx.py

Reads a .docx file directly (no HTML step), extracts text section-by-section
and pulls out embedded images (screenshots), keeping each image attached to
the paragraph it appeared next to. Outputs chunks.json where each chunk has
both text and a list of associated image paths.

Requires: pandoc, and soffice/imagemagick for legacy image formats (emf/wmf).

Usage:
    python chunk_docx.py --docx sample_docs/getting-started.docx --out chunks.json --version v1.0
"""
import argparse
import re
import subprocess
import shutil
from pathlib import Path

HEADING_RE = re.compile(r'^(#{1,3})\s+(.*)')
IMAGE_RE = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
IMAGE_ATTR_RE = re.compile(r'^\{[^}]*\}$')  # leftover {width="..." height="..."} lines


def normalize_docx(docx_path: Path, work_dir: Path) -> Path:
    """Round-trip the docx through LibreOffice. Word docs from different
    authoring tools/exporters can have style linkage pandoc's reader misses;
    this re-save fixes that reliably and is cheap enough to always run."""
    work_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["soffice", "--headless", "--convert-to", "docx", "--outdir", str(work_dir), str(docx_path)],
        check=True, capture_output=True, timeout=120,
    )
    normalized = work_dir / docx_path.name
    if not normalized.exists():
        raise RuntimeError(f"Normalization didn't produce expected file: {normalized}")
    return normalized


def convert_legacy_images(media_dir: Path):
    """pandoc sometimes extracts old vector formats (emf/wmf) that browsers
    can't render. Convert them to png in place using LibreOffice."""
    for legacy in list(media_dir.rglob("*.emf")) + list(media_dir.rglob("*.wmf")):
        try:
            subprocess.run(
                ["soffice", "--headless", "--convert-to", "png", "--outdir", str(legacy.parent), str(legacy)],
                check=True, capture_output=True, timeout=60,
            )
        except Exception as e:
            print(f"  warning: couldn't convert {legacy.name}: {e}")


def docx_to_markdown(docx_path: Path, media_dir: Path) -> str:
    media_dir.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["pandoc", str(docx_path), "-t", "markdown", "--wrap=none", f"--extract-media={media_dir}"],
        capture_output=True, text=True, check=True,
    )
    convert_legacy_images(media_dir)
    return result.stdout


def parse_sections(markdown: str):
    """Walk the markdown line by line, grouping into (heading, [blocks]) where
    each block is {'type': 'text'|'image', 'content'|'path': ...}, in document order."""
    sections = []
    current_heading = "Introduction"
    current_blocks = []

    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        heading_match = HEADING_RE.match(line)
        if heading_match:
            if current_blocks:
                sections.append((current_heading, current_blocks))
            current_heading = heading_match.group(2).strip()
            current_blocks = []
            continue

        image_match = IMAGE_RE.search(line)
        if image_match:
            current_blocks.append({"type": "image", "path": image_match.group(2)})
            # a line can also carry trailing text alongside the image markdown; grab it
            remainder = IMAGE_RE.sub("", line).strip()
            if remainder and not IMAGE_ATTR_RE.match(remainder):
                current_blocks.append({"type": "text", "content": remainder})
            continue

        if IMAGE_ATTR_RE.match(line):
            # pandoc sometimes wraps {width=... height=...} onto its own line
            continue

        current_blocks.append({"type": "text", "content": line})

    if current_blocks:
        sections.append((current_heading, current_blocks))

    return sections


def chunk_section(heading, blocks, source_file, version, max_words=150, overlap_words=30):
    chunks = []
    current_words, current_images = [], []
    chunk_idx = 0

    def flush():
        nonlocal current_words, current_images, chunk_idx
        if not current_words and not current_images:
            return
        text = f"{heading}: " + " ".join(current_words) if current_words else heading
        chunks.append({
            "id": f"{source_file}::{heading}::{chunk_idx}",
            "source_file": source_file,
            "heading": heading,
            "version": version,
            "text": text,
            "images": current_images.copy(),
        })
        chunk_idx += 1
        current_words = current_words[-overlap_words:] if len(current_words) > overlap_words else []
        current_images = []

    for block in blocks:
        if block["type"] == "text":
            current_words.extend(block["content"].split())
            if len(current_words) >= max_words:
                flush()
        elif block["type"] == "image":
            current_images.append(block["path"])

    flush()
    return chunks


def process_docx(docx_path: Path, media_dir: Path, version: str, work_dir: Path = None):
    work_dir = work_dir or (media_dir.parent / "_normalized")
    normalized_path = normalize_docx(docx_path, work_dir)

    markdown = docx_to_markdown(normalized_path, media_dir)
    sections = parse_sections(markdown)

    all_chunks = []
    for heading, blocks in sections:
        all_chunks.extend(chunk_section(heading, blocks, docx_path.name, version))
    return all_chunks


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--docx", required=True, help="Path to the source .docx file")
    parser.add_argument("--out", default="chunks.json", help="Output JSON file")
    parser.add_argument("--version", default="v1.0", help="Doc/product version label")
    parser.add_argument("--media-dir", default="media", help="Where extracted images are saved")
    args = parser.parse_args()

    docx_path = Path(args.docx)
    media_dir = Path(args.media_dir) / args.version

    chunks = process_docx(docx_path, media_dir, args.version)

    import json
    Path(args.out).write_text(json.dumps(chunks, indent=2), encoding="utf-8")

    n_images = sum(len(c["images"]) for c in chunks)
    print(f"Wrote {len(chunks)} chunks ({n_images} image references) from {docx_path} -> {args.out}")
