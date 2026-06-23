import { getConfig } from './storage-mode';
import { startCampaignHub } from './gm-hub';
import { clearSharedMap, installMapResizeHandler, renderSharedMap } from './player-map';
import type { RollPayload, SharedMapPayload, SharedViewDto, StickyBoardPayload } from './types/payloads';

let latestMap: SharedMapPayload | null = null;

async function bootstrap(): Promise<void> {
  const config = getConfig();
  await loadSharedView(config.roomId);

  if (config.mode !== 'player-view') {
    await loadStickies();
  }

  startCampaignHub({
    onMapShared: (map) => {
      latestMap = map;
      renderSharedMap(map);
    },
    onMapSharingStopped: () => {
      latestMap = null;
      clearSharedMap();
    },
    onRoll: renderRoll,
  });

  installMapResizeHandler(() => latestMap);
}

async function loadSharedView(roomId: string): Promise<void> {
  const response = await fetch(`/api/rooms/${roomId}/shared-view`, { credentials: 'same-origin' });
  if (!response.ok) {
    return;
  }

  const view = (await response.json()) as SharedViewDto;
  if (view.sharedMap) {
    latestMap = view.sharedMap;
    renderSharedMap(view.sharedMap);
  }

  if (view.lastRoll) {
    renderRoll(view.lastRoll);
  }
}

async function loadStickies(): Promise<void> {
  const response = await fetch('/api/players/me/stickies', { credentials: 'same-origin' });
  if (!response.ok) {
    return;
  }

  const board = (await response.json()) as StickyBoardPayload;
  renderStickies(board);
}

function renderRoll(roll: RollPayload): void {
  const banner = document.getElementById('player-roll-banner');
  if (!banner) {
    return;
  }

  banner.hidden = false;
  const results = roll.results?.length ? roll.results.join(', ') : '';
  banner.textContent = `Roll: ${roll.count}${roll.die} → ${results}`;
}

function renderStickies(board: StickyBoardPayload): void {
  const panel = document.getElementById('player-sticky-panel');
  if (!panel) {
    return;
  }

  panel.innerHTML = board.stickies
    .map((sticky) => `<div class="gm-sticky" style="background:${escapeHtml(sticky.color)}">${escapeHtml(sticky.text)}</div>`)
    .join('');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

void bootstrap();

export {};
