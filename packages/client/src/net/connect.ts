import { Client } from '@colyseus/sdk';
import { DEFAULT_SERVER_PORT, MATCH_ROOM_NAME } from '@stampback/shared';

export type ConnectionStatus =
  | { kind: 'connecting' }
  | { kind: 'connected'; sessionId: string; playerCount: number }
  | { kind: 'error' };

interface MatchStateView {
  playerCount: number;
}

/** Server ünvanı: VITE_SERVER_URL varsa o, yoxdursa eyni host standart portda. */
function serverUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (fromEnv) return fromEnv;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.hostname}:${DEFAULT_SERVER_PORT}`;
}

/**
 * M0 qoşulma yoxlaması: matç otağına qoşulur (və ya yaradır) və oyunçu sayını bildirir.
 * Lobby, otaq kodları və yenidən qoşulma M3-də gəlir.
 */
export async function connectToMatch(onStatus: (status: ConnectionStatus) => void): Promise<void> {
  onStatus({ kind: 'connecting' });
  try {
    const client = new Client(serverUrl());
    const room = await client.joinOrCreate<MatchStateView>(MATCH_ROOM_NAME);
    const report = (state: MatchStateView) =>
      onStatus({ kind: 'connected', sessionId: room.sessionId, playerCount: state.playerCount });
    room.onStateChange(report);
    room.onLeave(() => onStatus({ kind: 'error' }));
  } catch (error) {
    console.error('Connection failed', error);
    onStatus({ kind: 'error' });
  }
}
