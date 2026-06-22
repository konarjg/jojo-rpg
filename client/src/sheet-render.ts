import type { CharacterSheetPayload } from './legacy-import';

export function renderSheetPreview(sheet: CharacterSheetPayload): void {
  const root = document.getElementById('sheet-root');
  if (!root) {
    return;
  }

  root.innerHTML = `<pre class="sheet-json-preview">${escapeHtml(JSON.stringify(sheet, null, 2))}</pre>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
