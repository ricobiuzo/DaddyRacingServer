import { randomUUID } from 'node:crypto';
import { IDLE_SESSION_TIMEOUT_MS, MAX_PLAYERS_PER_SESSION, type Player, type Session } from '../types.js';

export class SessionFullError extends Error {
  constructor() {
    super('session full');
  }
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`no session found for identifier "${sessionId}"`);
  }
}

function makeSessionId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Creates and tracks race sessions, lets players join over the LAN,
 * maintains the connected-player list, and tracks each player's kart
 * choice and ready state. Implements:
 * - `b941c66f-...` Create a Race Session, `74034ca1-...` Join an Existing
 *   Race Session, `02c988e4-...` Enforce a Maximum Number of Players Per
 *   Race Session, `a56232c6-...` Clean Up Abandoned or Idle Sessions
 *   (Change 16).
 * - `1860cfc2-...` View Connected Players in a Session (Change 18).
 * - `48a6005f-...` Confirm Ready to Start the Race (Change 20).
 */
export class SessionLobbyModule {
  private sessions = new Map<string, Session>();

  createSession(hostName: string): Session {
    const sessionId = makeSessionId();
    const now = Date.now();
    const host: Player = {
      playerId: randomUUID(),
      name: hostName,
      isHost: true,
      kartId: null,
      ready: false,
      connected: true,
      joinOrder: 0,
      lap: 1,
      lapFraction: 0,
      finished: false,
      timedOut: false,
      raceStartMs: null,
      finishMs: null,
    };
    const session: Session = {
      sessionId,
      players: new Map([[host.playerId, host]]),
      selectedTrackId: null,
      raceStarted: false,
      createdAtMs: now,
      lastActivityMs: now,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  joinSession(sessionId: string, playerName: string): { session: Session; player: Player } {
    const session = this.requireSession(sessionId);
    if (session.players.size >= MAX_PLAYERS_PER_SESSION) {
      throw new SessionFullError();
    }
    const player: Player = {
      playerId: randomUUID(),
      name: playerName,
      isHost: false,
      kartId: null,
      ready: false,
      connected: true,
      joinOrder: session.players.size,
      lap: 1,
      lapFraction: 0,
      finished: false,
      timedOut: false,
      raceStartMs: null,
      finishMs: null,
    };
    session.players.set(player.playerId, player);
    this.touch(session);
    return { session, player };
  }

  selectKart(sessionId: string, playerId: string, kartId: string): Session {
    const session = this.requireSession(sessionId);
    const player = this.requirePlayer(session, playerId);
    player.kartId = kartId;
    this.touch(session);
    return session;
  }

  /** Returns true if every connected player is ready and ready to start. */
  setReady(sessionId: string, playerId: string, ready: boolean): { session: Session; shouldStart: boolean } {
    const session = this.requireSession(sessionId);
    const player = this.requirePlayer(session, playerId);
    player.ready = ready;
    this.touch(session);
    const players = [...session.players.values()].filter((p) => p.connected);
    const shouldStart =
      !session.raceStarted && players.length > 0 && players.every((p) => p.ready && p.kartId);
    return { session, shouldStart };
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  listSessionIds(): string[] {
    return [...this.sessions.keys()];
  }

  removePlayer(sessionId: string, playerId: string): void {
    const session = this.sessions.get(sessionId);
    session?.players.delete(playerId);
  }

  touch(session: Session): void {
    session.lastActivityMs = Date.now();
  }

  /** Clean Up Abandoned or Idle Sessions (`a56232c6-...`): removes any session idle for IDLE_SESSION_TIMEOUT_MS. */
  sweepIdleSessions(nowMs: number = Date.now()): string[] {
    const removed: string[] = [];
    for (const [sessionId, session] of this.sessions) {
      const everyoneDisconnected = [...session.players.values()].every((p) => !p.connected);
      const idleTooLong = nowMs - session.lastActivityMs >= IDLE_SESSION_TIMEOUT_MS;
      if (session.players.size === 0 || (idleTooLong && (everyoneDisconnected || !session.raceStarted))) {
        this.sessions.delete(sessionId);
        removed.push(sessionId);
      }
    }
    return removed;
  }

  private requireSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }

  private requirePlayer(session: Session, playerId: string): Player {
    const player = session.players.get(playerId);
    if (!player) throw new Error(`player ${playerId} is not in session ${session.sessionId}`);
    return player;
  }
}
