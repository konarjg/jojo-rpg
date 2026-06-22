export interface JojoConfig {
  roomId: string;
  roomCode: string;
  playerId?: string;
  mode: 'gm' | 'play' | 'sheet';
  readOnly?: boolean;
}

declare global {
  interface Window {
    JOJO_CONFIG: JojoConfig;
    JOJO_STORAGE_MODE: 'local' | 'server';
    JOJO_INITIAL_WORKSPACE?: unknown;
    JojoGmStorage?: { save: (payload: unknown) => void; load?: () => Promise<unknown> };
  }
}

export function getConfig(): JojoConfig {
  return window.JOJO_CONFIG;
}

export function isServerMode(): boolean {
  return window.JOJO_STORAGE_MODE === 'server';
}
