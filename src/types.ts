// Authoritative domain types for the DaddyRacing Session Server.
//
// The DaddyRacing Game Client's `src/net/SessionTransport.ts` documents its
// own proposed wire contract (no shared package exists between the two
// repos yet). This server implements that same shape so the two can talk
// once both are deployed; see docs/PROTOCOL.md for the message-level detail
// this module adds (session/join/kart/track/ready requests and state
// broadcasts over one WebSocket connection per player).

export const MAX_PLAYERS_PER_SESSION = 8; // Enforce a Maximum Number of Players Per Race Session
export const TOTAL_LAPS = 5;
export const RACE_TIMEOUT_MS = 10 * 60 * 1000; // Race Start/Finish & 10-Minute Timeout Handling
export const IDLE_SESSION_TIMEOUT_MS = 5 * 60 * 1000; // Clean Up Abandoned or Idle Sessions
export const RECONNECT_GRACE_MS = 5 * 1000; // Reconnect After a Dropped Connection

export type TrackId =
  | 'green-hills'
  | 'city-nights'
  | 'sandy-desert'
  | 'wet-speed-way'
  | 'forest-ruins';

export interface TrackDefinition {
  id: TrackId;
  displayName: string;
  timeOfDay: 'day' | 'night';
  surface: 'dry' | 'sandy-dry' | 'wet';
  /** Relative grip multiplier applied to kart handling; 1.0 is the dry-asphalt baseline. */
  gripMultiplier: number;
}

// Race Track Environments (5 Tracks) — Changes 24-28.
export const TRACKS: readonly TrackDefinition[] = [
  { id: 'green-hills', displayName: 'Green Hills', timeOfDay: 'day', surface: 'dry', gripMultiplier: 1.0 },
  { id: 'city-nights', displayName: 'City Nights', timeOfDay: 'night', surface: 'dry', gripMultiplier: 1.0 },
  { id: 'sandy-desert', displayName: 'Sandy Desert', timeOfDay: 'day', surface: 'sandy-dry', gripMultiplier: 0.85 },
  { id: 'wet-speed-way', displayName: 'Wet Speed Way', timeOfDay: 'day', surface: 'wet', gripMultiplier: 0.7 },
  { id: 'forest-ruins', displayName: 'Forest Ruins', timeOfDay: 'day', surface: 'wet', gripMultiplier: 0.75 },
];

export function isTrackId(value: string): value is TrackId {
  return TRACKS.some((t) => t.id === value);
}

export interface Player {
  playerId: string;
  name: string;
  isHost: boolean;
  kartId: string | null;
  ready: boolean;
  connected: boolean;
  joinOrder: number;
  lap: number;
  lapFraction: number;
  finished: boolean;
  timedOut: boolean;
  raceStartMs: number | null;
  finishMs: number | null;
}

export interface Session {
  sessionId: string;
  players: Map<string, Player>;
  selectedTrackId: TrackId | null;
  raceStarted: boolean;
  createdAtMs: number;
  lastActivityMs: number;
}

export interface KartInputMessage {
  accelerate: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
}
