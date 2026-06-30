export interface GmWorkspacePayload {
  schemaVersion: number;
  activeSessionId: string;
  autoOpenPlayer: boolean;
  npcs: unknown;
  globalMaps: unknown;
  snapshots: unknown;
  sessions: unknown;
}

export interface SharedMapPayload {
  mapName: string;
  tokens: MapTokenPayload[];
}

export interface MapTokenPayload {
  id: string;
  label?: string;
  type?: string;
  x: number;
  y: number;
  col?: number;
  row?: number;
  color?: string;
}

export interface RollPayload {
  mode?: 'skill-test' | 'dc' | 'plain' | string;
  rollMode?: 'normal' | 'stand' | string;
  label?: string;
  die: string;
  count: number;
  results: number[];
  tn?: number;
  skillRank?: number;
  tagged?: boolean;
  totalSuccesses?: number;
  totalComplications?: number;
  totalDamage?: number;
  totalEffects?: number;
  perDie?: unknown[];
}

export interface StickyBoardPayload {
  stickies: StickyNotePayload[];
}

export interface StickyNotePayload {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
}

export interface CharacterSheetPayload {
  id: string;
  name: string;
  schemaVersion: number;
  data: unknown;
}

export interface SharedViewDto {
  sharedMap?: SharedMapPayload | null;
  lastRoll?: RollPayload | null;
  mapSharedAt?: string | null;
}
