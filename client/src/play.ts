import { getConfig } from './storage-mode';
import { startCampaignHub } from './gm-hub';
import {
  clearSharedMap,
  installMapResizeHandler,
  renderSharedMap,
  setMapPanelVisible,
} from './player-map';
import type { RollPayload, SharedMapPayload, SharedViewDto, StickyBoardPayload, StickyNotePayload } from './types/payloads';

declare global {
  interface Window {
    StickyBoard?: {
      mount: (
        boardEl: HTMLElement,
        options: {
          getStickies: () => StickyNotePayload[];
          onChange: () => void;
          addButtonEl?: HTMLElement | null;
          paletteEl?: HTMLElement | null;
          defaultColor?: string;
        },
      ) => { render: () => void } | null;
    };
  }
}

let latestMap: SharedMapPayload | null = null;
let stickySaveTimer: ReturnType<typeof setTimeout> | null = null;
let playerStickyState: StickyNotePayload[] = [];

async function bootstrap(): Promise<void> {
  const config = getConfig();
  setMapPanelVisible(false);

  await loadSharedView(config.roomId);
  await initPlayerStickies();

  startCampaignHub({
    onMapShared: (map) => {
      latestMap = map;
      renderSharedMap(map);
    },
    onMapSharingStopped: () => {
      latestMap = null;
      clearSharedMap();
      setMapPanelVisible(false);
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

async function initPlayerStickies(): Promise<void> {
  const board = document.getElementById('player-sticky-board');
  if (!board || !window.StickyBoard) {
    return;
  }

  const response = await fetch('/api/players/me/stickies', { credentials: 'same-origin' });
  if (response.ok) {
    const payload = (await response.json()) as StickyBoardPayload;
    playerStickyState = payload.stickies ?? [];
  }

  window.StickyBoard.mount(board, {
    getStickies: () => playerStickyState,
    onChange: scheduleStickySave,
    addButtonEl: document.getElementById('player-add-sticky'),
    paletteEl: document.getElementById('player-sticky-color-palette'),
  });
}

function scheduleStickySave(): void {
  if (stickySaveTimer) {
    clearTimeout(stickySaveTimer);
  }

  stickySaveTimer = setTimeout(() => {
    void fetch('/api/players/me/stickies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stickies: playerStickyState }),
      credentials: 'same-origin',
    });
  }, 400);
}

function renderRoll(roll: RollPayload): void {
  const banner = document.getElementById('player-roll-banner');
  if (!banner) {
    return;
  }

  banner.hidden = false;
  const results = roll.results?.length ? roll.results.join(', ') : '';
  banner.textContent = `Roll: ${roll.count}${roll.die} \u2192 ${results}`;
}

void bootstrap();

export {};
