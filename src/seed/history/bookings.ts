/** History: padel bookings and waitlist offers, Restaurant dinners, past screenings with RSVPs. */
import { rngBool, rngInt, rngPick, type Rng } from '@/lib/random';
import { rules } from '@/config/rules';
import { addDaysIso, addMinutesIso, dubaiDateTimeToIso } from '@/lib/time';
import { periodAt } from '@/domain/dining/periods';
import type { AppState } from '@/store/types';
import type { Booking } from '@/types/booking';
import type { Reservation } from '@/types/dining';
import {
  H,
  PADEL_PER_DAY,
  PADEL_LATE_CANCEL,
  PADEL_CANCEL,
  GUEST_SHARE,
  WAITLIST_PER_PEAK_DAY,
  DINNERS_PER_DAY,
  takesQuota,
  hhmmToMinutes,
  hhmm,
  type PickResident,
  type Ledger,
} from './shared';

export function padelDay(
  state: AppState,
  r: Rng,
  dateKey: string,
  weekday: number,
  d: number,
  pick: PickResident,
  ledger: Ledger,
) {
  const weekend = weekday === 5 || weekday === 6;
  const peak = weekend ? H.peakWindows.padelWeekend : H.peakWindows.padelWeekday;
  const open = hhmmToMinutes(rules.padel.operatingHours.open);
  const close = hhmmToMinutes(rules.padel.operatingHours.close) - 60;
  const taken = new Set<number>();
  const book = (startMin: number, i: number) => {
    if (taken.has(startMin) || taken.has(startMin - 30) || taken.has(startMin + 30)) return;
    taken.add(startMin);
    const person = pick();
    const start = dubaiDateTimeToIso(dateKey, hhmm(startMin));
    const id = `bk_hist_${d}_${i}`;
    const roll = r();
    const state_: Booking['state'] =
      roll < PADEL_LATE_CANCEL
        ? 'late_cancelled'
        : roll < PADEL_LATE_CANCEL + PADEL_CANCEL
          ? 'cancelled'
          : takesQuota('padel')
            ? 'no_show'
            : 'completed';
    const guest = rngBool(r, GUEST_SHARE);
    const charges = guest ? [{ label: 'Guest fee', fils: rules.padel.guestFeeFils }] : [];
    state.bookings[id] = {
      id,
      createdAt: addDaysIso(start, -rngInt(r, 1, 6)),
      updatedAt: start,
      amenity: 'padel',
      unitId: person.unitId,
      bookerId: person.id,
      start,
      end: addMinutesIso(start, 60),
      players: guest ? [{ guestName: 'Guest', guestPhone: '+971500000000' }] : [],
      charges,
      state: state_,
      history: [{ state: state_, at: start, by: person.id }],
      source: 'resident',
      countsTowardQuota: true,
    };
    if (guest && state_ !== 'cancelled') {
      ledger(
        {
          unitId: person.unitId,
          at: start,
          kind: 'charge',
          fils: -rules.padel.guestFeeFils,
          label: 'Padel guest fee',
          ref: { type: 'booking', id },
          byResidentId: person.id,
        },
        `ledger_hist_${id}`,
      );
    }
  };
  const [lo, hi] = PADEL_PER_DAY.offPeak;
  const [plo, phi] = PADEL_PER_DAY.peak;
  const peakStart = hhmmToMinutes(peak.start);
  const peakEnd = hhmmToMinutes(peak.end);
  let i = 0;
  for (let n = rngInt(r, plo, phi); n > 0; n -= 1)
    book(peakStart + rngInt(r, 0, (peakEnd - peakStart) / 30 - 1) * 30, i++);
  for (let n = rngInt(r, lo, hi); n > 0; n -= 1)
    book(open + rngInt(r, 0, (close - open) / 30) * 30, i++);

  // Peak slots draw a waitlist; most offers are taken.
  for (let w = 0; w < WAITLIST_PER_PEAK_DAY; w += 1) {
    const start = dubaiDateTimeToIso(dateKey, peak.start);
    const accepted = rngBool(r, 0.6);
    const wid = `wl_hist_${d}_${w}`;
    state.waitlist[wid] = {
      id: wid,
      createdAt: addDaysIso(start, -2),
      updatedAt: addMinutesIso(start, -120),
      resourceKey: `padel:${start}`,
      residentId: pick().id,
      partySize: 1,
      position: 1,
      state: accepted ? 'accepted' : 'expired',
      offer: {
        sentAt: addMinutesIso(start, -180),
        expiresAt: addMinutesIso(start, -120),
        mode: 'sequential',
      },
    };
  }
}

export function dinnersDay(
  state: AppState,
  r: Rng,
  dateKey: string,
  d: number,
  pick: PickResident,
  ledger: Ledger,
) {
  const tables = Object.values(state.tables).filter((t) => t.venue === 'restaurant');
  for (let n = rngInt(r, DINNERS_PER_DAY[0], DINNERS_PER_DAY[1]), i = 0; i < n; i += 1) {
    const person = pick();
    const table = rngPick(r, tables);
    const start = dubaiDateTimeToIso(
      dateKey,
      rngPick(r, ['12:30', '13:00', '19:00', '19:30', '20:00', '20:30']),
    );
    const noShow = takesQuota('restaurant');
    const id = `res_dine_hist_${d}_${i}`;
    const partySize = Math.min(table.seats, rngInt(r, 2, 4));
    const total = partySize * rngInt(r, 90, 220) * 100;
    const res: Reservation = {
      id,
      createdAt: addDaysIso(start, -rngInt(r, 1, 5)),
      updatedAt: start,
      venue: 'restaurant',
      residentId: person.id,
      unitId: person.unitId,
      start,
      end: addMinutesIso(start, 90),
      period: periodAt('restaurant', dateKey, start, rules.dining) ?? 'dinner',
      partySize,
      dietary: [],
      tableIds: [table.id],
      mode: 'instant',
      state: noShow ? 'no_show' : 'completed',
      bill: noShow
        ? undefined
        : {
            totalFils: total,
            settledAt: addMinutesIso(start, 85),
            method: 'wallet',
            chargedFils: total,
          },
    };
    state.reservations[id] = res;
    if (res.bill)
      ledger(
        {
          unitId: person.unitId,
          at: res.bill.settledAt,
          kind: 'charge',
          fils: -total,
          label: 'Restaurant bill',
          ref: { type: 'reservation', id },
          byResidentId: person.id,
        },
        `ledger_hist_${id}`,
      );
  }
}

export function eventDay(
  state: AppState,
  r: Rng,
  dateKey: string,
  d: number,
  pick: PickResident,
  ledger: Ledger,
) {
  const eventId = `evt_hist_${d}`;
  const start = dubaiDateTimeToIso(dateKey, '19:00');
  state.events[eventId] = {
    id: eventId,
    createdAt: addDaysIso(start, -10),
    updatedAt: start,
    title: rngPick(r, [
      'Classic Cinema Night',
      'Weekend Matinee',
      'Documentary Club',
      'Kids’ Matinee',
    ]),
    venue: 'screening',
    type: 'movie',
    poster: '',
    description: '',
    ageRating: 'PG',
    durationMins: 120,
    pricing: rules.screening.pricing,
    lifecycle: 'completed',
  };
  const showtimeId = `show_hist_${d}`;
  state.showtimes[showtimeId] = {
    id: showtimeId,
    createdAt: addDaysIso(start, -10),
    updatedAt: start,
    eventId,
    start,
    end: addMinutesIso(start, 120),
    capacityMode: 'seats',
    capacity: rules.screening.capacity,
    blockedSeats: [],
    regOpens: addDaysIso(start, -10),
    regCloses: addMinutesIso(start, -60),
    state: 'completed',
  };
  for (let n = rngInt(r, 4, 9), i = 0; i < n; i += 1) {
    const person = pick();
    const guests = rngInt(r, 0, 1);
    const fee = guests * rules.screening.pricing.guest_adult;
    const noShow = takesQuota('events');
    const id = `rsvp_hist_${d}_${i}`;
    state.rsvps[id] = {
      id,
      createdAt: addDaysIso(start, -rngInt(r, 1, 7)),
      updatedAt: start,
      showtimeId,
      unitId: person.unitId,
      bookerId: person.id,
      attendees: Array.from({ length: 1 + guests }, (_, k) => ({
        id: `${id}_a${k}`,
        name: k === 0 ? person.name : 'Guest',
        category: k === 0 ? ('resident' as const) : ('guest_adult' as const),
        attendance: noShow ? ('no_show' as const) : ('attended' as const),
      })),
      charges: fee ? [{ label: 'Guest ticket', fils: fee }] : [],
      state: 'confirmed',
    };
    if (fee)
      ledger(
        {
          unitId: person.unitId,
          at: addDaysIso(start, -1),
          kind: 'charge',
          fils: -fee,
          label: 'Event tickets',
          ref: { type: 'rsvp', id },
          byResidentId: person.id,
        },
        `ledger_hist_${id}`,
      );
  }
}
