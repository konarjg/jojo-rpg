# JoJo RPG — Build Scripts

Uses [uv](https://docs.astral.sh/uv/) for Python.

## Commands

```powershell
# Regenerate merged rulebook (after editing html/*.html)
uv run scripts/merge.py

# Rebuild interactive character sheet (editable fields + catalog pickers)
uv run scripts/build-interactive-sheet.py
```

`sheets/character-builder.html` is a **single self-contained file** (inlined CSS, JS, catalog, and full rulebook). Send that one file to players — open in any browser, no install. Fully editable online with trait/perk/equipment pickers, inline **Rules** modal, and no automatic validation or stat calculation.

Printable-only versions (separate files): `sheets/character-sheet.html`, `sheets/stand-sheet.html`.
