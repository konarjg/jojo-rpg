# JoJo RPG — Build Scripts

Uses [uv](https://docs.astral.sh/uv/) for Python.

## Commands

```powershell
# Regenerate merged rulebook (after editing html/*.html)
uv run scripts/merge.py

# Rebuild interactive character sheet (editable fields + catalog pickers + dice roller)
uv run scripts/build-interactive-sheet.py

# Rebuild GM panel (notepad, map, dice, NPCs, player view sync)
uv run scripts/build-gm-panel.py
```

## Distribution

| File | Audience | Notes |
|------|----------|-------|
| `sheets/character-builder.html` | Players | Single self-contained file — send this to players |
| `sheets/gm-panel.html` | GM | Single self-contained GM toolkit |

Both files inline CSS, JS, rulebook chapters, and data. Open in any browser; no install.

### Character builder

Editable sheet with trait/perk/equipment pickers, inline **Rules** modal, **Dice** roller (N×d20 / N×d6), and no automatic validation.

### GM panel — Discord two-window sharing

GM secrets (notepad, stickies, dice log, NPC stats) stay in the **GM Panel** window. Only the **Player View** popup is shared in Discord.

1. Open `sheets/gm-panel.html`
2. Click **Open Player View** (optional: enable “Open player view on startup”)
3. In Discord: **Share → Window** → pick **JoJo RPG — Player View**

The active combat map syncs automatically to the player view.

#### Session notepad & stickies (Markdown)

Session notes and sticky notes support **Markdown** with a live preview (headings, lists, bold, links, code). Source is stored as plain Markdown in your browser.

#### Named maps

Each session can have **multiple maps**. Use the map toolbar above the canvas to create, rename, delete, and switch maps. **Save as global** copies the current map into a shared **Global** pool available in every session’s map picker. Only the **active** map is synced to the player view.

#### Snapshots & backup

The toolbar includes **Save snapshot**, **Restore**, and **Delete** for up to 20 named in-app snapshots. Each snapshot captures the full workspace: all sessions (notes, stickies, maps), global maps, NPC catalog, and UI preferences.

- **Export** — downloads the live workspace as JSON (same shape as snapshot data).
- **Import** — loads a JSON file as a new snapshot (does not overwrite until you **Restore**).

Rebuild after editing GM scripts: `uv run scripts/build-gm-panel.py`

NPCs are stored in the campaign state (`localStorage` key `jojo-gm:campaign`) — use **+ Add NPC** in the GM panel.

Printable-only versions (separate files): `sheets/character-sheet.html`, `sheets/stand-sheet.html`.
