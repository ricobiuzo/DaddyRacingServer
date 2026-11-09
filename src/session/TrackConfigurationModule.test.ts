import { describe, expect, it } from 'vitest';
import { SessionLobbyModule } from './SessionLobbyModule.js';
import { TrackConfigurationModule, NotHostError, InvalidTrackError } from './TrackConfigurationModule.js';
import { TRACKS } from '../types.js';

describe('TrackConfigurationModule (Select a Track Before Racing, host-only)', () => {
  it('lists exactly the 5 defined tracks', () => {
    const config = new TrackConfigurationModule();
    expect(config.listTracks().map((t) => t.id)).toEqual([
      'green-hills',
      'city-nights',
      'sandy-desert',
      'wet-speed-way',
      'forest-ruins',
    ]);
  });

  it('lets the host select a track', () => {
    const lobby = new SessionLobbyModule();
    const config = new TrackConfigurationModule();
    const session = lobby.createSession('Host');
    const [host] = session.players.values();
    config.selectTrack(session, host!, 'wet-speed-way');
    expect(session.selectedTrackId).toBe('wet-speed-way');
  });

  it('rejects track selection from a non-host player', () => {
    const lobby = new SessionLobbyModule();
    const config = new TrackConfigurationModule();
    const session = lobby.createSession('Host');
    const { player: guest } = lobby.joinSession(session.sessionId, 'Guest');
    expect(() => config.selectTrack(session, guest, 'green-hills')).toThrow(NotHostError);
  });

  it('rejects an unknown track id', () => {
    const lobby = new SessionLobbyModule();
    const config = new TrackConfigurationModule();
    const session = lobby.createSession('Host');
    const [host] = session.players.values();
    expect(() => config.selectTrack(session, host!, 'not-a-track')).toThrow(InvalidTrackError);
  });

  it('applies reduced grip to sandy and wet tracks relative to dry tracks', () => {
    const config = new TrackConfigurationModule();
    const dry = config.getTrack('green-hills');
    const wet = config.getTrack('wet-speed-way');
    expect(wet.gripMultiplier).toBeLessThan(dry.gripMultiplier);
  });

  it('matches the 5 TrackDefinitions exported from types', () => {
    const config = new TrackConfigurationModule();
    expect(config.listTracks()).toEqual(TRACKS);
  });
});
