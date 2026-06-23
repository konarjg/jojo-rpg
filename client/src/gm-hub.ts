import * as signalR from '@microsoft/signalr';
import type { SharedMapPayload } from './types/payloads';
import type { RollPayload } from './types/payloads';
import { getConfig } from './storage-mode';

let connection: signalR.HubConnection | null = null;

export function startCampaignHub(handlers: {
  onMapShared?: (map: SharedMapPayload) => void;
  onMapSharingStopped?: () => void;
  onRoll?: (roll: RollPayload) => void;
}): signalR.HubConnection {
  if (connection) return connection;

  connection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/campaign')
    .withAutomaticReconnect()
    .build();

  if (handlers.onMapShared) {
    connection.on('MapShared', handlers.onMapShared);
  }

  if (handlers.onMapSharingStopped) {
    connection.on('MapSharingStopped', handlers.onMapSharingStopped);
  }

  if (handlers.onRoll) {
    connection.on('RollBroadcast', handlers.onRoll);
  }

  void connection.start();
  return connection;
}

export function getHub(): signalR.HubConnection | null {
  return connection;
}

export function hubRoomGroup(): string {
  return `room:${getConfig().roomId}`;
}
