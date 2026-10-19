'use client';

/**
 * Amenity detail (PRD §6.1, §8). Padel/Screening/Music/Creche/Dining show
 * rules + a "Book" stub (the booking flows land P3-P8); Pool/Gym are
 * read-only status + live occupancy, which is their permanent final form.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Skeleton } from '@/ui/Skeleton';
import { HoursTable } from '@/features/status/HoursTable';
import { AmenityStatusTag } from '@/features/status/AmenityStatusTag';
import { OccupancyRing } from '@/features/status/OccupancyRing';
import { AMENITY_ICON } from '@/features/status/amenityIcons';
import { PadelStatusCard } from './padel/PadelStatusCard';
import { estimateOccupancy } from '@/domain/ops/occupancyEstimate';
import { buildOccupancyEstimate } from '@/domain/ops/occupancy';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { useNav } from '@/navigation/useNav';
import { selectCurrentStatusEntry } from '@/store/selectors/amenities';
import { rules } from '@/config/rules';
import type { DeviceSlotId } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';

const HOURS_TABLE_KEYS: readonly AmenityKey[] = ['padel', 'pool', 'gym'];

function rulesSummaryFor(key: AmenityKey): string {
  switch (key) {
    case 'padel':
      return `${rules.padel.durationsMinutes.join('/')} min · ${rules.padel.bookingWindowDays}-day window · ${rules.padel.quota.maxBookings} per week`;
    case 'screening':
      return `Seat map · up to ${rules.screening.maxGuestsPerUnitPerShowtime} guests per showtime`;
    case 'music':
      return `Headcount cap ${rules.music.capacity} · up to ${rules.music.maxGuestsPerUnitPerShowtime} guests`;
    case 'creche':
      return `Sessions ${rules.creche.sessions.morning.start}-${rules.creche.sessions.morning.end} & ${rules.creche.sessions.afternoon.start}-${rules.creche.sessions.afternoon.end} · owners free, tenants AED ${rules.creche.tenantFeePerHourFils / 100}/hr`;
    case 'dining':
      return `Restaurant · Private Dining · Teppanyaki · party size 1-${rules.dining.restaurant.partySize.max}`;
    case 'pool':
      return `Adults ${rules.pool.minAge}+ · capacity ${rules.pool.capacity}`;
    case 'gym':
      return `Open 24h · capacity ${rules.gym.capacity}`;
  }
}

export function AmenityDetailScreen({
  slot,
  amenityKey: amenityKeyProp,
}: {
  slot: DeviceSlotId;
  amenityKey: string;
}) {
  const amenityKey = amenityKeyProp as AmenityKey;
  const { pop, push } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const unit = useStore((s) => (resident ? s.units[resident.unitId] : undefined));
  const amenity = useStore((s) => s.amenities[amenityKey]);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const hoursAll = useStore((s) => s.hours);
  const hours = hoursAll.filter((h) => h.amenity === amenityKey);
  const exceptionsRecord = useStore((s) => s.exceptions);
  const exceptions = Object.values(exceptionsRecord).filter((e) => e.amenity === amenityKey);
  const now = useStore((s) => s.demo.clock.now);
  const poolOccupancy = useStore((s) => s.occupancy.pool ?? 0);
  const [imageFailed, setImageFailed] = useState(false);

  const { status, data } = useSimulatedQuery(`amenity-detail:${amenityKey}`, () => ({
    currentStatusEntry: selectCurrentStatusEntry({ amenityStatus }, amenityKey, now),
  }));

  if (!amenity) return null;

  const Icon = AMENITY_ICON[amenityKey];
  const accessBlocked = !!unit && !!resident && unit.amenityRightsHolderId !== resident.id;

  return (
    <div className="flex h-full flex-col">
      <TopBar title={amenity.name} onBack={pop} />
      <div className="flex-1 overflow-y-auto">
        <div className="relative h-48 w-full">
          {imageFailed ? (
            <div className="from-brand-tint to-gradient-placeholder-end flex h-full w-full items-center justify-center bg-gradient-to-br">
              <Icon className="text-brand h-10 w-10" strokeWidth={1.5} />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={amenity.image}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          )}
        </div>

        <div className="flex flex-col gap-4 p-4">
          {status === 'loading' ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <div className="flex items-center gap-2">
              <AmenityStatusTag status={data.currentStatusEntry?.status ?? 'open'} />
              {data.currentStatusEntry?.reason && (
                <span className="text-body-3 text-text-muted">
                  {data.currentStatusEntry.reason}
                </span>
              )}
            </div>
          )}

          {accessBlocked && unit?.leaseEnd && (
            <Banner style="warning">
              Access is with your tenant until {new Date(unit.leaseEnd).toLocaleDateString('en-GB')}
              .
            </Banner>
          )}

          <p className="text-body-2 text-text-muted">{rulesSummaryFor(amenityKey)}</p>

          {amenityKey === 'pool' && (
            <div>
              <h2 className="text-label-1 text-text-title mb-2">Live occupancy</h2>
              <OccupancyRing estimate={buildOccupancyEstimate(poolOccupancy, amenity.capacity)} />
            </div>
          )}
          {amenityKey === 'gym' && (
            <div>
              <h2 className="text-label-1 text-text-title mb-2">Live occupancy</h2>
              <OccupancyRing estimate={estimateOccupancy(now, amenity.capacity)} />
            </div>
          )}

          {HOURS_TABLE_KEYS.includes(amenityKey) && (
            <div>
              <h2 className="text-label-1 text-text-title mb-2">Hours this week</h2>
              <HoursTable hours={hours} exceptions={exceptions} now={now} />
            </div>
          )}

          {amenityKey === 'padel' && <PadelStatusCard slot={slot} />}

          {amenityKey === 'padel' ? (
            <Button
              variant="primary"
              fullWidth
              disabled={accessBlocked}
              onClick={() => push('padel-book')}
            >
              {accessBlocked ? 'Booking unavailable' : 'Book'}
            </Button>
          ) : amenityKey === 'screening' || amenityKey === 'music' ? (
            <Button
              variant="primary"
              fullWidth
              disabled={accessBlocked}
              onClick={() => push('whats-on')}
            >
              {accessBlocked ? 'Booking unavailable' : "See what's on"}
            </Button>
          ) : (
            amenityKey !== 'pool' &&
            amenityKey !== 'gym' && (
              <Button
                variant="primary"
                fullWidth
                disabled={accessBlocked}
                onClick={() =>
                  pushToast(slot, 'Booking opens in a later phase (TRD §13).', 'neutral')
                }
              >
                {accessBlocked ? 'Booking unavailable' : 'Book'}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
