import { getConfig } from './storage-mode';

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
  if (!response.ok) {
    return;
  }

  const sheet = await response.json();
  const root = document.getElementById('sheet-root');
  if (root) {
    root.innerHTML = `<pre class="sheet-json-preview">${escapeHtml(JSON.stringify(sheet, null, 2))}</pre>`;
  }

  if (config.mode === 'play' && !config.readOnly) {
    installSheetSave(sheet);
  }
}

function installSheetSave(initialSheet: unknown): void {
  let currentSheet = initialSheet;

  window.addEventListener('jojo-sheet-changed', (event: Event) => {
    currentSheet = (event as CustomEvent).detail;
    scheduleSheetSave(currentSheet);
  });

  (window as unknown as { jojoSheet?: { get: () => unknown; set: (value: unknown) => void } }).jojoSheet = {
    get: () => currentSheet,
    set: (value: unknown) => {
      currentSheet = value;
      scheduleSheetSave(value);
    },
  };
}

function scheduleSheetSave(sheet: unknown): void {
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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

void bootstrap();

export {};
