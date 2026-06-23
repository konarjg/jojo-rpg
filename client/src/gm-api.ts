import { getConfig } from './storage-mode';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

const MAP_SHARING_STORAGE_PREFIX = 'jojo-map-sharing:';

export function mapSharingStorageKey(roomId: string): string {
  return MAP_SHARING_STORAGE_PREFIX + roomId;
}

export function isMapSharingActive(roomId: string): boolean {
  try {
    return sessionStorage.getItem(mapSharingStorageKey(roomId)) === '1';
  } catch {
    return false;
  }
}

export function setMapSharingActive(roomId: string, active: boolean): void {
  try {
    const key = mapSharingStorageKey(roomId);
    if (active) {
      sessionStorage.setItem(key, '1');
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function installGmApi(): void {
  const config = getConfig();

  window.JojoGmStorage = {
    save(payload: unknown) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void fetch(`/api/rooms/${config.roomId}/workspace`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'same-origin',
        });
      }, 400);
    },
  };
}

export async function loadGmWorkspace(): Promise<void> {
  const config = getConfig();
  const response = await fetch(`/api/rooms/${config.roomId}/workspace`, { credentials: 'same-origin' });
  if (response.ok) {
    window.JOJO_INITIAL_WORKSPACE = await response.json();
  }
}

export async function shareMap(mapPayload: unknown): Promise<void> {
  const config = getConfig();
  const response = await fetch(`/api/rooms/${config.roomId}/share-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapPayload),
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Could not share map.');
  }
}

export async function stopShareMap(): Promise<void> {
  const config = getConfig();
  const response = await fetch(`/api/rooms/${config.roomId}/stop-share-map`, {
    method: 'POST',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Could not stop map sharing.');
  }
}

export async function broadcastRoll(rollPayload: unknown): Promise<void> {
  const config = getConfig();
  await fetch(`/api/rooms/${config.roomId}/broadcast-roll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rollPayload),
    credentials: 'same-origin',
  });
}

declare global {
  interface Window {
    __jojoMapShareActive?: boolean;
  }
}
