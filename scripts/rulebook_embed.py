"""Shared rulebook chapter embedding for build scripts."""

import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_DIR = os.path.join(BASE_DIR, "html")

RULEBOOK_CHAPTERS = [
    ("00-table-of-contents", "Introduction", ""),
    ("01-core-rules", "Core Rules", "Skill tests, Action Points, Luck, opposed tests"),
    ("02-combat", "Combat", "Attacks, Defense, DR, injuries, Stand combat"),
    ("03-character-creation", "Character Creation", "S.P.E.C.I.A.L., skills, races, Stand, perks"),
    ("04-equipment", "Equipment", "Weapons, armor, consumables"),
    ("05-survival", "Survival", "Sunlight, crafting, scavenging"),
    ("06-gamemastering", "Gamemastering", "NPC types, safety, campaigns"),
    ("07-npc-examples", "NPC Examples", "11 villain profiles"),
    ("08-appendices", "Appendices", "Reference tables, index"),
]


def read_file(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def extract_body(html: str) -> str:
    match = re.search(r"<body[^>]*>(.*)</body>", html, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return html


def rules_chapter_label(index: int, chapter_id: str, title: str) -> str:
    if chapter_id.startswith("00"):
        return title
    chapter_num = int(chapter_id[:2])
    return f"{chapter_num}. {title}"


def build_rules_toc() -> str:
    lines = [
        '    <nav class="rules-toc">',
        '      <p class="rules-toc-heading">Table of Contents</p>',
        '      <ul class="rules-toc-list">',
    ]
    for index, (chapter_id, title, summary) in enumerate(RULEBOOK_CHAPTERS):
        label = rules_chapter_label(index, chapter_id, title)
        active = " rules-toc-link--active" if index == 0 else ""
        summary_html = (
            f'        <p class="rules-toc-desc">{summary}</p>' if summary else ""
        )
        lines.append(
            f'      <li class="rules-toc-item">'
            f'<button type="button" class="rules-toc-link{active}" data-rules-index="{index}">'
            f"{label}</button>"
        )
        if summary_html:
            lines.append(summary_html)
        lines.append("      </li>")
    lines.extend(["      </ul>", "    </nav>"])
    return "\n".join(lines)


def build_rules_pagination() -> str:
    options = []
    for index, (chapter_id, title, _summary) in enumerate(RULEBOOK_CHAPTERS):
        label = rules_chapter_label(index, chapter_id, title)
        selected = " selected" if index == 0 else ""
        options.append(f'        <option value="{index}"{selected}>{label}</option>')
    opts = "\n".join(options)
    return f"""    <div class="rules-pagination">
      <button type="button" id="btn-rules-prev" class="pick-btn" title="Previous chapter">← Prev</button>
      <select id="rules-chapter-select" class="sheet-input" title="Jump to chapter">
{opts}
      </select>
      <button type="button" id="btn-rules-next" class="pick-btn" title="Next chapter">Next →</button>
    </div>"""


def build_rules_content(html_dir: str | None = None) -> str:
    root = html_dir or HTML_DIR
    lines = ['    <div id="rules-content" class="rules-content">']
    for index, (chapter_id, title, _summary) in enumerate(RULEBOOK_CHAPTERS):
        path = os.path.join(root, f"{chapter_id}.html")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing rulebook chapter: {path}")
        body = extract_body(read_file(path))
        active = " rules-chapter--active" if index == 0 else ""
        lines.append(
            f'      <section class="rules-chapter{active}" id="rules-chapter-{chapter_id}" '
            f'data-rules-index="{index}" data-chapter="{chapter_id}">'
        )
        lines.append(body)
        lines.append("      </section>")
    lines.append("    </div>")
    return "\n".join(lines)


def rules_modal_html(html_dir: str | None = None) -> str:
    return f"""
<div id="modal-overlay" class="modal-overlay hidden"></div>
<div id="card-picker-modal" class="modal-panel hidden">
  <h3 id="picker-title">Choose</h3>
  <input type="text" id="picker-search" placeholder="Search..." class="sheet-input" style="width:100%;margin-bottom:0.5em">
  <div class="modal-grid">
    <div id="picker-list" class="picker-list"></div>
    <div id="picker-preview" class="picker-preview"><em>Select an item to preview</em></div>
  </div>
  <div class="modal-actions">
    <button type="button" id="picker-cancel" class="pick-btn">Cancel</button>
    <button type="button" id="picker-confirm" class="pick-btn" disabled>Select</button>
  </div>
</div>

<div id="rules-modal" class="modal-panel rules-modal hidden">
  <div class="rules-modal-header">
    <h3>JoJo RPG — Rules</h3>
    <button type="button" id="btn-rules-close" class="pick-btn" title="Close">&times;</button>
  </div>
  <div class="rules-modal-layout">
{build_rules_toc()}
    <div class="rules-view">
{build_rules_content(html_dir)}
{build_rules_pagination()}
    </div>
  </div>
</div>
"""
