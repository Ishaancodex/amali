/**
 * Every business number in the prototype (PRD §8), validated at import time
 * against `rules.schema.ts`. CLAUDE.md rule #2: a presenter must be able to
 * change a rule here and see the whole app follow it. All values below are
 * mock defaults confirmed with nobody yet (PRD §18) — treat as placeholders.
 */
import { RulesSchema, type Rules } from './rules.schema';

const rawRules: Rules = {
  booking: {
    // PRD §7 "Slot holds" — opening the confirm sheet holds the slot this long.
    holdSeconds: 180,
  },

  // PRD §8.1 — Padel Tennis Court
  padel: {
    courts: 1,
    operatingHours: { open: '06:00', close: '23:00' },
    slotGridMinutes: 30,
    durationsMinutes: [60, 90],
    bookingWindowDays: 7,
    bookingWindowOpensAt: '08:00',
    leadTimeHours: 2,
    quota: {
      perRollingDays: 7,
      maxBookings: 3,
      maxPerDay: 1,
      peakHours: { start: '18:00', end: '22:00' },
      maxPeakPerWeek: 2,
    },
    maxPlayersTotal: 4, // booker + up to 3
    maxGuestsPerBooking: 2,
    guestFeeFils: 5000, // AED 50
    freeCancellationHoursBefore: 6,
    checkIn: { opensMinutesBefore: 10, closesMinutesAfter: 15 },
    noShowGraceMinutes: 15,
    penalty: {
      strikesToSuspend: 3,
      windowDays: 30,
      suspensionDays: 7,
      warnAtStrike: 2,
    },
    waitlist: {
      maxPerSlot: 5,
      maxActivePerResident: 2,
      offer: {
        sequentialOfferMinutes: 15,
        minMinutesBeforeStartForOffer: 30,
        openReleaseThresholdMinutes: 45,
      },
    },
  },

  // PRD §8.2 — Screening Room (seat map, 4x5 + 2 accessible)
  screening: {
    capacityMode: 'seats',
    capacity: 22,
    pricing: { resident: 0, household: 0, guest_adult: 2500, guest_child: 1500 },
    maxGuestsPerUnitPerShowtime: 2,
    freeCancellationHoursBefore: 2,
    registrationClosesMinutesBefore: 30,
    reminderHoursBefore: [24, 2],
  },

  // PRD §8.2 — Music Room (headcount cap)
  music: {
    capacityMode: 'headcount',
    capacity: 12,
    pricing: { resident: 0, household: 0, guest_adult: 2500, guest_child: 1500 },
    maxGuestsPerUnitPerShowtime: 2,
    freeCancellationHoursBefore: 2,
    registrationClosesMinutesBefore: 30,
    reminderHoursBefore: [24, 2],
  },

  // PRD §8.3 — Creche and Kids' Playroom
  creche: {
    bands: {
      toddlers: { minAge: 2, maxAge: 3, ratioStaffToChildren: 4 },
      kids: { minAge: 4, maxAge: 7, ratioStaffToChildren: 8 },
      juniors: { minAge: 8, maxAge: 12, ratioStaffToChildren: 10 },
    },
    roomCapacityAbsolute: 30,
    minAcceptedAge: 2,
    sessions: {
      morning: { start: '09:00', end: '12:00' },
      afternoon: { start: '15:00', end: '18:00' },
      dropIn: { minHours: 1, maxHours: 3 },
    },
    bookingWindowDays: 7,
    leadTimeHours: 1,
    tenantFeePerHourFils: 4000, // AED 40/hr, owners free
    feeRoundingMinutes: 30,
    guardians: { min: 1, max: 4 },
    latePickup: {
      graceMinutes: 10,
      feePer15MinFils: 5000, // AED 50 / 15 min
      reminderMinutesBefore: 15,
    },
    /** The end-of-day sweep lists children still checked in (PRD §8.3 edge case). */
    endOfDaySweepAt: '18:30',
    /** Staff can check a child in this long before their session starts. */
    checkInOpensMinutesBefore: 15,
  },

  // PRD §8.4 — Restaurant, Private Dining and Teppanyaki
  dining: {
    restaurant: {
      leadTimeHours: 0,
      lateCancellationHoursBefore: 2,
      totalCovers: 60,
      tableSizes: [2, 4, 6],
      servicePeriods: {
        breakfast: { start: '07:00', end: '11:00' },
        lunch: { start: '12:00', end: '15:30' },
        dinner: { start: '18:00', end: '23:00' },
      },
      startGridMinutes: 15,
      tableTimeMinutes: 90,
      tableTimeMinutesForLargeParty: 120,
      largePartyThreshold: 5,
      partySize: { min: 1, max: 12 },
      requestModeMinPartySize: 9,
      noShow: {
        graceMinutes: 15,
        autoFlagMinutes: 30,
        feeFils: 0, // no fee for the restaurant
        repeatThreshold: 2,
        repeatWindowDays: 60,
        depositRequiredFils: 5000, // AED 50 pp on next reservations
        depositAppliesNextReservations: 3,
      },
      /** "Limited" shows on a time chip when less than this share of covers is left. */
      limitedBelowFraction: 0.25,
    },
    pdr: {
      leadTimeHours: 48,
      lateCancellationHoursBefore: 24,
      partySize: { min: 6, max: 12 },
      minimumSpendFils: 150000, // AED 1,500
      depositFils: 50000, // AED 500
    },
    teppanyaki: {
      leadTimeHours: 0,
      lateCancellationHoursBefore: 24,
      seats: 10,
      seatings: ['19:00', '21:00'],
      pricePerPersonFils: 35000, // AED 350
      depositPerPersonFils: 10000, // AED 100
      partySize: { min: 1, max: 10 },
      seatingMinutes: 120,
    },
    bookingWindowDays: 30,
    reminderHoursBefore: 3,
    /** Party-size cuts after the deposit is held are refunded only this far ahead. */
    depositRefundCutoffHours: 24,
    /** Floor plan: "Reserved soon" within this many minutes; "Turning" this long after a bill settles. */
    floor: { reservedSoonMinutes: 30, turningMinutes: 15 },
    /** Mock Ramadan (PRD §8.4 edge case, §8.6): Iftar at sunset replaces Lunch. */
    ramadan: { start: '2027-02-08', end: '2027-03-09', iftarAt: '18:15', iftarMinutes: 120 },
  },

  // PRD §8.5 — Adult Pool
  pool: {
    hours: { open: '06:00', close: '22:00' },
    minAge: 18,
    capacity: 40,
    waterReadingIntervalHours: 2,
    waterReadingOverdueMinutes: 30,
    waterQuality: {
      ph: { min: 7.2, max: 7.8 },
      freeChlorinePpm: { min: 1.0, max: 3.0 },
      tempC: { min: 26, max: 29 },
    },
  },

  // PRD §8.5 — Sky Gym
  gym: {
    staffedWindow: { open: '06:00', close: '22:00' },
    capacity: 25,
  },

  // PRD §8.5 — Incident → work order SLA bands
  ops: {
    sla: {
      P1: { respondMinutes: 30, resolveMinutes: 4 * 60 },
      P2: { respondMinutes: 2 * 60, resolveMinutes: 24 * 60 },
      P3: { respondMinutes: 8 * 60, resolveMinutes: 72 * 60 },
    },
    slaAtRiskFraction: 0.75,
  },

  // PRD §8.7 — Resident communication
  comms: {
    waCharacterLimit: 1024,
    quietHours: { start: '22:00', end: '07:00' },
    urgentSmsFallbackAfterMinutes: 2,
    duplicateUrgentWindowMinutes: 10,
    delivery: {
      // TRD §7.5 refines the PRD's delivery curve into exact simulator inputs.
      sentMinSeconds: 0.2,
      sentMaxSeconds: 1,
      deliveredMinSeconds: 1,
      deliveredMaxSeconds: 8,
      failRate: 0.01,
      readMedianMinutesNormal: 6,
      readMedianMinutesUrgent: 1.5,
      neverReadRate: 0.15,
      tickBatchSeconds: 1,
    },
  },

  // PRD §8.6 — Scheduling and programming
  // PRD §8.10: "A short progress animation runs while the report builds (0.8–1.5s)"
  reports: {
    generateMs: 1100,
    rangePresetsDays: [30, 90],
  },

  programme: {
    forwardHorizonMonths: 12,
    /** PRD §8.6 edge case: a class on a public holiday shows "Skip" or "Keep". Mock UAE dates. */
    publicHolidays: [
      { date: '2026-12-01', name: 'Commemoration Day' },
      { date: '2026-12-02', name: 'National Day' },
      { date: '2026-12-03', name: 'National Day holiday' },
      { date: '2027-03-10', name: 'Eid al-Fitr' },
      { date: '2027-03-11', name: 'Eid al-Fitr holiday' },
    ],
    /** A class's new time when a season's hours clash is suggested on this grid. */
    suggestionGridMinutes: 30,
  },

  // PRD §8.10 / §11 — 90-day seed history generation
  seedHistory: {
    days: 90,
    noShowRate: {
      padel: 0.09,
      events: 0.14,
      restaurant: 0.06,
    },
    peakWindows: {
      padelWeekday: { start: '18:00', end: '21:00' },
      padelWeekend: { start: '08:00', end: '11:00' },
      poolWeekend: { start: '10:00', end: '17:00' },
      gymMorning: { start: '06:00', end: '08:00' },
      gymEvening: { start: '18:00', end: '21:00' },
    },
  },
};

export const rules: Rules = RulesSchema.parse(rawRules);
export type { Rules };
