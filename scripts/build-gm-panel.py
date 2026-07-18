#!/usr/bin/env python3
"""Build gm-panel.html — GM toolkit + player view popup (single self-contained file)."""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))
from rulebook_embed import rules_modal_html

CSS_PATH = os.path.join(BASE_DIR, "css", "rulebook.css")
OUT_PATH = os.path.join(BASE_DIR, "sheets", "gm-panel.html")
GM_JS_PATH = os.path.join(BASE_DIR, "scripts", "gm-app.js")
DICE_JS_PATH = os.path.join(BASE_DIR, "scripts", "dice-roller.js")
NPC_SHEET_JS_PATH = os.path.join(BASE_DIR, "scripts", "npc-sheet.js")
GM_STATE_JS_PATH = os.path.join(BASE_DIR, "scripts", "gm-state.js")
STICKY_BOARD_JS_PATH = os.path.join(BASE_DIR, "scripts", "sticky-board.js")
MARKDOWN_RENDER_JS_PATH = os.path.join(BASE_DIR, "scripts", "markdown-render.js")
MARKED_JS_PATH = os.path.join(BASE_DIR, "scripts", "vendor", "marked.min.js")
PURIFY_JS_PATH = os.path.join(BASE_DIR, "scripts", "vendor", "purify.min.js")

STAND_GRADES = ["∞", "A", "B", "C", "D", "E", "?", "∅"]
STAND_TYPES = ["Close-Range", "Remote", "Automatic", "Colony", "Tool"]
NPC_TYPES = ["normal", "notable", "major", "creature"]
NPC_TYPE_LABELS = {
    "normal": "Normal",
    "notable": "Notable",
    "major": "Major",
    "creature": "Creature",
}


def grade_select(field_id: str, default: str = "D") -> str:
    opts = "".join(
        f'<option value="{g}"{" selected" if g == default else ""}>{g}</option>'
        for g in STAND_GRADES
    )
    return f'<select id="{field_id}" class="sheet-input">{opts}</select>'


def npc_modal_html() -> str:
    type_opts = "".join(
        f'<option value="{t}">{NPC_TYPE_LABELS[t]}</option>' for t in NPC_TYPES
    )
    stand_type_opts = "".join(
        f'<option value="{t}">{t}</option>' for t in STAND_TYPES
    )
    special_grid = "\n".join(
        f'          <label class="gm-stat-field"><span class="gm-stat-label">{label}</span>'
        f'<input type="text" id="npc-f-{key}" class="sheet-input"></label>'
        for key, label in [
            ("str", "STR"), ("per", "PER"), ("end", "END"), ("cha", "CHA"),
            ("int", "INT"), ("agi", "AGI"), ("lck", "LCK"),
        ]
    )
    stand_grades = "\n".join(
        f'          <label class="gm-stat-field"><span class="gm-stat-label">{label}</span>'
        f' {grade_select("npc-f-stand-" + key.lower(), "D")}</label>'
        for key, label in [
            ("power", "Power"), ("speed", "Speed"), ("range", "Range"),
            ("durability", "Durability"), ("precision", "Precision"), ("dp", "DP"),
        ]
    )
    return f"""
<div id="npc-modal" class="modal-panel gm-npc-modal hidden">
  <div class="rules-modal-header">
    <h3 id="npc-modal-title">Add NPC</h3>
    <button type="button" id="npc-modal-close" class="pick-btn" title="Close">&times;</button>
  </div>
  <div class="gm-npc-form-scroll">
    <fieldset class="gm-npc-form-section">
      <legend>Identity</legend>
      <div class="gm-form-row">
        <label class="gm-form-field gm-form-field--grow">Name
          <input type="text" id="npc-f-name" class="sheet-input" placeholder="e.g. Dio Brando">
        </label>
        <label class="gm-form-field">Level
          <input type="text" id="npc-f-level" class="sheet-input" placeholder="12">
        </label>
        <label class="gm-form-field">Type
          <select id="npc-f-type" class="sheet-input">{type_opts}</select>
        </label>
        <label class="gm-form-field">XP
          <input type="text" id="npc-f-xp" class="sheet-input" placeholder="180">
        </label>
      </div>
    </fieldset>

    <fieldset class="gm-npc-form-section" id="npc-f-special-section">
      <legend>S.P.E.C.I.A.L.</legend>
      <div class="gm-stat-grid">
{special_grid}
      </div>
      <label class="gm-form-field">Extra (e.g. Spin rank 2)
        <input type="text" id="npc-f-special-extra" class="sheet-input" placeholder="Optional notes on stat line">
      </label>
    </fieldset>

    <fieldset class="gm-npc-form-section hidden" id="npc-f-creature-section">
      <legend>Creature stats</legend>
      <div class="gm-stat-grid gm-stat-grid--creature">
        <label class="gm-stat-field"><span class="gm-stat-label">BODY</span><input type="text" id="npc-f-body" class="sheet-input"></label>
        <label class="gm-stat-field"><span class="gm-stat-label">MIND</span><input type="text" id="npc-f-mind" class="sheet-input"></label>
        <label class="gm-stat-field"><span class="gm-stat-label">Melee</span><input type="text" id="npc-f-melee" class="sheet-input"></label>
        <label class="gm-stat-field"><span class="gm-stat-label">Guns</span><input type="text" id="npc-f-guns" class="sheet-input" placeholder="— if none"></label>
        <label class="gm-stat-field"><span class="gm-stat-label">Other</span><input type="text" id="npc-f-other" class="sheet-input"></label>
      </div>
    </fieldset>

    <fieldset class="gm-npc-form-section">
      <legend>Combat</legend>
      <div class="gm-stat-grid">
        <label class="gm-stat-field"><span class="gm-stat-label">HP</span><input type="text" id="npc-f-hp" class="sheet-input"></label>
        <label class="gm-stat-field"><span class="gm-stat-label">Initiative</span><input type="text" id="npc-f-initiative" class="sheet-input"></label>
        <label class="gm-stat-field"><span class="gm-stat-label">Defense</span><input type="text" id="npc-f-defense" class="sheet-input"></label>
        <label class="gm-stat-field"><span class="gm-stat-label">Luck</span><input type="text" id="npc-f-luck" class="sheet-input"></label>
      </div>
    </fieldset>

    <fieldset class="gm-npc-form-section">
      <legend>Damage resistance</legend>
      <div class="gm-stat-grid">
        <label class="gm-stat-field"><span class="gm-stat-label">PHYS DR</span><input type="text" id="npc-f-dr-phys" class="sheet-input" placeholder="2 (all)"></label>
        <label class="gm-stat-field"><span class="gm-stat-label">ENERGY DR</span><input type="text" id="npc-f-dr-energy" class="sheet-input"></label>
      </div>
      <div class="gm-stat-grid hidden" id="npc-f-dr-creature">
        <label class="gm-stat-field"><span class="gm-stat-label">POISON DR</span><input type="text" id="npc-f-dr-poison" class="sheet-input"></label>
        <label class="gm-stat-field"><span class="gm-stat-label">SUN DR</span><input type="text" id="npc-f-dr-sun" class="sheet-input"></label>
      </div>
      <label class="gm-form-field hidden" id="npc-f-dr-special">Other DR / notes
        <input type="text" id="npc-f-dr-extra" class="sheet-input" placeholder="Immortal Blood, Regeneration…">
      </label>
    </fieldset>

    <fieldset class="gm-npc-form-section">
      <legend>Attacks</legend>
      <div class="gm-attack-list-field">
        <div id="npc-f-attacks-list" class="gm-attack-list">
          <ul class="gm-attack-list-items"></ul>
          <button type="button" class="pick-btn gm-attack-add">+ Add attack</button>
        </div>
      </div>
    </fieldset>

    <fieldset class="gm-npc-form-section">
      <legend>Stand</legend>
      <label class="sheet-toggle gm-stand-toggle"><input type="checkbox" id="npc-f-has-stand"> Has Stand</label>
      <div id="npc-f-stand-fields" class="hidden">
        <div class="gm-form-row">
          <label class="gm-form-field gm-form-field--grow">Stand name
            <input type="text" id="npc-f-stand-name" class="sheet-input" placeholder="The World">
          </label>
          <label class="gm-form-field">Type
            <select id="npc-f-stand-type" class="sheet-input">{stand_type_opts}</select>
          </label>
        </div>
        <div class="gm-stat-grid gm-stat-grid--stand">
{stand_grades}
        </div>
        <div class="gm-stat-grid">
          <label class="gm-stat-field"><span class="gm-stat-label">Stand HP</span><input type="text" id="npc-f-stand-hp" class="sheet-input"></label>
          <label class="gm-stat-field"><span class="gm-stat-label">Stand Defense</span><input type="text" id="npc-f-stand-defense" class="sheet-input"></label>
          <label class="gm-stat-field"><span class="gm-stat-label">Stand DR</span><input type="text" id="npc-f-stand-dr" class="sheet-input"></label>
        </div>
        <p class="gm-subsection-label">Stand attacks</p>
        <div class="gm-attack-list-field">
          <div id="npc-f-stand-attacks-list" class="gm-attack-list">
            <ul class="gm-attack-list-items"></ul>
            <button type="button" class="pick-btn gm-attack-add">+ Add attack</button>
          </div>
        </div>
      </div>
    </fieldset>

    <fieldset class="gm-npc-form-section">
      <legend>Abilities</legend>
      <div class="gm-attack-list-field">
        <div id="npc-f-abilities-list" class="gm-attack-list">
          <ul class="gm-attack-list-items"></ul>
          <button type="button" class="pick-btn gm-attack-add">+ Add ability</button>
        </div>
      </div>
    </fieldset>
  </div>
  <div class="modal-actions">
    <button type="button" id="npc-modal-cancel" class="pick-btn">Cancel</button>
    <button type="button" id="npc-modal-save" class="pick-btn pick-btn--accent">Save</button>
  </div>
</div>
"""


def read_file(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def gm_shell() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JoJo RPG — GM Panel</title>
  <style>
{css}
  </style>
</head>
<body class="sheet-body sheet-interactive gm-body">

<div id="gm-app" class="gm-app">
  <div class="gm-toolbar screen-only">
    <h1>JoJo RPG — GM Panel</h1>
    <div class="gm-toolbar-actions">
      <button type="button" id="gm-open-player" class="pick-btn pick-btn--accent">Open Player View</button>
      <span id="gm-player-status" class="gm-status gm-status--warn">Player view: not open</span>
      <label class="sheet-toggle gm-auto-open"><input type="checkbox" id="gm-auto-open-player"> Open player view on startup</label>
      <select id="gm-session-select" class="sheet-input"></select>
      <button type="button" id="gm-add-session" class="pick-btn" title="Add session">+</button>
      <button type="button" id="gm-rename-session" class="pick-btn" title="Rename session">Rename</button>
      <button type="button" id="gm-delete-session" class="pick-btn" title="Delete session">Delete</button>
      <span class="gm-toolbar-divider" aria-hidden="true"></span>
      <select id="gm-snapshot-select" class="sheet-input gm-snapshot-select" title="Saved snapshots"></select>
      <button type="button" id="gm-snapshot-save" class="pick-btn" title="Save snapshot">Save snapshot</button>
      <button type="button" id="gm-snapshot-restore" class="pick-btn" title="Restore snapshot">Restore</button>
      <button type="button" id="gm-snapshot-delete" class="pick-btn" title="Delete snapshot">Del snap</button>
      <button type="button" id="gm-export-json" class="pick-btn" title="Export workspace JSON">Export</button>
      <button type="button" id="gm-import-json-btn" class="pick-btn" title="Import JSON as snapshot">Import</button>
      <input type="file" id="gm-import-json" class="gm-import-json-input hidden" accept="application/json,.json">
      <span class="gm-toolbar-divider" aria-hidden="true"></span>
      <span class="gm-panel-toggles" aria-label="Show panels">
        <button type="button" class="pick-btn gm-panel-toggle gm-panel-toggle--active" data-panel="notes" aria-pressed="true" title="Show notes">Notes</button>
        <button type="button" class="pick-btn gm-panel-toggle gm-panel-toggle--active" data-panel="map" aria-pressed="true" title="Show map">Map</button>
        <button type="button" class="pick-btn gm-panel-toggle gm-panel-toggle--active" data-panel="npc" aria-pressed="true" title="Show NPCs">NPCs</button>
      </span>
      <span class="gm-toolbar-divider" aria-hidden="true"></span>
      <button type="button" id="btn-rules" class="pick-btn pick-btn--rules">Rules</button>
    </div>
  </div>

  <div class="gm-layout" id="gm-layout">
    <aside class="gm-column gm-column--left" data-panel="notes">
      <section class="gm-panel-section gm-sticky-section">
        <div class="gm-section-head">
          <h2>Notes</h2>
          <div class="gm-section-actions">
            <button type="button" id="gm-add-sticky" class="pick-btn">+ Note</button>
            <button type="button" class="gm-panel-close" data-panel="notes" title="Hide notes">&times;</button>
          </div>
        </div>
        <div id="gm-sticky-board" class="gm-sticky-board"></div>
      </section>
    </aside>

    <main class="gm-column gm-column--center" data-panel="map">
      <section class="gm-panel-section gm-map-section">
        <div class="gm-section-head gm-section-head--map">
          <h2>Combat map <span class="gm-hint">(synced to player view)</span></h2>
          <div class="gm-section-actions">
            <div class="gm-map-toolbar">
              <select id="gm-map-select" class="sheet-input gm-map-select" title="Active map"></select>
              <button type="button" id="gm-map-add" class="pick-btn" title="New map">+ Map</button>
              <button type="button" id="gm-map-rename" class="pick-btn" title="Rename map">Rename</button>
              <button type="button" id="gm-map-delete" class="pick-btn" title="Delete map">Delete</button>
              <button type="button" id="gm-map-global" class="pick-btn" title="Save as global map">Save as global</button>
            </div>
            <button type="button" class="gm-panel-close" data-panel="map" title="Hide map">&times;</button>
          </div>
        </div>
        <div id="gm-map-canvas" class="gm-map-canvas gm-map-canvas--select"></div>
      </section>
      <section class="gm-panel-section gm-tokens-section">
        <h2>Tokens</h2>
        <p id="gm-token-hint" class="gm-hint">Select / move tokens, or pick a type below to place. Right-click map to cancel.</p>
        <button type="button" id="gm-mode-select" class="pick-btn gm-palette-btn gm-mode-select">Select / move</button>
        <div id="gm-token-palette" class="gm-token-palette"></div>
        <button type="button" id="gm-remove-token" class="pick-btn">Remove selected</button>
      </section>
      <section class="gm-panel-section gm-dice-section">
        <h2>Dice</h2>
        <div id="gm-dice-root" class="dice-roller-root"></div>
      </section>
    </main>

    <aside class="gm-column gm-column--right gm-column--npc" data-panel="npc">
      <section class="gm-panel-section gm-npc-section">
        <div class="gm-section-head">
          <h2>NPC quick view</h2>
          <div class="gm-section-actions">
            <button type="button" id="gm-npc-add" class="pick-btn">+ Add NPC</button>
            <button type="button" class="gm-panel-close" data-panel="npc" title="Hide NPCs">&times;</button>
          </div>
        </div>
        <input type="text" id="gm-npc-search" class="sheet-input gm-npc-search" placeholder="Search NPCs…">
        <div class="gm-npc-layout">
          <div id="gm-npc-list" class="gm-npc-list"></div>
          <div id="gm-npc-preview" class="gm-npc-preview"><em>Add or select an NPC</em></div>
        </div>
        <div class="gm-npc-actions">
          <button type="button" id="gm-npc-edit" class="pick-btn" disabled>Edit</button>
          <button type="button" id="gm-npc-delete" class="pick-btn" disabled>Delete</button>
        </div>
      </section>
    </aside>
  </div>
</div>

<div id="player-app" class="player-app hidden">
  <header class="player-header">
    <h1>JoJo RPG — Player View</h1>
    <p class="player-share-hint">Share <strong>this window</strong> in Discord (Share → Window).</p>
  </header>
  <div id="player-roll-banner" class="player-roll-banner hidden"></div>
  <div id="player-map-canvas" class="gm-map-canvas player-map-canvas"></div>
</div>

{npc_modal}

{rules_modal}
"""


def player_view_script() -> str:
    return """
<script>
(function () {
  var isPlayer = /[?&]view=player(?:&|$)/.test(window.location.search);
  if (isPlayer) {
    document.getElementById('gm-app').classList.add('hidden');
    document.getElementById('player-app').classList.remove('hidden');
  }
})();
</script>
"""


def main() -> None:
    css = read_file(CSS_PATH)

    with open(GM_JS_PATH, encoding="utf-8") as f:
        gm_js = f.read()
    with open(DICE_JS_PATH, encoding="utf-8") as f:
        dice_js = f.read()
    with open(NPC_SHEET_JS_PATH, encoding="utf-8") as f:
        npc_sheet_js = f.read()
    with open(GM_STATE_JS_PATH, encoding="utf-8") as f:
        gm_state_js = f.read()
    with open(STICKY_BOARD_JS_PATH, encoding="utf-8") as f:
        sticky_board_js = f.read()
    with open(MARKDOWN_RENDER_JS_PATH, encoding="utf-8") as f:
        markdown_render_js = f.read()
    with open(MARKED_JS_PATH, encoding="utf-8") as f:
        marked_js = f.read()
    with open(PURIFY_JS_PATH, encoding="utf-8") as f:
        purify_js = f.read()

    shell = gm_shell().format(
        css=css,
        npc_modal=npc_modal_html(),
        rules_modal=rules_modal_html(),
    )
    output = (
        shell
        + player_view_script()
        + f"<script>\n{marked_js}\n</script>\n"
        + f"<script>\n{purify_js}\n</script>\n"
        + f"<script>\n{markdown_render_js}\n</script>\n"
        + f"<script>\n{dice_js}\n</script>\n"
        + f"<script>\n{npc_sheet_js}\n</script>\n"
        + f"<script>\n{gm_state_js}\n</script>\n"
        + f"<script>\n{sticky_board_js}\n</script>\n"
        + f"<script>\n{gm_js}\n</script>\n</body>\n</html>\n"
    )

    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(output)

    print(f"Wrote {OUT_PATH}")
    print(f"  css: {len(css):,} bytes (inlined)")


if __name__ == "__main__":
    main()
