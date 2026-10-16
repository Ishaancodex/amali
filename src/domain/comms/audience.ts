/**
 * The audience resolver (PRD §8.7): each `AudienceClause` matches a set of
 * residents; `AudienceRule` unions `include` and subtracts `exclude`. Pure
 * — no store, no React (TRD layering rule).
 */
import { dubaiDateKey } from '@/lib/time';
import type { AudienceClause, AudienceRule } from '@/types/comms';
import type { Resident, Unit } from '@/types/community';
import type { Booking } from '@/types/booking';
import type { Rsvp, Showtime, ProgrammeEvent } from '@/types/event';
import type { Guardian } from '@/types/creche';

export interface AudienceContext {
  residents: Record<string, Resident>;
  units: Record<string, Unit>;
  bookings: Record<string, Booking>;
  rsvps: Record<string, Rsvp>;
  showtimes: Record<string, Showtime>;
  events: Record<string, ProgrammeEvent>;
  guardians: Record<string, Guardian>;
}

const ACTIVE_BOOKING_STATES: readonly Booking['state'][] = ['confirmed', 'checked_in'];
const ACTIVE_RSVP_STATES: readonly Rsvp['state'][] = ['confirmed'];

function bookerResidentIds(ctx: AudienceContext, amenity: string, date: string): Set<string> {
  const ids = new Set<string>();
  if (amenity === 'padel') {
    for (const b of Object.values(ctx.bookings)) {
      if (ACTIVE_BOOKING_STATES.includes(b.state) && dubaiDateKey(b.start) === date) {
        ids.add(b.bookerId);
      }
    }
  } else if (amenity === 'screening' || amenity === 'music') {
    for (const r of Object.values(ctx.rsvps)) {
      if (!ACTIVE_RSVP_STATES.includes(r.state)) continue;
      const showtime = ctx.showtimes[r.showtimeId];
      if (!showtime || dubaiDateKey(showtime.start) !== date) continue;
      const event = ctx.events[showtime.eventId];
      if (event?.venue !== amenity) continue;
      ids.add(r.bookerId);
    }
  }
  // Other amenities (creche/dining/pool/gym) have no bookable-by-date domain yet.
  return ids;
}

function isParent(ctx: AudienceContext, residentId: string): boolean {
  return Object.values(ctx.guardians).some(
    (g) => g.residentId === residentId && g.childIds.length > 0,
  );
}

export function matchesClause(
  clause: AudienceClause,
  resident: Resident,
  unit: Unit | undefined,
  ctx: AudienceContext,
): boolean {
  switch (clause.kind) {
    case 'all':
      return true;
    case 'tower':
      return unit?.tower === clause.tower;
    case 'floors':
      return (
        unit?.tower === clause.tower &&
        unit?.floor !== undefined &&
        unit.floor >= clause.from &&
        unit.floor <= clause.to
      );
    case 'cluster':
      return unit?.cluster === clause.cluster;
    case 'units':
      return clause.unitIds.includes(resident.unitId);
    case 'bookers':
      return bookerResidentIds(ctx, clause.amenity, clause.date).has(resident.id);
    case 'parents':
      return isParent(ctx, resident.id);
    case 'optedIn':
      return (resident.topicOptIns ?? []).includes(clause.topic);
  }
}

/** Union of `include`, minus the union of `exclude` — the audience a composed message will reach. */
export function resolveAudience(rule: AudienceRule, ctx: AudienceContext): Resident[] {
  const residents = Object.values(ctx.residents);
  const included = residents.filter((r) =>
    rule.include.some((clause) => matchesClause(clause, r, ctx.units[r.unitId], ctx)),
  );
  if (rule.exclude.length === 0) return included;
  const excludedIds = new Set(
    residents
      .filter((r) =>
        rule.exclude.some((clause) => matchesClause(clause, r, ctx.units[r.unitId], ctx)),
      )
      .map((r) => r.id),
  );
  return included.filter((r) => !excludedIds.has(r.id));
}

export interface AudiencePreview {
  residentCount: number;
  unitCount: number;
  appReachable: number;
  waReachable: number;
  unreachable: number;
}

/** The composer's live "186 residents · 112 units · App 171 · WhatsApp 158 · Unreachable 3" line. */
export function buildAudiencePreview(residents: readonly Resident[]): AudiencePreview {
  const unitIds = new Set(residents.map((r) => r.unitId));
  let appReachable = 0;
  let waReachable = 0;
  let unreachable = 0;
  for (const r of residents) {
    const app = r.channels.appInstalled;
    const wa = r.channels.whatsapp && r.channels.whatsappOptIn;
    if (app) appReachable += 1;
    if (wa) waReachable += 1;
    if (!app && !wa) unreachable += 1;
  }
  return {
    residentCount: residents.length,
    unitCount: unitIds.size,
    appReachable,
    waReachable,
    unreachable,
  };
}
