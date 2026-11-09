import { isTrackId, TRACKS, type Player, type Session, type TrackDefinition, type TrackId } from '../types.js';

export class NotHostError extends Error {
  constructor() {
    super('only the session host can select the track');
  }
}

export class InvalidTrackError extends Error {
  constructor(trackId: string) {
    super(`"${trackId}" is not one of the 5 defined tracks`);
  }
}

/**
 * Holds the definitions of the 5 race tracks and validates the session
 * host's track selection. Implements `e2f93496-...` Select a Track Before
 * Racing (Change 19, host-only) and the 5 per-track Stories `39e296c0-...`
 * through `b49f0ec6-...` (Changes 24-28) by exposing each TrackDefinition's
 * grip/handling data to the Race State module.
 */
export class TrackConfigurationModule {
  listTracks(): readonly TrackDefinition[] {
    return TRACKS;
  }

  getTrack(trackId: TrackId): TrackDefinition {
    const track = TRACKS.find((t) => t.id === trackId);
    if (!track) throw new InvalidTrackError(trackId);
    return track;
  }

  selectTrack(session: Session, player: Player, trackId: string): Session {
    if (!player.isHost) {
      throw new NotHostError();
    }
    if (!isTrackId(trackId)) {
      throw new InvalidTrackError(trackId);
    }
    session.selectedTrackId = trackId;
    return session;
  }
}
