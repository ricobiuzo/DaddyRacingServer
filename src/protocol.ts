import type { KartInputMessage, Session, TrackId } from './types.js';

export type ClientMessage =
  | { type: 'createSession'; name: string }
  | { type: 'joinSession'; sessionId: string; name: string }
  | { type: 'selectKart'; kartId: string }
  | { type: 'selectTrack'; trackId: string }
  | { type: 'setReady'; ready: boolean }
  | { type: 'input'; input: KartInputMessage };

export interface SerializedPlayer {
  playerId: string;
  name: string;
  isHost: boolean;
  kartId: string | null;
  ready: boolean;
  connected: boolean;
  lap: number;
  finished: boolean;
  timedOut: boolean;
}

export interface SerializedSessionState {
  sessionId: string;
  players: SerializedPlayer[];
  selectedTrackId: TrackId | null;
  raceStarted: boolean;
}

export type ServerMessage =
  | { type: 'joined'; playerId: string; state: SerializedSessionState }
  | { type: 'state'; state: SerializedSessionState }
  | { type: 'hostReassigned' }
  | { type: 'error'; message: string };

export function serializeSession(session: Session): SerializedSessionState {
  return {
    sessionId: session.sessionId,
    selectedTrackId: session.selectedTrackId,
    raceStarted: session.raceStarted,
    players: [...session.players.values()].map((p) => ({
      playerId: p.playerId,
      name: p.name,
      isHost: p.isHost,
      kartId: p.kartId,
      ready: p.ready,
      connected: p.connected,
      lap: p.lap,
      finished: p.finished,
      timedOut: p.timedOut,
    })),
  };
}
