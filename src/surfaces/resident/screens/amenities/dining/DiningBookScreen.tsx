'use client';

/**
 * Reserve a table (PRD §8.4 resident flow): venue, date, party size and
 * service period; a time chip ("Limited" under 25% left); seating
 * preference (Requested, not guaranteed); occasion and requests; then the
 * wallet panel — the deposit and what's available, with the inline top-up
 * when it falls short.
 */
import { useState } from 'react';
import { ScreenShell } from '@/ui/ScreenShell';
import { SectionHeading } from '@/ui/SectionHeading';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Stepper } from '@/ui/Stepper';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { addDaysIso, dubaiDateKey } from '@/lib/time';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { periodsFor } from '@/domain/dining/periods';
import type { ServicePeriod, TableZone, VenueKey } from '@/types/dining';
import type { DeviceSlotId } from '@/types/demo';
import { Chip } from './Chip';
import { TimeChips } from './TimeChips';
import { RequestsSection, type Requests } from './RequestsSection';
import { WalletPanel } from './WalletPanel';

const VENUES: VenueKey[] = ['restaurant', 'pdr', 'teppanyaki'];
const ZONES: TableZone[] = ['indoor', 'terrace', 'canal'];
const DAYS_SHOWN = 14;

export function DiningBookScreen({
  slot,
  initialVenue,
}: {
  slot: DeviceSlotId;
  initialVenue?: VenueKey;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
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

  function reset<V>(set: (v: V) => void) {
    return (v: V) => {
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
    else setError(errorText(result.error));
  }

  return (
    <ScreenShell
      eyebrow={t('resident.home.quick.dining')}
      title={t('resident.amenityDetail.reserve')}
      onBack={pop}
      image="/amenities/dining.jpg"
      bodyClassName="gap-6"
      footer={
        <div className="border-border-card bg-pearl-glass shrink-0 border-t-[0.5px] px-4 py-3 backdrop-blur-xl">
          <Button fullWidth disabled={!start} onClick={reserve}>
            {request ? t('dining.sendRequest') : t('dining.reserve')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        {VENUES.map((v) => (
          <Chip key={v} active={venue === v} onClick={() => reset(setVenue)(v)}>
            {t(`dining.venue.${v}`)}
          </Chip>
        ))}
      </div>
      <SectionHeading title={t('padel.date')} />
      <div className="flex flex-wrap gap-2">
        {days.map((d) => (
          <Chip key={d} active={day === d} onClick={() => reset(setDay)(d)}>
            {fmt.dateKey(d, 'EEE d')}
          </Chip>
        ))}
      </div>
      <Stepper
        label={t('dining.partySize')}
        value={size}
        min={min}
        max={max}
        onChange={reset(setParty)}
      />
      {windows.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {windows.map((w) => (
            <Chip
              key={w.period}
              active={window.period === w.period}
              onClick={() => reset(setPeriod)(w.period)}
            >
              {t(`dining.period.${w.period}`)}
            </Chip>
          ))}
        </div>
      )}
      <TimeChips
        venue={venue}
        window={window}
        partySize={size}
        value={start}
        onChange={(time) => {
          setStart(time);
          setError(undefined);
        }}
      />
      {venue === 'restaurant' && (
        <section className="flex flex-col gap-2">
          <SectionHeading title={t('dining.seating')} />
          <div className="flex flex-wrap gap-2">
            {ZONES.map((z) => (
              <Chip key={z} active={zone === z} onClick={() => setZone(zone === z ? undefined : z)}>
                {t(`dining.zone.${z}`)}
              </Chip>
            ))}
          </div>
          <p className="text-body-3 text-text-muted">{t('dining.zoneNote')}</p>
        </section>
      )}
      <RequestsSection value={requests} onChange={setRequests} />
      <WalletPanel slot={slot} venue={venue} partySize={size} />
      {request && (
        <Banner style="info">
          {t('dining.requestMode', { size: rules.dining.restaurant.requestModeMinPartySize })}
        </Banner>
      )}
      {error && <Banner style="urgent">{error}</Banner>}
    </ScreenShell>
  );
}
