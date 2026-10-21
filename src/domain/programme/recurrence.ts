/**
 * Recurrence (PRD §8.6): RRULE daily / weekly on days / monthly by date or
 * by weekday, ending on a date, after a count, or never (bounded by the
 * forward horizon), with exception dates and per-occurrence overrides.
 *
 * Rules are wall-clock in Dubai: "Tue 07:00" means 07:00 in Dubai every
 * Tuesday. `rrule` works in UTC, so occurrences are expanded in "floating"
 * time (Dubai's wall-clock fields written as if UTC) and converted back —
 * a weekday can never slip across midnight UTC. Pure.
 */
import { RRule, type Options, type Weekday } from 'rrule';
import { addMinutesIso, dubaiDateTimeToIso, toDubai } from '@/lib/time';
import type { ProgrammeItem } from '@/types/programme';

export type Freq = 'daily' | 'weekly' | 'monthly';

export interface RuleSpec {
  freq: Freq;
  interval: number;
  /** weekly: 0 = Sunday … 6 = Saturday. */
  byWeekday: number[];
  /** monthly: on the same date each month, or the same nth weekday (e.g. 2nd Wednesday). */
  monthlyMode: 'date' | 'weekday';
  count?: number;
  /** Last day (YYYY-MM-DD, Dubai) an occurrence may fall on. */
  untilDate?: string;
}

const RR_DAYS = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', 'last'];
const FREQ: Record<Freq, number> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
};

/** Dubai wall-clock fields of an instant, as a "floating" UTC Date. */
function floating(iso: string): Date {
  const d = toDubai(iso);
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()),
  );
}

/** A floating Date back to the real instant in Dubai. */
function fromFloating(d: Date): string {
  const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const hhmm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return dubaiDateTimeToIso(dateKey, hhmm);
}

/** Which weekday-of-month an instant is (1-4, or -1 for "last" when it's in the final 7 days). */
function nthWeekday(iso: string): number {
  const d = toDubai(iso);
  const n = Math.ceil(d.getDate() / 7);
  const daysInMonth = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)).getUTCDate();
  return d.getDate() + 7 > daysInMonth && n >= 4 ? -1 : n;
}

/** The RRULE body for a spec, anchored to `dtstart` (monthly-by-weekday reads the anchor's nth weekday). */
export function buildRule(spec: RuleSpec, dtstart: string): string {
  const opts: Partial<Options> = { freq: FREQ[spec.freq], interval: Math.max(1, spec.interval) };
  if (spec.freq === 'weekly' && spec.byWeekday.length) {
    opts.byweekday = [...spec.byWeekday].sort().map((d) => RR_DAYS[d]!);
  }
  if (spec.freq === 'monthly' && spec.monthlyMode === 'weekday') {
    opts.byweekday = [RR_DAYS[toDubai(dtstart).getDay()]!.nth(nthWeekday(dtstart))];
  }
  if (spec.count) opts.count = spec.count;
  if (spec.untilDate) opts.until = new Date(`${spec.untilDate}T23:59:59Z`);
  return RRule.optionsToString(opts).replace(/^RRULE:/, '');
}

export function parseRule(rrule: string): RuleSpec {
  const o = RRule.parseString(rrule);
  const freq: Freq =
    o.freq === RRule.DAILY ? 'daily' : o.freq === RRule.MONTHLY ? 'monthly' : 'weekly';
  const raw = o.byweekday;
  const days = (Array.isArray(raw) ? raw : raw == null ? [] : [raw]).map((d) =>
    typeof d === 'string' ? RRule[d as 'MO'] : d,
  );
  const nth = days.some((d) => typeof d !== 'number' && !!(d as Weekday).n);
  // rrule numbers weekdays Monday = 0; this module uses Sunday = 0.
  const toSunday0 = (d: Weekday | number) => ((typeof d === 'number' ? d : d.weekday) + 1) % 7;
  return {
    freq,
    interval: o.interval ?? 1,
    byWeekday: freq === 'weekly' ? days.map(toSunday0) : [],
    monthlyMode: nth ? 'weekday' : 'date',
    count: o.count ?? undefined,
    untilDate: o.until ? o.until.toISOString().slice(0, 10) : undefined,
  };
}

/** "Every Tue and Thu", "Every 2 weeks on Sat", "Monthly on the 2nd Wed" — for lists and previews. */
export function describeRule(rrule: string, dtstart: string): string {
  const spec = parseRule(rrule);
  const every =
    spec.interval > 1
      ? `Every ${spec.interval} ${spec.freq === 'daily' ? 'days' : spec.freq === 'weekly' ? 'weeks' : 'months'}`
      : '';
  let text: string;
  if (spec.freq === 'daily') text = every || 'Daily';
  else if (spec.freq === 'weekly') {
    const days = spec.byWeekday.map((d) => DAY_NAMES[d]);
    const list =
      days.length > 1
        ? `${days.slice(0, -1).join(', ')} and ${days.at(-1)}`
        : (days[0] ?? DAY_NAMES[toDubai(dtstart).getDay()]);
    text = every ? `${every} on ${list}` : `Every ${list}`;
  } else {
    const on =
      spec.monthlyMode === 'weekday'
        ? `the ${ORDINAL[nthWeekday(dtstart) === -1 ? 5 : nthWeekday(dtstart)]} ${DAY_NAMES[toDubai(dtstart).getDay()]}`
        : `the ${toDubai(dtstart).getDate()}`;
    text = `${every || 'Monthly'} on ${on}`;
  }
  if (spec.count) text += `, ${spec.count} times`;
  if (spec.untilDate) text += `, until ${spec.untilDate}`;
  return text;
}

export interface Occurrence {
  /** The rule's own start for this occurrence — the key for exdates and overrides. */
  originalStart: string;
  start: string;
  end: string;
  overridden: boolean;
}

/** Occurrences whose original start falls in [from, to), exdates removed and overrides applied. */
export function expandOccurrences(
  item: Pick<ProgrammeItem, 'rrule' | 'dtstart' | 'durationMins' | 'exdates' | 'overrides'>,
  from: string,
  to: string,
): Occurrence[] {
  const rule = new RRule({ ...RRule.parseString(item.rrule), dtstart: floating(item.dtstart) });
  const skipped = new Set(item.exdates);
  return rule
    .between(floating(from), floating(to), true)
    .map(fromFloating)
    .filter((start) => start >= from && start < to && !skipped.has(start))
    .map((originalStart) => {
      const o = item.overrides[originalStart];
      return {
        originalStart,
        start: o?.start ?? originalStart,
        end: o?.end ?? addMinutesIso(originalStart, item.durationMins),
        overridden: !!o,
      };
    });
}
