/**
 * The programme calendar (PRD §8.6): recurring activities and seasons.
 * A `ProgrammeItem` is the series; its occurrences are materialised into
 * the records that already carry each effect — a padel `Blackout`, a pool
 * "Limited" `StatusEntry`, or a `Showtime` booked like an event — each
 * tagged with `programmeId`.
 */
import type { BaseEntity, ISODateTime } from './common';
import type { AmenityKey } from './amenity';

/** limited: the amenity reads "Limited: <note>" during each occurrence; blackout: it can't be booked; event: each occurrence is a bookable showtime. */
export type ProgrammeEffect = 'limited' | 'blackout' | 'event';

export interface OccurrenceOverride {
  start: ISODateTime;
  end: ISODateTime;
}

export interface ProgrammeItem extends BaseEntity {
  title: string;
  amenity: AmenityKey;
  effect: ProgrammeEffect;
  /** e.g. "lanes 1–3 reserved" — shown as the Limited reason. */
  note?: string;
  /** RFC 5545 RRULE body without DTSTART, e.g. `FREQ=WEEKLY;BYDAY=TU,TH`. Wall-clock in Dubai. */
  rrule: string;
  /** The first occurrence's start. */
  dtstart: ISODateTime;
  durationMins: number;
  /** Occurrences skipped ("Delete this occurrence", a holiday "Skip"), by their original start. */
  exdates: ISODateTime[];
  /** "Edit this occurrence": a moved time, keyed by the occurrence's original start. */
  overrides: Record<ISODateTime, OccurrenceOverride>;
  /** Public holidays on a class day: "keep" acknowledges it; "skip" also adds an exdate. */
  holidayDecisions: Record<string, 'skip' | 'keep'>;
  /** effect 'event': the ProgrammeEvent its showtimes belong to, and their headcount. */
  eventId?: string;
  capacity?: number;
  seasonId?: string;
  state: 'active' | 'ended';
}

export interface SeasonHours {
  amenity: AmenityKey;
  open: string; // HH:mm
  close: string;
}
