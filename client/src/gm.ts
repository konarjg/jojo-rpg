import { installGmApi, loadGmWorkspace, shareMap, broadcastRoll } from './gm-api';
import { getConfig } from './storage-mode';

declare global {
  interface Window {
    GmState?: {
      workspacePayload: (state: unknown) => unknown;
      getActiveMap: (state: unknown, sess: unknown) => { name?: string; tokens?: unknown[] } | null;
    };
  }
}

async function bootstrap(): Promise<void> {
  installGmApi();
  await loadGmWorkspace();
  await loadLegacyGmApp();

  const shareBtn = document.getElementById('btn-share-map');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      void handleShareMap();
    });
  }

  document.addEventListener('jojo-roll-broadcast', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    void broadcastRoll(detail);
  });
}

async function handleShareMap(): Promise<void> {
  if (!window.GmState) {
    alert('GM state not ready.');
    return;
  }

  const bridge = (window as unknown as { __jojoGmBridge?: { getState: () => unknown; getActiveSession: () => unknown } }).__jojoGmBridge;
  if (!bridge) {
    alert('GM bridge not ready.');
    return;
  }

  const state = bridge.getState();
  const activeSession = bridge.getActiveSession();
  if (!state || !activeSession) {
    alert('No active session.');
    return;
  }

  const map = window.GmState.getActiveMap(state, activeSession);
  if (!map) {
    alert('No active map.');
    return;
  }

  const payload = {
    mapName: map.name || 'Map',
    tokens: map.tokens || [],
  };

  await shareMap(payload);
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
