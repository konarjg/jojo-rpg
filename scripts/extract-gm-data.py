#!/usr/bin/env python3
"""Extract GM panel data (NPC catalog) from rulebook HTML."""

import json
import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_DIR = os.path.join(BASE_DIR, "html")
NPC_PATH = os.path.join(HTML_DIR, "07-npc-examples.html")


def slug(text: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", text.lower()))


def extract_npc_blocks(html: str) -> list[dict]:
    blocks = []
    pattern = re.compile(
        r'<div class="npc-block">\s*<h3>(.*?)</h3>(.*?)</div>',
        re.DOTALL | re.IGNORECASE,
    )
    for match in pattern.finditer(html):
        heading = re.sub(r"\s+", " ", match.group(1).strip())
        body_html = match.group(2).strip()
        name_part = heading.split("—")[0].strip() if "—" in heading else heading
        npc_id = slug(name_part) or f"npc-{len(blocks)}"
        blocks.append(
            {
                "id": npc_id,
                "name": name_part,
                "heading": heading,
                "html": body_html,
            }
        )
    return blocks


def build_npc_catalog() -> list[dict]:
    with open(NPC_PATH, encoding="utf-8") as f:
        html = f.read()
    return extract_npc_blocks(html)


def main() -> None:
    catalog = build_npc_catalog()
    print(json.dumps(catalog, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
