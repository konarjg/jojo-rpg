import {
  isMapSharingActive,
  installGmApi,
  loadGmWorkspace,
  setMapSharingActive,
  shareMap,
  stopShareMap,
  broadcastRoll,
} from './gm-api';
import { getConfig } from './storage-mode';

declare global {
  interface Window {
    GmState?: {
      workspacePayload: (state: unknown) => unknown;
      getActiveMap: (state: unknown, sess: unknown) => { name?: string; tokens?: unknown[] } | null;
    };
    __jojoGmBridge?: {
      getState: () => unknown;
      getActiveSession: () => unknown;
    };
  }
}

const SHARE_BUTTON_LABEL_START = 'Share map';
const SHARE_BUTTON_LABEL_STOP = 'Stop sharing';

let sharePushTimer: ReturnType<typeof setTimeout> | null = null;

async function bootstrap(): Promise<void> {
  installGmApi();
  await loadGmWorkspace();
  await loadLegacyGmApp();

  const config = getConfig();
  const sharingActive = isMapSharingActive(config.roomId);
  window.__jojoMapShareActive = sharingActive;
  updateShareButton(sharingActive);

  const shareBtn = document.getElementById('btn-share-map');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      void toggleMapSharing();
    });
  }

  document.addEventListener('jojo-roll-broadcast', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    void broadcastRoll(detail);
  });

  document.addEventListener('jojo-map-share-sync', () => {
    scheduleMapSharePush();
  });
}

function updateShareButton(sharingActive: boolean): void {
  const shareBtn = document.getElementById('btn-share-map');
  if (!shareBtn) {
    return;
  }

  shareBtn.textContent = sharingActive ? SHARE_BUTTON_LABEL_STOP : SHARE_BUTTON_LABEL_START;
  shareBtn.classList.toggle('pick-btn--accent', !sharingActive);
  shareBtn.setAttribute('aria-pressed', sharingActive ? 'true' : 'false');
}

async function toggleMapSharing(): Promise<void> {
  const config = getConfig();
  if (window.__jojoMapShareActive) {
    try {
      await stopShareMap();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not stop sharing.';
      alert(message);
      return;
    }

    window.__jojoMapShareActive = false;
    setMapSharingActive(config.roomId, false);
    updateShareButton(false);
    return;
  }

  try {
    await pushCurrentMap();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not share map.';
    alert(message);
    return;
  }

  window.__jojoMapShareActive = true;
  setMapSharingActive(config.roomId, true);
  updateShareButton(true);
}

function scheduleMapSharePush(): void {
  if (!window.__jojoMapShareActive) {
    return;
  }

  if (sharePushTimer) {
    clearTimeout(sharePushTimer);
  }

  sharePushTimer = setTimeout(() => {
    sharePushTimer = null;
    void pushCurrentMap();
  }, 150);
}

async function pushCurrentMap(): Promise<void> {
  if (!window.GmState) {
    throw new Error('GM state not ready.');
  }

  const bridge = window.__jojoGmBridge;
  if (!bridge) {
    throw new Error('GM bridge not ready.');
  }

  const state = bridge.getState();
  const activeSession = bridge.getActiveSession();
  if (!state || !activeSession) {
    throw new Error('No active session.');
  }

  const map = window.GmState.getActiveMap(state, activeSession);
  if (!map) {
    throw new Error('No active map.');
  }

  await shareMap({
    mapName: map.name || 'Map',
    tokens: map.tokens || [],
  });
}

function loadLegacyGmApp(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/js/legacy/gm-app.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load gm-app.js'));
    document.body.appendChild(script);
  });
}

void bootstrap();

export {};
