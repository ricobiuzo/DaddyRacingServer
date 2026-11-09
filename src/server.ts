import { WebSocketServer, type WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { SessionLobbyModule, SessionFullError, SessionNotFoundError } from './session/SessionLobbyModule.js';
import { TrackConfigurationModule, NotHostError, InvalidTrackError } from './session/TrackConfigurationModule.js';
import { RaceStateModule } from './race/RaceStateModule.js';
import { NetworkRelayModule } from './net/NetworkRelayModule.js';
import { serializeSession, type ClientMessage, type ServerMessage } from './protocol.js';

const PORT = Number(process.env.PORT ?? 8080);
const TICK_INTERVAL_MS = 100;
const IDLE_SWEEP_INTERVAL_MS = 30_000;

const lobby = new SessionLobbyModule();
const trackConfig = new TrackConfigurationModule();
const raceState = new RaceStateModule();

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(sessionId: string): void {
  const session = lobby.getSession(sessionId);
  if (!session) return;
  const state = serializeSession(session);
  for (const socket of relay.socketsInSession(sessionId)) {
    send(socket, { type: 'state', state });
  }
}

function notify(playerId: string, message: ServerMessage): void {
  const socket = relay.getSocket(playerId);
  if (socket) send(socket, message);
}

const relay = new NetworkRelayModule(lobby, broadcast, notify as (playerId: string, message: unknown) => void);

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket: WebSocket) => {
  let currentSessionId: string | null = null;
  let currentPlayerId: string | null = null;

  socket.on('message', (raw) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(socket, { type: 'error', message: 'malformed message' });
      return;
    }

    try {
      switch (message.type) {
        case 'createSession': {
          const session = lobby.createSession(message.name);
          const [player] = session.players.values();
          currentSessionId = session.sessionId;
          currentPlayerId = player!.playerId;
          relay.registerConnection(session.sessionId, player!.playerId, socket);
          send(socket, { type: 'joined', playerId: player!.playerId, state: serializeSession(session) });
          break;
        }
        case 'joinSession': {
          const { session, player } = lobby.joinSession(message.sessionId, message.name);
          currentSessionId = session.sessionId;
          currentPlayerId = player.playerId;
          relay.registerConnection(session.sessionId, player.playerId, socket);
          send(socket, { type: 'joined', playerId: player.playerId, state: serializeSession(session) });
          broadcast(session.sessionId);
          break;
        }
        case 'selectKart': {
          requireJoined();
          const session = lobby.selectKart(currentSessionId!, currentPlayerId!, message.kartId);
          broadcast(session.sessionId);
          break;
        }
        case 'selectTrack': {
          requireJoined();
          const session = lobby.getSession(currentSessionId!);
          if (!session) throw new SessionNotFoundError(currentSessionId!);
          const player = session.players.get(currentPlayerId!)!;
          trackConfig.selectTrack(session, player, message.trackId);
          broadcast(session.sessionId);
          break;
        }
        case 'setReady': {
          requireJoined();
          const { session, shouldStart } = lobby.setReady(currentSessionId!, currentPlayerId!, message.ready);
          if (shouldStart) {
            raceState.startRace(session, Date.now());
          }
          broadcast(session.sessionId);
          break;
        }
        case 'input': {
          requireJoined();
          const session = lobby.getSession(currentSessionId!);
          if (!session || !session.raceStarted) return;
          const player = session.players.get(currentPlayerId!);
          if (!player || !session.selectedTrackId) return;
          const track = trackConfig.getTrack(session.selectedTrackId);
          raceState.applyInput(player, track, message.input, TICK_INTERVAL_MS / 1000);
          break;
        }
        default:
          send(socket, { type: 'error', message: `unknown message type` });
      }
    } catch (error) {
      send(socket, { type: 'error', message: errorMessage(error) });
    }

    function requireJoined(): void {
      if (!currentSessionId || !currentPlayerId) {
        throw new Error('not in a session yet');
      }
    }
  });

  socket.on('close', () => {
    if (currentPlayerId) relay.handleSocketClose(currentPlayerId);
  });
});

function errorMessage(error: unknown): string {
  if (error instanceof SessionFullError) return 'session full';
  if (error instanceof SessionNotFoundError) return error.message;
  if (error instanceof NotHostError) return error.message;
  if (error instanceof InvalidTrackError) return error.message;
  return error instanceof Error ? error.message : 'unknown error';
}

// Race Start/Finish & 10-Minute Timeout Handling, and authoritative broadcast tick.
setInterval(() => {
  for (const sessionId of lobby.listSessionIds()) {
    const session = lobby.getSession(sessionId);
    if (!session?.raceStarted) continue;
    raceState.checkTimeouts(session, Date.now());
    broadcast(sessionId);
  }
}, TICK_INTERVAL_MS);

// Clean Up Abandoned or Idle Sessions.
setInterval(() => {
  lobby.sweepIdleSessions();
}, IDLE_SWEEP_INTERVAL_MS);

console.log(`DaddyRacing Session Server listening on ws://localhost:${PORT} [id:${randomUUID().slice(0, 8)}]`);
