/**
 * Zod schema for every business number in the prototype (PRD §8, CLAUDE.md
 * rule #2). `config/rules.ts` parses the raw data object against this schema
 * at import time, so a bad value fails fast at boot rather than silently.
 */
import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:mm');
const filsAmount = z.number().int().nonnegative();
const minutes = z.number().int().positive();
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const hours = z.number().positive();
/** Restaurant/Teppanyaki have no minimum lead time beyond the slot grid (PRD §8.4). */
const nonnegativeHours = z.number().nonnegative();

const WaitlistOfferRulesSchema = z.object({
  sequentialOfferMinutes: minutes,
  minMinutesBeforeStartForOffer: minutes,
  openReleaseThresholdMinutes: minutes,
});

const PadelRulesSchema = z.object({
  courts: z.number().int().positive(),
  operatingHours: z.object({ open: hhmm, close: hhmm }),
  slotGridMinutes: minutes,
  durationsMinutes: z.array(z.number().int().positive()).min(1),
  bookingWindowDays: z.number().int().positive(),
  bookingWindowOpensAt: hhmm,
  leadTimeHours: hours,
  quota: z.object({
    perRollingDays: z.number().int().positive(),
    maxBookings: z.number().int().positive(),
    maxPerDay: z.number().int().positive(),
    peakHours: z.object({ start: hhmm, end: hhmm }),
    maxPeakPerWeek: z.number().int().positive(),
  }),
  maxPlayersTotal: z.number().int().positive(),
  maxGuestsPerBooking: z.number().int().nonnegative(),
  guestFeeFils: filsAmount,
  freeCancellationHoursBefore: hours,
  checkIn: z.object({ opensMinutesBefore: minutes, closesMinutesAfter: minutes }),
  noShowGraceMinutes: minutes,
  penalty: z.object({
    strikesToSuspend: z.number().int().positive(),
    windowDays: z.number().int().positive(),
    suspensionDays: z.number().int().positive(),
    warnAtStrike: z.number().int().positive(),
  }),
  waitlist: z.object({
    maxPerSlot: z.number().int().positive(),
    maxActivePerResident: z.number().int().positive(),
    offer: WaitlistOfferRulesSchema,
  }),
});

const AttendeePricingSchema = z.object({
  resident: filsAmount,
  household: filsAmount,
  guest_adult: filsAmount,
  guest_child: filsAmount,
});

const EventVenueRulesSchema = z.object({
  capacityMode: z.enum(['seats', 'headcount']),
  capacity: z.number().int().positive(),
  pricing: AttendeePricingSchema,
  maxGuestsPerUnitPerShowtime: z.number().int().nonnegative(),
  freeCancellationHoursBefore: hours,
  registrationClosesMinutesBefore: minutes,
  reminderHoursBefore: z.array(hours).min(1),
});

const CrecheBandRuleSchema = z.object({
  minAge: z.number().int().nonnegative(),
  maxAge: z.number().int().positive(),
  ratioStaffToChildren: z.number().int().positive(),
});

const CrecheRulesSchema = z.object({
  bands: z.object({
    toddlers: CrecheBandRuleSchema,
    kids: CrecheBandRuleSchema,
    juniors: CrecheBandRuleSchema,
  }),
  roomCapacityAbsolute: z.number().int().positive(),
  minAcceptedAge: z.number().int().nonnegative(),
  sessions: z.object({
    morning: z.object({ start: hhmm, end: hhmm }),
    afternoon: z.object({ start: hhmm, end: hhmm }),
    dropIn: z.object({ minHours: hours, maxHours: hours }),
  }),
  bookingWindowDays: z.number().int().positive(),
  leadTimeHours: hours,
  tenantFeePerHourFils: filsAmount,
  feeRoundingMinutes: minutes,
  guardians: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  latePickup: z.object({
    graceMinutes: minutes,
    feePer15MinFils: filsAmount,
    reminderMinutesBefore: minutes,
  }),
  endOfDaySweepAt: hhmm,
  checkInOpensMinutesBefore: minutes,
});

const DiningVenueBaseSchema = z.object({
  leadTimeHours: nonnegativeHours,
  lateCancellationHoursBefore: hours,
});

const RestaurantRulesSchema = DiningVenueBaseSchema.extend({
  totalCovers: z.number().int().positive(),
  tableSizes: z.array(z.number().int().positive()).min(1),
  servicePeriods: z.object({
    breakfast: z.object({ start: hhmm, end: hhmm }),
    lunch: z.object({ start: hhmm, end: hhmm }),
    dinner: z.object({ start: hhmm, end: hhmm }),
  }),
  startGridMinutes: minutes,
  tableTimeMinutes: minutes,
  tableTimeMinutesForLargeParty: minutes,
  largePartyThreshold: z.number().int().positive(),
  partySize: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  requestModeMinPartySize: z.number().int().positive(),
  noShow: z.object({
    graceMinutes: minutes,
    autoFlagMinutes: minutes,
    feeFils: filsAmount,
    repeatThreshold: z.number().int().positive(),
    repeatWindowDays: z.number().int().positive(),
    depositRequiredFils: filsAmount,
    depositAppliesNextReservations: z.number().int().positive(),
  }),
  limitedBelowFraction: z.number().gt(0).lt(1),
});

const PrivateDiningRulesSchema = DiningVenueBaseSchema.extend({
  partySize: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  minimumSpendFils: filsAmount,
  depositFils: filsAmount,
});

const TeppanyakiRulesSchema = DiningVenueBaseSchema.extend({
  seats: z.number().int().positive(),
  seatings: z.array(hhmm).min(1),
  pricePerPersonFils: filsAmount,
  depositPerPersonFils: filsAmount,
  partySize: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }),
  seatingMinutes: minutes,
});

const DiningRulesSchema = z.object({
  restaurant: RestaurantRulesSchema,
  pdr: PrivateDiningRulesSchema,
  teppanyaki: TeppanyakiRulesSchema,
  bookingWindowDays: z.number().int().positive(),
  reminderHoursBefore: hours,
  depositRefundCutoffHours: hours,
  floor: z.object({ reservedSoonMinutes: minutes, turningMinutes: minutes }),
  ramadan: z.object({ start: dateKey, end: dateKey, iftarAt: hhmm, iftarMinutes: minutes }),
});

const WaterQualityRangeSchema = z.object({ min: z.number(), max: z.number() });

const PoolRulesSchema = z.object({
  hours: z.object({ open: hhmm, close: hhmm }),
  minAge: z.number().int().positive(),
  capacity: z.number().int().positive(),
  waterReadingIntervalHours: hours,
  waterReadingOverdueMinutes: minutes,
  waterQuality: z.object({
    ph: WaterQualityRangeSchema,
    freeChlorinePpm: WaterQualityRangeSchema,
    tempC: WaterQualityRangeSchema,
  }),
});

const GymRulesSchema = z.object({
  staffedWindow: z.object({ open: hhmm, close: hhmm }),
  capacity: z.number().int().positive(),
});

const SlaBandSchema = z.object({ respondMinutes: minutes, resolveMinutes: minutes });

const OpsRulesSchema = z.object({
  sla: z.object({ P1: SlaBandSchema, P2: SlaBandSchema, P3: SlaBandSchema }),
  slaAtRiskFraction: z.number().min(0).max(1),
});

const CommsRulesSchema = z.object({
  waCharacterLimit: z.number().int().positive(),
  quietHours: z.object({ start: hhmm, end: hhmm }),
  urgentSmsFallbackAfterMinutes: minutes,
  duplicateUrgentWindowMinutes: minutes,
  delivery: z.object({
    sentMinSeconds: z.number().nonnegative(),
    sentMaxSeconds: z.number().positive(),
    deliveredMinSeconds: z.number().nonnegative(),
    deliveredMaxSeconds: z.number().positive(),
    failRate: z.number().min(0).max(1),
    readMedianMinutesNormal: z.number().positive(),
    readMedianMinutesUrgent: z.number().positive(),
    neverReadRate: z.number().min(0).max(1),
    tickBatchSeconds: z.number().positive(),
  }),
});

const BookingRulesSchema = z.object({
  holdSeconds: z.number().int().positive(),
});

const ProgrammeRulesSchema = z.object({
  forwardHorizonMonths: z.number().int().positive(),
  publicHolidays: z.array(z.object({ date: dateKey, name: z.string().min(1) })),
  suggestionGridMinutes: minutes,
});

const SeedHistoryRulesSchema = z.object({
  days: z.number().int().positive(),
  noShowRate: z.object({
    padel: z.number().min(0).max(1),
    events: z.number().min(0).max(1),
    restaurant: z.number().min(0).max(1),
  }),
  peakWindows: z.object({
    padelWeekday: z.object({ start: hhmm, end: hhmm }),
    padelWeekend: z.object({ start: hhmm, end: hhmm }),
    poolWeekend: z.object({ start: hhmm, end: hhmm }),
    gymMorning: z.object({ start: hhmm, end: hhmm }),
    gymEvening: z.object({ start: hhmm, end: hhmm }),
  }),
});

export const RulesSchema = z.object({
  booking: BookingRulesSchema,
  padel: PadelRulesSchema,
  screening: EventVenueRulesSchema,
  music: EventVenueRulesSchema,
  creche: CrecheRulesSchema,
  dining: DiningRulesSchema,
  pool: PoolRulesSchema,
  gym: GymRulesSchema,
  ops: OpsRulesSchema,
  comms: CommsRulesSchema,
  reports: z.object({
    generateMs: z.number().int().min(800).max(1500),
    rangePresetsDays: z.array(z.number().int().positive()),
  }),
  programme: ProgrammeRulesSchema,
  seedHistory: SeedHistoryRulesSchema,
});

export type Rules = z.infer<typeof RulesSchema>;
