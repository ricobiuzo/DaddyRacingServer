# DaddyRacing Session Server

The single, modular backend for DaddyRacing: session/lobby management, the 5 track definitions,
authoritative race-state/physics synchronisation, and WebSocket relay for clients on the same local
subnet (LAN).

Built with TypeScript + Node.js + [`ws`](https://github.com/websockets/ws). No framework.

## Modules

- `src/session/SessionLobbyModule.ts` — create/join sessions, the 8-player cap, player list, ready/start.
- `src/session/TrackConfigurationModule.ts` — the 5 tracks, host-only track selection.
- `src/race/RaceStateModule.ts` — authoritative kart physics, lap counting, race start/finish/timeout.
- `src/net/NetworkRelayModule.ts` — connection handshake, reconnect grace window, host-disconnect
  reassignment (earliest-joined remaining player).
- `src/protocol.ts` / `src/server.ts` — the WebSocket wire protocol and server entry point.

## Status

This is CR `965b217a-bb82-437e-88ae-8ac1f54c9a5b` (v2) — the first implementation of this Application.
The protocol here matches what `DaddyRacing Game Client`'s `SessionTransport` interface proposes;
no shared package exists yet between the two repos, so keep both in sync by hand until one is added.

## Scripts

```sh
npm install
npm run dev        # ws server on :8080 via tsx watch
npm run build       # typecheck + emit to dist/
npm test            # vitest
```
