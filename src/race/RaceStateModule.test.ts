import { describe, expect, it } from 'vitest';
import { SessionLobbyModule } from '../session/SessionLobbyModule.js';
import { TrackConfigurationModule } from '../session/TrackConfigurationModule.js';
import { RaceStateModule } from './RaceStateModule.js';
import { RACE_TIMEOUT_MS, TOTAL_LAPS } from '../types.js';

const noInput = { accelerate: false, brake: false, steerLeft: false, steerRight: false };
const accelerating = { accelerate: true, brake: false, steerLeft: false, steerRight: false };

describe('RaceStateModule (Accelerate/Brake/Steer, Lap Counting, Race Start/Finish/Timeout)', () => {
  it('starts the race at lap 1 for every player', () => {
    const lobby = new SessionLobbyModule();
    const raceState = new RaceStateModule();
    const session = lobby.createSession('Host');
    raceState.startRace(session, Date.now());
    const [host] = session.players.values();
    expect(host!.lap).toBe(1);
    expect(host!.finished).toBe(false);
  });

  it('accelerates a player forward when given accelerate input', () => {
    const lobby = new SessionLobbyModule();
    const config = new TrackConfigurationModule();
    const raceState = new RaceStateModule();
    const session = lobby.createSession('Host');
    const [host] = session.players.values();
    config.selectTrack(session, host!, 'green-hills');
    raceState.startRace(session, Date.now());
    const track = config.getTrack('green-hills');

    raceState.applyInput(host!, track, noInput, 1);
    const fractionAfterCoast = host!.lapFraction;
    raceState.applyInput(host!, track, accelerating, 1);
    expect(host!.lapFraction).toBeGreaterThan(fractionAfterCoast);
  });

  it('counts a completed lap on each crossing and finishes after lap 5', () => {
    const lobby = new SessionLobbyModule();
    const config = new TrackConfigurationModule();
    const raceState = new RaceStateModule();
    const session = lobby.createSession('Host');
    const [host] = session.players.values();
    config.selectTrack(session, host!, 'green-hills');
    raceState.startRace(session, Date.now());
    const track = config.getTrack('green-hills');

    for (let i = 0; i < 2000 && !host!.finished; i += 1) {
      raceState.applyInput(host!, track, accelerating, 0.5);
    }
    expect(host!.finished).toBe(true);
    expect(host!.lap).toBe(TOTAL_LAPS);
    expect(host!.timedOut).toBe(false);
  });

  it('reduces top speed on a low-grip (wet) track vs. a dry track', () => {
    const lobby = new SessionLobbyModule();
    const config = new TrackConfigurationModule();
    const raceState = new RaceStateModule();

    const drySession = lobby.createSession('DryHost');
    const [dryHost] = drySession.players.values();
    config.selectTrack(drySession, dryHost!, 'green-hills');
    raceState.startRace(drySession, Date.now());
    const dryTrack = config.getTrack('green-hills');

    const wetSession = lobby.createSession('WetHost');
    const [wetHost] = wetSession.players.values();
    config.selectTrack(wetSession, wetHost!, 'wet-speed-way');
    raceState.startRace(wetSession, Date.now());
    const wetTrack = config.getTrack('wet-speed-way');

    // Few enough ticks that neither kart's lapFraction wraps past 1 (which
    // would make the post-modulo remainder meaningless to compare).
    for (let i = 0; i < 5; i += 1) {
      raceState.applyInput(dryHost!, dryTrack, accelerating, 1);
      raceState.applyInput(wetHost!, wetTrack, accelerating, 1);
    }
    const dryFractionGain = dryHost!.lapFraction;
    const wetFractionGain = wetHost!.lapFraction;
    expect(wetFractionGain).toBeLessThan(dryFractionGain);
  });

  it('ends a player\'s race at the 10-minute timeout if not finished', () => {
    const lobby = new SessionLobbyModule();
    const raceState = new RaceStateModule();
    const session = lobby.createSession('Host');
    const start = Date.now();
    raceState.startRace(session, start);
    const [host] = session.players.values();

    raceState.checkTimeouts(session, start + RACE_TIMEOUT_MS + 1);
    expect(host!.finished).toBe(true);
    expect(host!.timedOut).toBe(true);
  });

  it('does not time out a player who already finished', () => {
    const lobby = new SessionLobbyModule();
    const raceState = new RaceStateModule();
    const session = lobby.createSession('Host');
    const start = Date.now();
    raceState.startRace(session, start);
    const [host] = session.players.values();
    host!.finished = true;
    host!.timedOut = false;

    raceState.checkTimeouts(session, start + RACE_TIMEOUT_MS + 1);
    expect(host!.timedOut).toBe(false);
  });
});
