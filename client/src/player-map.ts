import type { SharedMapPayload } from './types/payloads';

const MAP_COLS = 24;
const MAP_ROWS = 18;
const MIN_GRID_PX = 12;

const TOKEN_CLASSES: Record<string, string> = {
  player: 'gm-token--player',
  npc: 'gm-token--npc',
  boss: 'gm-token--boss',
  cover: 'gm-token--cover',
  obstacle: 'gm-token--obstacle',
};

interface MapTokenLike {
  id?: string;
  type?: string;
  col?: number;
  row?: number;
  label?: string;
  x?: number;
  y?: number;
  color?: string;
}

function syncMapGrid(canvas: HTMLElement): number {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width < 8 || height < 8) {
    return MIN_GRID_PX;
  }

  let grid = Math.floor(Math.min(width / MAP_COLS, height / MAP_ROWS));
  if (grid < MIN_GRID_PX) {
    grid = MIN_GRID_PX;
  }

  canvas.style.setProperty('--gm-grid-size', `${grid}px`);
  return grid;
}

function readGridSize(canvas: HTMLElement): number {
  const raw = getComputedStyle(canvas).getPropertyValue('--gm-grid-size').trim();
  const parsed = parseInt(raw, 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  return syncMapGrid(canvas);
}

function tokenPixel(token: MapTokenLike, grid: number): { left: number; top: number } {
  if (token.col != null && token.row != null) {
    return { left: token.col * grid, top: token.row * grid };
  }

  return { left: token.x ?? 0, top: token.y ?? 0 };
}

function tokenClassName(token: MapTokenLike): string {
  const type = (token.type ?? 'player').toLowerCase();
  return TOKEN_CLASSES[type] ?? TOKEN_CLASSES.player;
}

function tokenLabel(token: MapTokenLike): string {
  if (token.label && token.label.trim().length > 0) {
    return token.label;
  }

  const type = token.type ?? 'player';
  const labels: Record<string, string> = {
    player: 'Player',
    npc: 'NPC',
    boss: 'Boss',
    cover: 'Cover',
    obstacle: 'Obstacle',
  };

  return labels[type.toLowerCase()] ?? type;
}

export function setMapPanelVisible(visible: boolean): void {
  const panel = document.getElementById('player-map-panel');
  if (!panel) {
    return;
  }

  panel.hidden = !visible;
  panel.classList.toggle('player-map-panel--visible', visible);
}

export function clearSharedMap(): void {
  const title = document.getElementById('player-map-title');
  const canvas = document.getElementById('player-map-canvas');
  if (title) {
    title.hidden = true;
    title.textContent = '';
  }

  if (canvas) {
    canvas.innerHTML = '';
  }
}

export function renderSharedMap(map: SharedMapPayload): void {
  const title = document.getElementById('player-map-title');
  const canvas = document.getElementById('player-map-canvas');
  if (!canvas) {
    return;
  }

  setMapPanelVisible(true);

  if (title) {
    title.hidden = false;
    title.textContent = map.mapName;
  }

  canvas.innerHTML = '';
  syncMapGrid(canvas);
  const grid = readGridSize(canvas);

  map.tokens.forEach((rawToken) => {
    const token = rawToken as MapTokenLike;
    const element = document.createElement('div');
    element.className = `gm-token ${tokenClassName(token)}`;
    const position = tokenPixel(token, grid);
    element.style.left = `${position.left}px`;
    element.style.top = `${position.top}px`;
    element.title = tokenLabel(token);
    element.setAttribute('aria-label', tokenLabel(token));
    canvas.appendChild(element);
  });
}

export function installMapResizeHandler(getMap: () => SharedMapPayload | null): void {
  const canvas = document.getElementById('player-map-canvas');
  if (!canvas || typeof ResizeObserver === 'undefined') {
    return;
  }

  let frame: number | null = null;
  new ResizeObserver(() => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
    }

    frame = requestAnimationFrame(() => {
      frame = null;
      const map = getMap();
      if (map) {
        renderSharedMap(map);
      }
    });
  }).observe(canvas);
}
