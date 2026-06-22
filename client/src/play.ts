import { getConfig } from './storage-mode';
import { startCampaignHub } from './gm-hub';
import type { RollPayload, SharedMapPayload, SharedViewDto, StickyBoardPayload } from './types/payloads';

async function bootstrap(): Promise<void> {
  const config = getConfig();
  await loadSharedView(config.roomId);
  await loadStickies();
  startCampaignHub({
    onMapShared: renderMap,
    onRoll: renderRoll,
  });
}

async function loadSharedView(roomId: string): Promise<void> {
  const response = await fetch(`/api/rooms/${roomId}/shared-view`, { credentials: 'same-origin' });
  if (!response.ok) return;
  const view = (await response.json()) as SharedViewDto;
  if (view.sharedMap) renderMap(view.sharedMap);
  if (view.lastRoll) renderRoll(view.lastRoll);
}

async function loadStickies(): Promise<void> {
  const response = await fetch('/api/players/me/stickies', { credentials: 'same-origin' });
  if (!response.ok) return;
  const board = (await response.json()) as StickyBoardPayload;
  renderStickies(board);
}

function renderMap(map: SharedMapPayload): void {
  const panel = document.getElementById('player-map-panel');
  if (!panel) return;
  panel.innerHTML = `<h2>${escapeHtml(map.mapName)}</h2><p>${map.tokens.length} token(s) on map.</p>`;
}

function renderRoll(roll: RollPayload): void {
  const banner = document.getElementById('player-roll-banner');
  if (!banner) return;
  banner.hidden = false;
  banner.textContent = `Roll: ${roll.count}${roll.die} → ${roll.results.join(', ')}`;
}

function renderStickies(board: StickyBoardPayload): void {
  const panel = document.getElementById('player-sticky-panel');
  if (!panel) return;
  panel.innerHTML = board.stickies
    .map((s) => `<div class="gm-sticky" style="background:${s.color}">${escapeHtml(s.text)}</div>`)
    .join('');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let stickyTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleStickySave(board: StickyBoardPayload): void {
  if (stickyTimer) clearTimeout(stickyTimer);
  stickyTimer = setTimeout(() => {
    void fetch('/api/players/me/stickies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
      credentials: 'same-origin',
    });
  }, 400);
}

void bootstrap();

export {};
