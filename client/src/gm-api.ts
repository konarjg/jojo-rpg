import { getConfig } from './storage-mode';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

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
  await fetch(`/api/rooms/${config.roomId}/share-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapPayload),
    credentials: 'same-origin',
  });
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
