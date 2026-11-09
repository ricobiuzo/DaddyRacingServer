import type { WebSocket } from 'ws';
import { RECONNECT_GRACE_MS } from '../types.js';
import type { SessionLobbyModule } from '../session/SessionLobbyModule.js';

interface ConnectionEntry {
  sessionId: string;
  playerId: string;
  socket: WebSocket;
  disconnectTimer: NodeJS.Timeout | null;
}

/**
 * Handles the real-time connection handshake, message relay, and
 * reconnect/host-disconnect handling between the server and each connected
 * client on the same local subnet. Implements:
 * - `ba22c91b-...` Establish Network Connection on Session Join,
 *   `a822f0e0-...` Reconnect After a Dropped Connection,
 *   `962ac75d-...` Handle Session Host Disconnection (Change 17).
 */
export class NetworkRelayModule {
  private connections = new Map<string, ConnectionEntry>(); // keyed by playerId

  constructor(
    private readonly lobby: SessionLobbyModule,
    private readonly broadcast: (sessionId: string) => void,
    private readonly notify: (playerId: string, message: unknown) => void,
  ) {}

  /** Establish Network Connection on Session Join. */
  registerConnection(sessionId: string, playerId: string, socket: WebSocket): void {
    const existing = this.connections.get(playerId);
    if (existing?.disconnectTimer) {
      clearTimeout(existing.disconnectTimer);
    }
    this.connections.set(playerId, { sessionId, playerId, socket, disconnectTimer: null });
    const session = this.lobby.getSession(sessionId);
    const player = session?.players.get(playerId);
    if (player) player.connected = true;
  }

  /** Reconnect After a Dropped Connection: starts a grace window before finalising the drop. */
  handleSocketClose(playerId: string): void {
    const entry = this.connections.get(playerId);
    if (!entry) return;
    const session = this.lobby.getSession(entry.sessionId);
    const player = session?.players.get(playerId);
    if (player) player.connected = false;

    entry.disconnectTimer = setTimeout(() => {
      this.finalizeDisconnect(entry.sessionId, playerId);
    }, RECONNECT_GRACE_MS);
  }

  /** Handle Session Host Disconnection (`962ac75d-...`): deterministic reassignment rule. */
  private finalizeDisconnect(sessionId: string, playerId: string): void {
    this.connections.delete(playerId);
    const session = this.lobby.getSession(sessionId);
    if (!session) return;
    const player = session.players.get(playerId);
    if (!player) return;

    const wasHost = player.isHost;
    session.players.delete(playerId);

    if (wasHost && !session.raceStarted) {
      const remaining = [...session.players.values()]
        .filter((p) => p.connected)
        .sort((a, b) => a.joinOrder - b.joinOrder);
      const nextHost = remaining[0];
      if (nextHost) {
        nextHost.isHost = true;
        this.notify(nextHost.playerId, { type: 'hostReassigned' });
      } else {
        // No other player remains: the session ends.
        session.players.clear();
      }
    }

    if (session.players.size > 0) {
      this.broadcast(sessionId);
    }
  }

  getSocket(playerId: string): WebSocket | undefined {
    return this.connections.get(playerId)?.socket;
  }

  socketsInSession(sessionId: string): WebSocket[] {
    return [...this.connections.values()]
      .filter((entry) => entry.sessionId === sessionId)
      .map((entry) => entry.socket);
  }
}
