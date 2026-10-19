/**
 * Creche read models (PRD §8.3) over plain state — the room board, the
 * parent's live card and the S4 scenario all read these. Each returns a
 * fresh object, so call them in a component body over raw `useStore`
 * records, never inside a `useStore` selector (see CLAUDE.md P2 footgun).
 */
import { rules } from '@/config/rules';
import { addMinutesIso, dubaiDateKey } from '@/lib/time';
import { BAND_ORDER } from '@/domain/creche/bands';
import { bandLoad, staffOnBand, type BandLoad } from '@/domain/creche/capacity';
import type { AppState } from '../types';
import type { CrecheBooking, CrecheSession } from '@/types/creche';

type CrecheRead = Pick<
  AppState,
  'crecheSessions' | 'crecheBookings' | 'bandAssignments' | 'shifts'
>;

/** The session running at `now` (check-in opens a little early), else today's next one. */
export function selectBoardSession(
  s: Pick<AppState, 'crecheSessions'>,
  now: string,
): CrecheSession | undefined {
  const today = dubaiDateKey(now);
  const opens = rules.creche.checkInOpensMinutesBefore;
  const sessions = Object.values(s.crecheSessions)
    .filter((x) => x.kind !== 'dropin' && x.date === today)
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    sessions.find((x) => addMinutesIso(x.start, -opens) <= now && now < x.end) ??
    sessions.find((x) => x.start > now)
  );
}

export function selectInRoom(s: Pick<AppState, 'crecheBookings'>): CrecheBooking[] {
  return Object.values(s.crecheBookings).filter((b) => b.state === 'checked_in');
}

/** Per-band live load: who's in the room vs what the staff on the roster allow for `session`. */
export function selectBandLoads(s: CrecheRead, session: CrecheSession | undefined): BandLoad[] {
  const inRoom = selectInRoom(s);
  const shifts = Object.values(s.shifts);
  return BAND_ORDER.map((band) => {
    const staff = session
      ? staffOnBand(s.bandAssignments, shifts, session.date, band, session.start, session.end)
      : [];
    return bandLoad(band, staff, inRoom.filter((b) => b.band === band).length, rules.creche.bands);
  });
}

/** The child's booking a parent cares about right now: in the room, else the next one coming up. */
export function selectChildCurrentBooking(
  s: Pick<AppState, 'crecheBookings' | 'crecheSessions'>,
  childId: string,
  now: string,
): CrecheBooking | undefined {
  const mine = Object.values(s.crecheBookings).filter((b) => b.childId === childId);
  const inRoom = mine.find((b) => b.state === 'checked_in');
  if (inRoom) return inRoom;
  return mine
    .filter(
      (b) =>
        (b.state === 'confirmed' || b.state === 'waitlisted') &&
        (s.crecheSessions[b.sessionId]?.end ?? '') > now,
    )
    .sort((a, b) =>
      (s.crecheSessions[a.sessionId]?.start ?? '').localeCompare(
        s.crecheSessions[b.sessionId]?.start ?? '',
      ),
    )[0];
}
