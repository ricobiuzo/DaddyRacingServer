import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionLobbyModule } from '../session/SessionLobbyModule.js';
import { NetworkRelayModule } from './NetworkRelayModule.js';
import { RECONNECT_GRACE_MS } from '../types.js';

function fakeSocket() {
  return { readyState: 1, OPEN: 1, send: vi.fn() } as unknown as import('ws').WebSocket;
}

describe('NetworkRelayModule (Connection Handshake, Reconnect, Host Disconnection)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks a player disconnected immediately, but does not remove them during the grace window', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    const [host] = session.players.values();
    const relay = new NetworkRelayModule(lobby, vi.fn(), vi.fn());
    relay.registerConnection(session.sessionId, host!.playerId, fakeSocket());

    relay.handleSocketClose(host!.playerId);
    expect(host!.connected).toBe(false);
    vi.advanceTimersByTime(RECONNECT_GRACE_MS - 100);
    expect(lobby.getSession(session.sessionId)?.players.has(host!.playerId)).toBe(true);
  });

  it('reconnecting within the grace window cancels the pending drop', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    const [host] = session.players.values();
    const relay = new NetworkRelayModule(lobby, vi.fn(), vi.fn());
    relay.registerConnection(session.sessionId, host!.playerId, fakeSocket());

    relay.handleSocketClose(host!.playerId);
    relay.registerConnection(session.sessionId, host!.playerId, fakeSocket());
    vi.advanceTimersByTime(RECONNECT_GRACE_MS + 1000);

    expect(lobby.getSession(session.sessionId)?.players.has(host!.playerId)).toBe(true);
    expect(host!.connected).toBe(true);
  });

  it('reassigns host to the earliest-joined remaining connected player after the grace window', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    const [host] = session.players.values();
    const { player: guest1 } = lobby.joinSession(session.sessionId, 'Guest1');
    const { player: guest2 } = lobby.joinSession(session.sessionId, 'Guest2');

    const notify = vi.fn();
    const relay = new NetworkRelayModule(lobby, vi.fn(), notify);
    relay.registerConnection(session.sessionId, host!.playerId, fakeSocket());
    relay.registerConnection(session.sessionId, guest1.playerId, fakeSocket());
    relay.registerConnection(session.sessionId, guest2.playerId, fakeSocket());

    relay.handleSocketClose(host!.playerId);
    vi.advanceTimersByTime(RECONNECT_GRACE_MS + 1);

    expect(guest1.isHost).toBe(true);
    expect(guest2.isHost).toBe(false);
    expect(notify).toHaveBeenCalledWith(guest1.playerId, { type: 'hostReassigned' });
  });

  it('ends the session if the host disconnects and no other player remains', () => {
    const lobby = new SessionLobbyModule();
    const session = lobby.createSession('Host');
    const [host] = session.players.values();
    const relay = new NetworkRelayModule(lobby, vi.fn(), vi.fn());
    relay.registerConnection(session.sessionId, host!.playerId, fakeSocket());

    relay.handleSocketClose(host!.playerId);
    vi.advanceTimersByTime(RECONNECT_GRACE_MS + 1);

    expect(lobby.getSession(session.sessionId)?.players.size).toBe(0);
  });
});
