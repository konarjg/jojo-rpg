#!/usr/bin/env python3
"""Build character-builder.html — editable sheet + catalog pickers (no validation engine)."""

import importlib.util
import json
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))
from rulebook_embed import rules_modal_html

HTML_DIR = os.path.join(BASE_DIR, "html")
CSS_PATH = os.path.join(BASE_DIR, "css", "rulebook.css")
OUT_PATH = os.path.join(BASE_DIR, "sheets", "character-builder.html")
APP_JS_PATH = os.path.join(BASE_DIR, "scripts", "sheet-app.js")
DICE_JS_PATH = os.path.join(BASE_DIR, "scripts", "dice-roller.js")
EXTRACT_PATH = os.path.join(BASE_DIR, "scripts", "extract-rules.py")

CATALOG_START = "<!-- CATALOG:START -->"
CATALOG_END = "<!-- CATALOG:END -->"

SPECIAL = ["STR", "PER", "END", "CHA", "INT", "AGI", "LCK"]
STAND_STATS = [
    ("power", "Power"),
    ("speed", "Speed"),
    ("range", "Range"),
    ("durability", "Durability"),
    ("precision", "Precision"),
    ("developmentPotential", "Dev. Potential"),
]
STAND_GRADES = ["∞", "A", "B", "C", "D", "E", "?", "∅"]
STAND_TYPES = ["Close-Range", "Remote", "Automatic", "Colony", "Tool"]
AMMO_TYPES = [".38 / Revolver", "9mm", "Rifle", "Shotgun Shells", "Energy Cell", "Grenades"]
DR_LOCS = ["head", "torso", "arm", "leg"]


def load_build_rules():
    spec = importlib.util.spec_from_file_location("extract_rules", EXTRACT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load extract-rules.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.build_rules()


def slug(s: str) -> str:
    import re

    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))


def special_rows() -> str:
    lines = []
    for attr in SPECIAL:
        lines.append(
            f'      <div class="field-row"><span>{attr}</span>'
            f'<input id="special-{attr}" type="text" class="sheet-input" style="width:3em"></div>'
        )
    return "\n".join(lines)


def dr_row(kind: str, label: str, cells: str) -> str:
    return f'      <tr><td>{label}</td>{cells}</tr>'


def dr_table_body() -> str:
    phys = "".join(
        f'<td><input id="dr-phys-{loc}" type="text" class="sheet-input" style="width:2.5em"></td>'
        for loc in DR_LOCS
    )
    en = "".join(
        f'<td><input id="dr-en-{loc}" type="text" class="sheet-input" style="width:2.5em"></td>'
        for loc in DR_LOCS
    )
    return (
        dr_row("phys", "Physical", phys)
        + dr_row("en", "Energy", en)
        + '      <tr><td>Poison (body)</td><td colspan="2"><input id="dr-poison" type="text" class="sheet-input" style="width:3em"></td>'
        + '<td>Sunlight</td><td><input id="dr-sunlight" type="text" class="sheet-input" style="width:2.5em"></td></tr>'
    )


def ammo_rows() -> str:
    lines = []
    for ammo in AMMO_TYPES:
        lines.append(
            f'        <tr><td>{ammo}</td><td><input id="ammo-{slug(ammo)}" type="text" class="sheet-input" style="width:3em"></td></tr>'
        )
    for _ in range(4):
        lines.append('        <tr><td class="write-line">&nbsp;</td><td>___</td></tr>')
    return "\n".join(lines)


def stand_grade_boxes() -> str:
    lines = []
    for key, label in STAND_STATS:
        opts = "".join(f'<option value="{g}">{g}</option>' for g in STAND_GRADES)
        lines.append(
            f'        <div class="stat-box"><div class="label">{label}</div>'
            f'<select id="grade-{key}" class="sheet-input">{opts}</select></div>'
        )
    return "\n".join(lines)


def stand_type_buttons() -> str:
    return " ".join(
        f'<button type="button" class="pick-btn stand-type-btn" data-type="{t}">{t}</button>'
        for t in STAND_TYPES
    )


def stand_ability_lines() -> str:
    return "\n".join(
        f'      <textarea id="stand-ability-{i}" class="sheet-input" rows="1" style="width:100%;margin-bottom:0.25em"></textarea>'
        for i in range(4)
    )


def read_file(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def dice_modal_html() -> str:
    return """
<div id="dice-modal" class="modal-panel dice-modal hidden">
  <div class="rules-modal-header">
    <h3>Dice Roller</h3>
    <button type="button" id="btn-dice-close" class="pick-btn" title="Close">&times;</button>
  </div>
  <div id="dice-modal-root" class="dice-roller-root"></div>
</div>
"""


def html_shell(css: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JoJo RPG — Character Sheet</title>
  <style>
{css}
  </style>
</head>
<body class="sheet-body sheet-interactive">

<div class="sheet-shell">
<div class="sheet-toolbar screen-only">
  <h1>JoJo RPG — Character Sheet</h1>
  <div class="sheet-toolbar-actions">
    <div class="sheet-page-nav">
      <button type="button" id="btn-page-prev" class="pick-btn" title="Previous page">← Prev</button>
      <select id="page-select" class="sheet-input" title="Jump to page">
        <option value="0">Page 1 — Attributes &amp; Skills</option>
        <option value="1">Page 2 — Traits &amp; Perks</option>
        <option value="2">Page 3 — Equipment &amp; Inventory</option>
        <option value="3">Page 4 — Stand Sheet</option>
      </select>
      <button type="button" id="btn-page-next" class="pick-btn" title="Next page">Next →</button>
    </div>
    <select id="char-select" class="sheet-input"></select>
    <button type="button" id="btn-new-char" class="pick-btn">New</button>
    <button type="button" id="btn-delete-char" class="pick-btn">Delete</button>
    <button type="button" id="btn-export" class="pick-btn">Export</button>
    <label class="pick-btn" style="cursor:pointer">Import
      <input type="file" id="btn-import" accept=".json" class="hidden">
    </label>
    <span id="save-status">Saved</span>
    <button type="button" id="btn-dice" class="pick-btn">Dice</button>
    <button type="button" id="btn-rules" class="pick-btn pick-btn--rules">Rules</button>
  </div>
</div>

<div id="sheet-viewport">
<div class="sheet-page sheet-page--active" id="page-1">
  <div class="sheet-header">
    <h1>Character Sheet</h1>
    <div class="page-label">Page 1 — Attributes &amp; Skills</div>
  </div>

  <div class="field-row"><span>Name:</span><input id="field-name" type="text" class="sheet-input"></div>
  <div class="field-row"><span>Race:</span>
    <span id="race-picker">
      <button type="button" class="race-btn pick-btn" data-race="human">Human</button>
      <button type="button" class="race-btn pick-btn" data-race="vampire">Vampire</button>
    </span>
  </div>
  <div class="field-row"><span>Level / XP / Next Level:</span>
    <span>
      <input id="field-level" type="text" class="sheet-input" style="width:3em"> /
      <input id="field-xp" type="text" class="sheet-input" style="width:4em"> /
      <input id="field-next-xp" type="text" class="sheet-input" style="width:4em">
    </span>
  </div>

  <div class="sheet-grid">
    <div class="sheet-section">
      <h3>S.P.E.C.I.A.L.</h3>
{special_rows()}
    </div>
    <div class="sheet-section">
      <h3>Derived Statistics</h3>
      <div class="field-row"><span>HP / Max</span><span><input id="field-hp-current" type="text" class="sheet-input" style="width:3em"> / <input id="field-hp-max" type="text" class="sheet-input" style="width:3em"></span></div>
      <div class="field-row"><span>Initiative</span><input id="field-initiative" type="text" class="sheet-input" style="width:4em"></div>
      <div class="field-row"><span>Defense</span><input id="field-defense" type="text" class="sheet-input" style="width:3em"></div>
      <div class="field-row"><span>Carry Weight (lbs)</span><span><input id="field-carry-used" type="text" class="sheet-input" style="width:3em"> / <input id="field-carry-max" type="text" class="sheet-input" style="width:3em"></span></div>
      <div class="field-row"><span>Luck Points</span><input id="field-luck" type="text" class="sheet-input" style="width:3em"></div>
      <div class="field-row"><span>Melee Bonus</span><input id="field-melee-bonus" type="text" class="sheet-input" style="width:4em"> D/C</div>
      <div class="field-row"><span>Trinket</span><input id="field-trinket" type="text" class="sheet-input"></div>
    </div>
  </div>

  <div class="sheet-section">
    <h3>Damage Resistance</h3>
    <table class="sheet-table">
      <tr><th>Type</th><th>Head</th><th>Torso</th><th>Arm</th><th>Leg</th></tr>
{dr_table_body()}
    </table>
  </div>

  <div class="sheet-section">
    <h3>Skills <span style="font-weight:normal;color:var(--jojo-cream-dim)">(○ = Tag, 🔒 = Locked)</span></h3>
    <table class="sheet-table">
      <tr><th>Skill</th><th>Rank</th><th>Skill</th><th>Rank</th></tr>
      <tbody id="skills-grid"></tbody>
    </table>
    <div class="skill-unlocks screen-only">
      <label class="sheet-toggle"><input type="checkbox" id="hamon-unlocked"> Hamon unlocked</label>
      <label class="sheet-toggle"><input type="checkbox" id="spin-unlocked"> Spin unlocked</label>
      <label class="sheet-toggle hidden" id="spin-approved-wrap"><input type="checkbox" id="spin-approved"> Spin GM approved (vampire)</label>
    </div>
  </div>

  <div class="sheet-footer">JoJo RPG — Character Sheet 1/4</div>
</div>

<div class="sheet-page sheet-page--dense" id="page-2">
  <div class="sheet-header">
    <h1>Character Sheet</h1>
    <div class="page-label">Page 2 — Traits &amp; Perks</div>
  </div>

  <div class="field-row"><span>Character Name:</span><input id="field-name-p2" type="text" class="sheet-input"></div>
  <div class="field-row"><span>Level:</span><input id="field-level-p2" type="text" class="sheet-input" style="width:4em"></div>

  <div class="sheet-section" id="section-race-trait">
    <h3>Race Trait</h3>
    <div id="traits-race-area"></div>
  </div>

  <div class="sheet-section" id="section-additional-traits">
    <h3>Additional Traits</h3>
    <div id="traits-additional-area"></div>
  </div>

  <div class="sheet-section">
    <h3>Perks</h3>
    <div id="perks-area"></div>
  </div>

  <div class="sheet-section">
    <h3>Stand Development (if applicable)</h3>
    <table class="sheet-table">
      <tr><th>Level Gained</th><th>Ability Unlocked</th><th>DP Before → After</th></tr>
      <tbody id="stand-dev-body"></tbody>
    </table>
  </div>

  <div class="sheet-footer">JoJo RPG — Character Sheet 2/4</div>
</div>

<div class="sheet-page sheet-page--dense" id="page-3">
  <div class="sheet-header">
    <h1>Character Sheet</h1>
    <div class="page-label">Page 3 — Equipment &amp; Inventory</div>
  </div>

  <div class="field-row"><span>Character Name:</span><input id="field-name-p3" type="text" class="sheet-input"></div>
  <div class="field-row"><span>Money:</span><input id="field-wealth" type="text" class="sheet-input" style="width:5em">
    &nbsp;&nbsp; Carry Weight Used / Max:<span><input id="field-carry-used-p3" type="text" class="sheet-input" style="width:3em"> / <input id="field-carry-max-p3" type="text" class="sheet-input" style="width:3em"> lbs</span>
  </div>

  <div class="sheet-section">
    <h3>Equipped Weapons</h3>
    <table class="sheet-table">
      <tr><th>Slot</th><th>Weapon</th><th>Damage</th><th>Range / FR</th><th>Ammo</th><th>Mods / Notes</th></tr>
      <tbody id="weapons-body"></tbody>
    </table>
  </div>

  <div class="sheet-section">
    <h3>Equipped Armor &amp; Clothing</h3>
    <table class="sheet-table">
      <tr><th>Item</th><th>Physical DR</th><th>Energy DR</th><th>Locations</th><th>Description</th></tr>
      <tbody id="armor-body"></tbody>
    </table>
    <button type="button" id="btn-add-armor" class="pick-btn screen-only" style="margin-top:0.35em">+ Add armor</button>
  </div>

  <div class="sheet-section">
    <h3>General Inventory</h3>
    <table class="sheet-table">
      <tr><th>Item</th><th>Qty</th><th>Wt (lbs)</th><th>Notes</th></tr>
      <tbody id="inventory-body"></tbody>
    </table>
    <button type="button" id="btn-add-inventory" class="pick-btn screen-only" style="margin-top:0.35em">+ Add row</button>
  </div>

  <div class="sheet-grid">
    <div class="sheet-section">
      <h3>Consumables</h3>
      <table class="sheet-table">
        <tr><th>Item</th><th>Qty</th><th>Effect</th></tr>
        <tbody id="consumables-body"></tbody>
      </table>
    </div>
    <div class="sheet-section">
      <h3>Ammunition &amp; Supplies</h3>
      <table class="sheet-table">
        <tr><th>Type</th><th>Qty</th></tr>
{ammo_rows()}
      </table>
    </div>
  </div>

  <div class="sheet-section">
    <h3>Books, Magazines &amp; Key Items</h3>
    <table class="sheet-table">
      <tr><th>Item</th><th>Read?</th><th>Bonus / Effect</th><th></th></tr>
      <tbody id="books-body"></tbody>
    </table>
    <button type="button" id="btn-add-book" class="pick-btn screen-only" style="margin-top:0.35em">+ Add book / key item</button>
  </div>

  <div class="sheet-footer">JoJo RPG — Character Sheet 3/4</div>
</div>

<div class="sheet-page" id="page-4">
  <div class="sheet-header">
    <h1>Stand Sheet</h1>
    <div class="page-label">Page 4 — Stand User Reference</div>
  </div>

  <div class="field-row"><span>Stand Name:</span><input id="field-stand-name" type="text" class="sheet-input"></div>
  <div class="field-row"><span>User:</span><input id="field-stand-user" type="text" class="sheet-input"></div>
  <div class="field-row"><span>Type:</span><span id="stand-type-picker">{stand_type_buttons()}</span></div>

  <div class="sheet-section">
    <h3>Stand Statistics</h3>
    <div class="stat-grid">
{stand_grade_boxes()}
    </div>
    <p><em>Grades: ∞ A B C D E ? ∅</em></p>
  </div>

  <div class="sheet-section">
    <h3>Derived (calculate from grades)</h3>
    <div class="field-row"><span>Stand HP (Durability + user level)</span><span><input id="field-stand-hp-current" type="text" class="sheet-input" style="width:3em"> / <input id="field-stand-hp-max" type="text" class="sheet-input" style="width:3em"></span></div>
    <div class="field-row"><span>Stand Defense (2 if Speed ≥ A)</span><input id="field-stand-defense" type="text" class="sheet-input" style="width:3em"></div>
    <div class="field-row"><span>Stand DR (Durability ÷ 4)</span><input id="field-stand-dr" type="text" class="sheet-input" style="width:3em"></div>
    <div class="field-row"><span>Initiative bonus (Speed ÷ 4)</span><input id="field-stand-init" type="text" class="sheet-input" style="width:3em"></div>
    <div class="field-row"><span>Max attack range band</span><input id="field-stand-range-band" type="text" class="sheet-input" style="width:5em"></div>
  </div>

  <div class="sheet-section">
    <h3>Attacks</h3>
    <div class="sheet-table-wrap">
    <table class="sheet-table stand-attacks-table">
      <tr><th>Name</th><th>Stat</th><th>Damage</th><th>Range</th><th>Notes</th></tr>
      <tbody id="stand-attacks-body"></tbody>
    </table>
    </div>
  </div>

  <div class="sheet-section">
    <h3>Stand Abilities (AP cost)</h3>
{stand_ability_lines()}
  </div>

  <div class="sheet-footer">JoJo RPG — Character Sheet 4/4</div>
</div>
</div><!-- #sheet-viewport -->

</div><!-- .sheet-shell -->

{rules_modal_html()}
{dice_modal_html()}

"""


def main() -> None:
    catalog = load_build_rules()
    catalog_json = json.dumps(catalog, ensure_ascii=False, indent=2)
    css = read_file(CSS_PATH)

    with open(APP_JS_PATH, encoding="utf-8") as f:
        app_js = f.read()
    with open(DICE_JS_PATH, encoding="utf-8") as f:
        dice_js = f.read()

    output = (
        html_shell(css)
        + f"{CATALOG_START}\n"
        + f'<script id="jojo-catalog" type="application/json">\n{catalog_json}\n</script>\n'
        + f"{CATALOG_END}\n\n"
        + f"<script>\n{dice_js}\n</script>\n"
        + f"<script>\n{app_js}\n</script>\n</body>\n</html>\n"
    )

    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(output)

    print(f"Wrote {OUT_PATH}")
    print(f"  css: {len(css):,} bytes (inlined)")
    print(f"  perks: {len(catalog['perks'])}")
    print(f"  weapons: {len(catalog['weapons'])}")
    print(f"  consumables: {len(catalog['consumables'])}")


if __name__ == "__main__":
    main()
