'use client';

/**
 * Reserve a table (PRD §8.4 resident flow): venue, date, party size and
 * service period; a time chip ("Limited" under 25% left); seating
 * preference (Requested, not guaranteed); occasion and requests; then the
 * wallet panel — the deposit and what's available, with the inline top-up
 * when it falls short.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Stepper } from '@/ui/Stepper';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { addDaysIso, dubaiDateKey, dubaiDateTimeToIso, fmtDate } from '@/lib/time';
import { periodsFor } from '@/domain/dining/periods';
import type { ServicePeriod, TableZone, VenueKey } from '@/types/dining';
import type { DeviceSlotId } from '@/types/demo';
import { Chip } from './Chip';
import { TimeChips } from './TimeChips';
import { RequestsSection, type Requests } from './RequestsSection';
import { WalletPanel } from './WalletPanel';

const VENUES: { key: VenueKey; label: string }[] = [
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'pdr', label: 'Private Dining' },
  { key: 'teppanyaki', label: 'Teppanyaki' },
];
const PERIOD: Record<ServicePeriod, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  iftar: 'Iftar',
  dinner: 'Dinner',
};
const ZONES: { key: TableZone; label: string }[] = [
  { key: 'indoor', label: 'Indoor' },
  { key: 'terrace', label: 'Terrace' },
  { key: 'canal', label: 'Canal view' },
];
const DAYS_SHOWN = 14;

export function DiningBookScreen({
  slot,
  initialVenue,
}: {
  slot: DeviceSlotId;
  initialVenue?: VenueKey;
}) {
  const { pop, replace } = useNav(slot);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const now = useStore((s) => s.demo.clock.now);
  const dispatch = useStore((s) => s.dispatch);
  const [venue, setVenue] = useState<VenueKey>(initialVenue ?? 'restaurant');
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => dubaiDateKey(addDaysIso(now, i)));
  const [day, setDay] = useState(days[0]!);
  const [party, setParty] = useState(2);
  const [period, setPeriod] = useState<ServicePeriod | undefined>();
  const [start, setStart] = useState<string | undefined>();
  const [zone, setZone] = useState<TableZone | undefined>();
  const [requests, setRequests] = useState<Requests>({ dietary: [], highChair: false });
  const [error, setError] = useState<string | undefined>();

  const { min, max } = rules.dining[venue].partySize;
  const size = Math.min(max, Math.max(min, party));
  const windows = periodsFor(venue, day, rules.dining);
  const window =
    windows.find((w) => w.period === period) ?? windows.find((w) => w.end > now) ?? windows[0]!;
  const request = venue === 'restaurant' && size >= rules.dining.restaurant.requestModeMinPartySize;

  function reset<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setStart(undefined);
      setError(undefined);
    };
  }

  function reserve() {
    if (!start) return;
    const result = dispatch(
      'dining.reserve',
      {
        venue,
        start,
        partySize: size,
        seatingPref: zone,
        occasion: requests.occasion,
        dietary: requests.dietary,
        requests: requests.text,
        highChair: requests.highChair,
        accessibility: requests.accessibility,
      },
      { kind: 'resident', id: actorId },
    );
    if (result.ok)
      replace('reservation-detail', {
        id: result.value.id,
        ...(result.value.zoneHonoured ? {} : { zone: 'missed' }),
      });
    else setError(result.error.message);
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Reserve a table" onBack={pop} />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pt-2 pb-6 [&>*]:shrink-0">
        <div className="flex flex-wrap gap-2">
          {VENUES.map((v) => (
            <Chip key={v.key} active={venue === v.key} onClick={() => reset(setVenue)(v.key)}>
              {v.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <Chip key={d} active={day === d} onClick={() => reset(setDay)(d)}>
              {fmtDate(dubaiDateTimeToIso(d, '12:00'), 'EEE d')}
            </Chip>
          ))}
        </div>
        <Stepper label="Party size" value={size} min={min} max={max} onChange={reset(setParty)} />
        {windows.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {windows.map((w) => (
              <Chip
                key={w.period}
                active={window.period === w.period}
                onClick={() => reset(setPeriod)(w.period)}
              >
                {PERIOD[w.period]}
              </Chip>
            ))}
          </div>
        )}
        <TimeChips
          venue={venue}
          window={window}
          partySize={size}
          value={start}
          onChange={(t) => {
            setStart(t);
            setError(undefined);
          }}
        />
        {venue === 'restaurant' && (
          <section className="flex flex-col gap-2">
            <h2 className="text-label-1 text-text-title">Seating</h2>
            <div className="flex flex-wrap gap-2">
              {ZONES.map((z) => (
                <Chip
                  key={z.key}
                  active={zone === z.key}
                  onClick={() => setZone(zone === z.key ? undefined : z.key)}
                >
                  {z.label}
                </Chip>
              ))}
            </div>
            <p className="text-body-3 text-text-muted">
              Requested, not guaranteed — we seat you there where we can.
            </p>
          </section>
        )}
        <RequestsSection value={requests} onChange={setRequests} />
        <WalletPanel slot={slot} venue={venue} partySize={size} />
        {request && (
          <Banner style="info">
            Parties of {rules.dining.restaurant.requestModeMinPartySize}+ are a request — the
            manager confirms.
          </Banner>
        )}
        {error && <Banner style="urgent">{error}</Banner>}
        <Button fullWidth disabled={!start} onClick={reserve}>
          {request ? 'Send request' : 'Reserve'}
        </Button>
      </div>
    </div>
  );
}
