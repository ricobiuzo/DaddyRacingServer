import { RACE_TIMEOUT_MS, TOTAL_LAPS, type KartInputMessage, type Player, type Session, type TrackDefinition } from '../types.js';

const MAX_SPEED = 28; // m/s
const ACCELERATION = 18; // m/s^2
const BRAKE_DECELERATION = 32; // m/s^2
const COAST_DECELERATION = 6; // m/s^2
const STEER_RATE = 1.6;
const LAP_LENGTH_METERS = 400;

interface PlayerSpeed {
  speed: number;
}
const speedByPlayer = new WeakMap<Player, PlayerSpeed>();

/**
 * Maintains the authoritative race state for each session: kart positions,
 * lap counts, race start/finish detection, and the 10-minute race timeout,
 * synchronised to every connected client. Implements:
 * - `d34109e8-...` Accelerate and Brake the Kart, `cf870843-...` Steer the
 *   Kart on Track (Change 21) — authoritative reconciliation of each
 *   client's predicted input.
 * - `4188493d-...` Count Completed Laps, `3b346850-...` Detect Race
 *   Completion at 5 Laps (Change 22).
 * - `d16c0e20-...` Start the Race Synchronised for All Players,
 *   `502f152d-...` End a Race After a 10-Minute Timeout (Change 23).
 */
export class RaceStateModule {
  /** Start the Race Synchronised for All Players (`d16c0e20-...`). */
  startRace(session: Session, nowMs: number): void {
    session.raceStarted = true;
    for (const player of session.players.values()) {
      player.raceStartMs = nowMs;
      player.lap = 1;
      player.lapFraction = 0;
      player.finished = false;
      player.timedOut = false;
      player.finishMs = null;
      speedByPlayer.set(player, { speed: 0 });
    }
  }

  /** Accelerate/Brake/Steer reconciliation for one player's latest input. */
  applyInput(player: Player, track: TrackDefinition, input: KartInputMessage, deltaSeconds: number): void {
    if (player.finished) return;
    const state = speedByPlayer.get(player) ?? { speed: 0 };

    if (input.accelerate) {
      state.speed += ACCELERATION * track.gripMultiplier * deltaSeconds;
    } else if (input.brake) {
      state.speed -= BRAKE_DECELERATION * deltaSeconds;
    } else {
      state.speed -= COAST_DECELERATION * deltaSeconds;
    }
    state.speed = clamp(state.speed, 0, MAX_SPEED * track.gripMultiplier);

    let steer = 0;
    if (input.steerLeft) steer -= 1;
    if (input.steerRight) steer += 1;
    const speedFraction = state.speed / MAX_SPEED;
    const fractionDelta =
      ((state.speed * deltaSeconds) / LAP_LENGTH_METERS) * (1 + steer * STEER_RATE * speedFraction * 0.15);

    const before = player.lapFraction;
    player.lapFraction = (player.lapFraction + fractionDelta) % 1;
    const lapCrossed = fractionDelta > 0 && player.lapFraction < before;

    if (lapCrossed) {
      this.onLapCrossed(player);
    }

    speedByPlayer.set(player, state);
  }

  /** Count Completed Laps / Detect Race Completion at 5 Laps. */
  private onLapCrossed(player: Player): void {
    if (player.lap < TOTAL_LAPS) {
      player.lap += 1;
    } else {
      player.lap = TOTAL_LAPS;
      player.finished = true;
      player.finishMs = Date.now();
    }
  }

  /** End a Race After a 10-Minute Timeout (`502f152d-...`). */
  checkTimeouts(session: Session, nowMs: number): void {
    for (const player of session.players.values()) {
      if (player.finished || player.raceStartMs === null) continue;
      if (nowMs - player.raceStartMs >= RACE_TIMEOUT_MS) {
        player.finished = true;
        player.timedOut = true;
        player.finishMs = nowMs;
      }
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
