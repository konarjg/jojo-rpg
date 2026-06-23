# JoJo RPG

## Web application (ASP.NET)

Hexagonal .NET solution under `src/` with TypeScript client in `client/`.

### Build order

```powershell
# 1. Frontend bundles → src/JojoRpg.Web/wwwroot/js/
cd client
npm install
npm run build
cd ..

# 2. Regenerate linq2db entities from DbUp schema (Docker optional if SCHEMAGEN_CONNECTION_STRING is set)
dotnet tool restore
dotnet run --project tools/JojoRpg.SchemaCodegen/JojoRpg.SchemaCodegen.csproj

# 3. Run the site (LocalDB connection string in appsettings.json)
dotnet run --project src/JojoRpg.Web/JojoRpg.Web.csproj
```

### Tests

```powershell
dotnet test tests/JojoRpg.Application.Tests          # no Docker
dotnet test tests/JojoRpg.IntegrationTests           # requires Docker (Testcontainers SQL Server)
```

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Create room or join as player |
| `/join` | Join by room code (POST from home) |
| `/room/{code}/join` | Player join for a room |
| `/room/{code}/play` | Player sheet + live shared map sidebar |
| `/room/{code}/gm/sheets` | GM sheet list |
| `/room/{code}/gm/sheet/{id}` | Read-only player sheet (GM) |
| `/room/{code}/gm/builder` | Reference character builder (GM) |

Auth uses an opaque `RoomSessionId` cookie backed by the `RoomSessions` table. Players also receive a **player code** on first join (stored in a long-lived browser cookie and shown once); entering that code rejoins the same character sheet.

### Continuous deployment

Pushes to `main` run [`.github/workflows/cd.yml`](.github/workflows/cd.yml): build, test, then FTPS upload to `http://jojorpg.runasp.net/` (`/wwwroot` on site `site75760`).

Add these **repository secrets** in GitHub (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `FTP_PASSWORD` | FTP password from hosting panel (Deploy → FTP) for site `site75760` |
| `DATABASE_PASSWORD` | SQL password for production database user `db57094` |

Production server and database settings are in `src/JojoRpg.Web/appsettings.Production.json` with a `__DB_PASSWORD__` placeholder; CD replaces that placeholder at publish time.

---

## Legacy static HTML (Python build scripts)

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
