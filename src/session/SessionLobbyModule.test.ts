import { describe, expect, it } from 'vitest';
import { SessionLobbyModule, SessionFullError, SessionNotFoundError } from './SessionLobbyModule.js';
import { MAX_PLAYERS_PER_SESSION, IDLE_SESSION_TIMEOUT_MS } from '../types.js';

describe('SessionLobbyModule (Create/Join, Player List, Ready, Capacity, Idle Cleanup)', () => {
  it('creates a session with the creator as host', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    expect(session.players.size).toBe(1);
    expect([...session.players.values()][0]?.isHost).toBe(true);
  });

  it('lets another player join by session identifier', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    const { player } = lobby.joinSession(session.sessionId, 'Guest');
    expect(session.players.size).toBe(2);
    expect(player.isHost).toBe(false);
  });

  it('rejects joining a session identifier that does not exist', () => {
    const lobby = new SessionLobbyModule();
    expect(() => lobby.joinSession('NOPE12', 'Guest')).toThrow(SessionNotFoundError);
  });

  it('enforces a maximum of 8 players per session', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    for (let i = 1; i < MAX_PLAYERS_PER_SESSION; i += 1) {
      lobby.joinSession(session.sessionId, `Guest ${i}`);
    }
    expect(session.players.size).toBe(MAX_PLAYERS_PER_SESSION);
    expect(() => lobby.joinSession(session.sessionId, 'One Too Many')).toThrow(SessionFullError);
  });

  it('starts the race once every connected player has a kart and is ready', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    const [host] = session.players.values();
    lobby.selectKart(session.sessionId, host!.playerId, 'kart-sprinter');
    const { shouldStart } = lobby.setReady(session.sessionId, host!.playerId, true);
    expect(shouldStart).toBe(true);
  });

  it('does not start the race until every player is ready', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    const { player: guest } = lobby.joinSession(session.sessionId, 'Guest');
    const [host] = session.players.values();
    lobby.selectKart(session.sessionId, host!.playerId, 'kart-sprinter');
    lobby.selectKart(session.sessionId, guest.playerId, 'kart-tank');
    const afterHostReady = lobby.setReady(session.sessionId, host!.playerId, true);
    expect(afterHostReady.shouldStart).toBe(false);
    const afterGuestReady = lobby.setReady(session.sessionId, guest.playerId, true);
    expect(afterGuestReady.shouldStart).toBe(true);
  });

  it('removes a session that has been idle for 5 minutes', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    const removed = lobby.sweepIdleSessions(session.lastActivityMs + IDLE_SESSION_TIMEOUT_MS + 1);
    expect(removed).toContain(session.sessionId);
    expect(lobby.getSession(session.sessionId)).toBeUndefined();
  });

  it('does not remove a session that has had recent activity', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    const removed = lobby.sweepIdleSessions(session.lastActivityMs + IDLE_SESSION_TIMEOUT_MS - 1000);
    expect(removed).not.toContain(session.sessionId);
    expect(lobby.getSession(session.sessionId)).toBeDefined();
  });
});
