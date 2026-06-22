import { getConfig } from './storage-mode';
import { installPlayerImportUi, type CharacterSheetPayload } from './legacy-import';
import { renderSheetPreview } from './sheet-render';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function bootstrap(): Promise<void> {
  const config = getConfig();

  if (config.readOnly) {
    document.querySelectorAll('input, select, textarea, button').forEach((el) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        el.disabled = true;
      }
    });
  }

  const playerId = config.playerId;
  if (!playerId) {
    return;
  }

  const response = await fetch(`/api/players/${playerId}/sheet`, { credentials: 'same-origin' });
  if (response.ok) {
    const sheet = (await response.json()) as CharacterSheetPayload;
    renderSheetPreview(sheet);
    if (config.mode === 'play' && !config.readOnly) {
      installSheetSave(sheet);
    }
  }

  if (config.mode === 'play' && !config.readOnly) {
    installPlayerImportUi((sheet) => {
      renderSheetPreview(sheet);
      installSheetSave(sheet);
    });
  }
}

function installSheetSave(initialSheet: CharacterSheetPayload): void {
  let currentSheet: CharacterSheetPayload = initialSheet;

  window.addEventListener('jojo-sheet-changed', (event: Event) => {
    currentSheet = (event as CustomEvent).detail as CharacterSheetPayload;
    scheduleSheetSave(currentSheet);
  });

  (window as unknown as { jojoSheet?: { get: () => CharacterSheetPayload; set: (value: CharacterSheetPayload) => void } }).jojoSheet = {
    get: () => currentSheet,
    set: (value: CharacterSheetPayload) => {
      currentSheet = value;
      scheduleSheetSave(value);
    },
  };
}

function scheduleSheetSave(sheet: CharacterSheetPayload): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    void fetch('/api/players/me/sheet', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sheet),
      credentials: 'same-origin',
    });
  }, 400);
}

void bootstrap();

export {};
