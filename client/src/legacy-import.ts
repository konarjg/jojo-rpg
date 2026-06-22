import { getConfig } from './storage-mode';

export interface CharacterSheetPayload {
  id: string;
  name: string;
  schemaVersion: number;
  data: unknown;
}

export function parseLegacyCharacterJson(raw: unknown, playerId: string): CharacterSheetPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid JSON file.');
  }

  const record = raw as Record<string, unknown>;

  if (record.characters && typeof record.characters === 'object') {
    const characters = record.characters as Record<string, Record<string, unknown>>;
    const activeId = typeof record.activeId === 'string' ? record.activeId : null;
    const chosen = activeId && characters[activeId]
      ? characters[activeId]
      : Object.values(characters)[0];

    if (!chosen) {
      throw new Error('No characters found in import file.');
    }

    return toSheetPayload(chosen, playerId);
  }

  return toSheetPayload(record, playerId);
}

function toSheetPayload(source: Record<string, unknown>, playerId: string): CharacterSheetPayload {
  const name = typeof source.name === 'string' && source.name.trim().length > 0
    ? source.name.trim()
    : 'Imported character';

  return {
    id: playerId,
    name,
    schemaVersion: 2,
    data: source,
  };
}

export async function savePlayerSheet(sheet: CharacterSheetPayload): Promise<void> {
  const response = await fetch('/api/players/me/sheet', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sheet),
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Could not save imported sheet to the server.');
  }
}

export function installPlayerImportUi(onImported: (sheet: CharacterSheetPayload) => void): void {
  const button = document.getElementById('player-import-json-btn');
  const input = document.getElementById('player-import-json') as HTMLInputElement | null;
  if (!button || !input) {
    return;
  }

  button.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const config = getConfig();
    if (!config.playerId) {
      alert('Player session is not ready.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as unknown;
          const sheet = parseLegacyCharacterJson(parsed, config.playerId!);
          await savePlayerSheet(sheet);
          onImported(sheet);
          alert(`Imported character "${sheet.name}".`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Import failed.';
          alert(message);
        } finally {
          input.value = '';
        }
      })();
    };
    reader.readAsText(file);
  });
}
