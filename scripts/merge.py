#!/usr/bin/env python3
"""Merge JoJo RPG HTML chapters into a single rulebook file with inlined CSS."""

import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_DIR = os.path.join(BASE_DIR, "html")
CSS_PATH = os.path.join(BASE_DIR, "css", "rulebook.css")
OUTPUT_PATH = os.path.join(BASE_DIR, "jojo-rpg-complete.html")

CHAPTER_FILES = [
    "00-table-of-contents.html",
    "01-core-rules.html",
    "02-combat.html",
    "03-character-creation.html",
    "04-equipment.html",
    "05-survival.html",
    "06-gamemastering.html",
    "07-npc-examples.html",
    "08-appendices.html",
]


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def extract_body(html: str) -> str:
    match = re.search(r"<body[^>]*>(.*)</body>", html, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return html


def main() -> None:
    css = read_file(CSS_PATH)
    parts: list[str] = []

    parts.append("<!DOCTYPE html>")
    parts.append('<html lang="en">')
    parts.append("<head>")
    parts.append('  <meta charset="UTF-8">')
    parts.append("  <title>JoJo's Bizarre Adventure — Roleplaying Game (Complete)</title>")
    parts.append("  <style>")
    parts.append(css)
    parts.append("  </style>")
    parts.append("</head>")
    parts.append("<body>")

    for filename in CHAPTER_FILES:
        path = os.path.join(HTML_DIR, filename)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing chapter: {path}")
        body = extract_body(read_file(path))
        parts.append(f'<div class="chapter-break" id="{filename.replace(".html", "")}">')
        parts.append(body)
        parts.append("</div>")

    parts.append('<div class="page-footer">— End of Rulebook —</div>')
    parts.append("</body>")
    parts.append("</html>")

    output = "\n".join(parts)
    with open(OUTPUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(output)

    print(f"Merged {len(CHAPTER_FILES)} chapters -> {OUTPUT_PATH}")
    print(f"Output size: {len(output):,} bytes")


if __name__ == "__main__":
    main()
