'use client';

/**
 * The F&B ops tablet (PRD §6.4): venue × service period, then the
 * Timeline (drag to reassign, M24), the Floor plan, Covers, and the
 * manager's Approvals — with the Arrivals list always alongside.
 * Tapping any booking opens its panel (seat, no-show, party size, note,
 * bill, settle).
 */
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useFmt, useT } from '@/i18n/hooks';
import { useStore } from '@/store';
import type { ServicePeriod, VenueKey } from '@/types/dining';
import type { DeviceSlotId } from '@/types/demo';
import { Banner } from '@/ui/Banner';
import { rules } from '@/config/rules';
import { ramadanLunchConflicts } from '@/domain/dining/periods';
import { useService } from '../useService';
import { Timeline } from './parts/Timeline';
import { FloorPlan } from './parts/FloorPlan';
import { CoversView } from './parts/CoversView';
import { Approvals } from './parts/Approvals';
import { Arrivals } from './parts/Arrivals';
import { ReservationPanel } from './parts/ReservationPanel';
import { WalkInSheet } from './parts/WalkInSheet';

const VENUES: VenueKey[] = ['restaurant', 'pdr', 'teppanyaki'];
type Tab = 'timeline' | 'floor' | 'covers' | 'approvals';

function Segment<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="bg-brand-tint rounded-tag flex gap-0.5 p-0.5">
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          onClick={() => onChange(i.key)}
          className={cn(
            'rounded-tag text-label-3 px-3 py-1.5',
            value === i.key ? 'bg-brand text-on-brand' : 'text-brand',
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function FnbHomeScreen({
  slot,
  initialVenue,
}: {
  slot: DeviceSlotId;
  initialVenue?: VenueKey;
}) {
  const t = useT();
  const fmt = useFmt();
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const staffMember = useStore((s) => s.staff[actorId]);
  const [venue, setVenue] = useState<VenueKey>(initialVenue ?? 'restaurant');
  const [period, setPeriod] = useState<ServicePeriod | undefined>();
  const [tab, setTab] = useState<Tab>('timeline');
  const [openId, setOpenId] = useState<string | undefined>();
  const [walkIn, setWalkIn] = useState(false);
  const service = useService(venue, period);

  if (!staffMember) return null;
  const requests = service.all.filter((r) => r.state === 'requested').length;
  const ramadanClashes = ramadanLunchConflicts(service.all, rules.dining);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'timeline', label: t('fnb.tab.timeline') },
    { key: 'floor', label: t('fnb.tab.floor') },
    { key: 'covers', label: t('fnb.tab.covers') },
    {
      key: 'approvals',
      label: requests ? `${t('fnb.tab.approvals')} · ${requests}` : t('fnb.tab.approvals'),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="border-border-card flex flex-wrap items-center gap-3 border-b-[0.5px] px-5 py-3">
        <div className="me-2">
          <p className="text-tag font-secondary text-brand">
            {t('fnb.role')} · {staffMember.name}
          </p>
          <p className="text-label-1 text-text-title">
            {t(`dining.period.${service.window.period}`)} · {fmt.time(service.window.start)}–
            {fmt.time(service.window.end)}
          </p>
        </div>
        <Segment
          items={VENUES.map((v) => ({ key: v, label: t(`dining.venue.${v}`) }))}
          value={venue}
          onChange={(v) => {
            setVenue(v);
            setPeriod(undefined);
          }}
        />
        <Segment
          items={service.windows.map((w) => ({
            key: w.period,
            label: t(`dining.period.${w.period}`),
          }))}
          value={service.window.period}
          onChange={setPeriod}
        />
        <div className="ms-auto">
          <Segment items={tabs} value={tab} onChange={setTab} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto p-4">
          {ramadanClashes.length > 0 && (
            <div className="mb-3">
              <Banner style="warning">
                {t('fnb.ramadanClash', { count: ramadanClashes.length })}
              </Banner>
            </div>
          )}
          {tab === 'timeline' && (
            <Timeline slot={slot} venue={venue} period={period} onOpen={setOpenId} />
          )}
          {tab === 'floor' && (
            <FloorPlan
              venue={venue}
              period={period}
              onOpen={setOpenId}
              onWalkIn={() => setWalkIn(true)}
            />
          )}
          {tab === 'covers' && <CoversView venue={venue} period={period} />}
          {tab === 'approvals' && <Approvals slot={slot} />}
        </main>
        <aside className="border-border-card w-80 shrink-0 overflow-y-auto border-s-[0.5px] p-4">
          <Arrivals
            slot={slot}
            venue={venue}
            period={period}
            onOpen={setOpenId}
            onWalkIn={() => setWalkIn(true)}
          />
        </aside>
      </div>
      <ReservationPanel slot={slot} reservationId={openId} onClose={() => setOpenId(undefined)} />
      <WalkInSheet slot={slot} venue={venue} open={walkIn} onClose={() => setWalkIn(false)} />
    </div>
  );
}
