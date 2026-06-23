import type { MapTokenPayload, SharedMapPayload } from './types/payloads';

const MAP_COLS = 24;
const MAP_ROWS = 18;
const MIN_GRID_PX = 12;
const TOKEN_INSET = 2;

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

interface PlayerMapInteractionOptions {
  getMap: () => SharedMapPayload | null;
  onMapChange: (map: SharedMapPayload) => void;
  onCommitMoves: (moves: { id: string; col: number; row: number }[]) => void;
}

let mapPanelOpen = true;
let notesPanelOpen = true;
let sheetPanelOpen = true;
let interactionInstalled = false;
let dragState: { tokenId: string; offsetX: number; offsetY: number } | null = null;
let interactionOptions: PlayerMapInteractionOptions | null = null;
let panelLayoutMapRefresh: (() => void) | null = null;

function notifyPanelLayoutChange(): void {
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    panelLayoutMapRefresh?.();
  });
}

export function setPanelLayoutMapRefresh(refresh: () => void): void {
  panelLayoutMapRefresh = refresh;
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

function pointerToCell(localX: number, localY: number, grid: number): { col: number; row: number } {
  return {
    col: Math.min(MAP_COLS - 1, Math.max(0, Math.floor(localX / grid))),
    row: Math.min(MAP_ROWS - 1, Math.max(0, Math.floor(localY / grid))),
  };
}

function tokenPixel(token: MapTokenLike, grid: number): { left: number; top: number } {
  if (token.col != null && token.row != null) {
    return {
      left: token.col * grid + TOKEN_INSET,
      top: token.row * grid + TOKEN_INSET,
    };
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

function isPlayerToken(token: MapTokenLike): boolean {
  return (token.type ?? 'player').toLowerCase() === 'player';
}

function findTokenElement(canvas: HTMLElement, tokenId: string): HTMLElement | null {
  return canvas.querySelector(`.gm-token[data-token-id="${tokenId}"]`);
}

function applyTokenPosition(element: HTMLElement, token: MapTokenLike, grid: number): void {
  const position = tokenPixel(token, grid);
  element.style.left = `${position.left}px`;
  element.style.top = `${position.top}px`;
}

function updatePlayPanelToggleButtons(): void {
  document.querySelectorAll('.play-panel-toggle[data-panel]').forEach((button) => {
    const panel = button.getAttribute('data-panel');
    const isOpen =
      panel === 'notes' ? notesPanelOpen : panel === 'map' ? mapPanelOpen : panel === 'sheet' ? sheetPanelOpen : false;
    button.classList.toggle('play-panel-toggle--active', isOpen);
    button.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
  });
}

export function setSheetPanelVisible(visible: boolean): void {
  sheetPanelOpen = visible;
  const panel = document.getElementById('player-sheet-panel');
  if (panel) {
    panel.classList.toggle('play-sheet-panel--closed', !visible);
    panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  updatePlayPanelToggleButtons();
  notifyPanelLayoutChange();
}

export function setNotesPanelVisible(visible: boolean): void {
  notesPanelOpen = visible;
  const panel = document.querySelector('.play-notes-sidebar');
  if (panel) {
    panel.classList.toggle('play-notes-sidebar--closed', !visible);
    panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  updatePlayPanelToggleButtons();
  notifyPanelLayoutChange();
}

export function setMapPanelVisible(visible: boolean): void {
  mapPanelOpen = visible;
  const panel = document.getElementById('player-map-panel');
  if (!panel) {
    return;
  }

  panel.classList.toggle('play-map-sidebar--closed', !visible);
  panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
  updatePlayPanelToggleButtons();
  notifyPanelLayoutChange();
}

function installSheetCloseButton(): void {
  const toolbar = document.querySelector('#player-sheet-panel .sheet-toolbar-actions');
  if (!toolbar || toolbar.querySelector('.play-panel-close[data-panel="sheet"]')) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gm-panel-close play-panel-close';
  button.dataset.panel = 'sheet';
  button.title = 'Hide character sheet';
  button.innerHTML = '&times;';
  toolbar.appendChild(button);
}

export function initPlayPanels(): void {
  setNotesPanelVisible(true);
  setMapPanelVisible(true);
  setSheetPanelVisible(true);
  installSheetCloseButton();
  renderEmptyMap();

  document.querySelectorAll('.play-panel-toggle[data-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = button.getAttribute('data-panel');
      if (panel === 'notes') {
        setNotesPanelVisible(!notesPanelOpen);
      } else if (panel === 'map') {
        setMapPanelVisible(!mapPanelOpen);
      } else if (panel === 'sheet') {
        setSheetPanelVisible(!sheetPanelOpen);
      }
    });
  });

  document.querySelectorAll('.play-panel-close[data-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = button.getAttribute('data-panel');
      if (panel === 'notes') {
        setNotesPanelVisible(false);
      } else if (panel === 'map') {
        setMapPanelVisible(false);
      } else if (panel === 'sheet') {
        setSheetPanelVisible(false);
      }
    });
  });
}

export function renderEmptyMap(): void {
  const title = document.getElementById('player-map-title');
  const canvas = document.getElementById('player-map-canvas');
  if (title) {
    title.textContent = 'Map';
  }

  if (canvas) {
    canvas.innerHTML = '';
    syncMapGrid(canvas);
  }
}

export function clearSharedMap(): void {
  renderEmptyMap();
}

export function renderSharedMap(map: SharedMapPayload): void {
  const title = document.getElementById('player-map-title');
  const canvas = document.getElementById('player-map-canvas');
  if (!canvas) {
    return;
  }

  if (title) {
    title.textContent = map.mapName;
  }

  canvas.innerHTML = '';
  syncMapGrid(canvas);
  const grid = readGridSize(canvas);

  map.tokens.forEach((rawToken) => {
    const token = rawToken as MapTokenLike;
    const element = document.createElement('div');
    const classes = ['gm-token', tokenClassName(token)];
    if (isPlayerToken(token)) {
      classes.push('gm-token--draggable');
    }

    element.className = classes.join(' ');
    if (token.id) {
      element.dataset.tokenId = token.id;
    }

    applyTokenPosition(element, token, grid);
    element.title = tokenLabel(token);
    element.setAttribute('aria-label', tokenLabel(token));
    canvas.appendChild(element);
  });
}

function commitDraggedToken(tokenId: string, col: number, row: number): void {
  if (!interactionOptions) {
    return;
  }

  const map = interactionOptions.getMap();
  if (!map) {
    return;
  }

  const tokens = map.tokens.map((token) => {
    if (token.id !== tokenId) {
      return token;
    }

    return { ...token, col, row };
  });

  const updatedMap: SharedMapPayload = { ...map, tokens };
  interactionOptions.onMapChange(updatedMap);
  interactionOptions.onCommitMoves([{ id: tokenId, col, row }]);
}

function installPlayerMapInteraction(options: PlayerMapInteractionOptions): void {
  interactionOptions = options;
  if (interactionInstalled) {
    return;
  }

  const canvas = document.getElementById('player-map-canvas');
  if (!canvas) {
    return;
  }

  interactionInstalled = true;

  canvas.addEventListener('mousedown', (event) => {
    const target = event.target as HTMLElement;
    const tokenElement = target.closest('.gm-token--draggable') as HTMLElement | null;
    if (!tokenElement || !tokenElement.dataset.tokenId) {
      return;
    }

    event.preventDefault();
    const grid = readGridSize(canvas);
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const cell = pointerToCell(localX, localY, grid);
    dragState = {
      tokenId: tokenElement.dataset.tokenId,
      offsetX: localX - cell.col * grid,
      offsetY: localY - cell.row * grid,
    };
    tokenElement.classList.add('gm-token--dragging');
  });

  document.addEventListener('mousemove', (event) => {
    if (!dragState) {
      return;
    }

    const canvasElement = document.getElementById('player-map-canvas');
    if (!canvasElement) {
      return;
    }

    const grid = readGridSize(canvasElement);
    const rect = canvasElement.getBoundingClientRect();
    const localX = event.clientX - rect.left - dragState.offsetX;
    const localY = event.clientY - rect.top - dragState.offsetY;
    const cell = pointerToCell(localX, localY, grid);
    const tokenElement = findTokenElement(canvasElement, dragState.tokenId);
    if (tokenElement) {
      applyTokenPosition(tokenElement, { col: cell.col, row: cell.row }, grid);
    }
  });

  document.addEventListener('mouseup', () => {
    if (!dragState) {
      return;
    }

    const canvasElement = document.getElementById('player-map-canvas');
    const tokenId = dragState.tokenId;
    dragState = null;

    if (!canvasElement) {
      return;
    }

    const tokenElement = findTokenElement(canvasElement, tokenId);
    if (tokenElement) {
      tokenElement.classList.remove('gm-token--dragging');
      const grid = readGridSize(canvasElement);
      const left = parseFloat(tokenElement.style.left || '0') - TOKEN_INSET;
      const top = parseFloat(tokenElement.style.top || '0') - TOKEN_INSET;
      const cell = pointerToCell(left, top, grid);
      commitDraggedToken(tokenId, cell.col, cell.row);
    }
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
      } else {
        renderEmptyMap();
      }
    });
  }).observe(canvas);
}

export { installPlayerMapInteraction };
