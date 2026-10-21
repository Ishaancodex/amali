'use client';

/**
 * Amenity detail (PRD §6.1, §8). Padel/Screening/Music/Creche/Dining book
 * for real; Pool/Gym are
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
import { CrecheParentCard } from './creche/CrecheParentCard';
import { DiningStatusCard } from './dining/DiningStatusCard';
import { estimateOccupancy } from '@/domain/ops/occupancyEstimate';
import { buildOccupancyEstimate } from '@/domain/ops/occupancy';
import { useStore } from '@/store';
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { useNav } from '@/navigation/useNav';
import { selectCurrentStatusEntry } from '@/store/selectors/amenities';
import { rules } from '@/config/rules';
import type { DeviceSlotId } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';
import { useAmenityLabel, useFmt, useT, type T } from '@/i18n/hooks';

const HOURS_TABLE_KEYS: readonly AmenityKey[] = ['padel', 'pool', 'gym'];

function rulesSummaryFor(key: AmenityKey, t: T, aed: (fils: number) => string): string {
  const r = 'resident.amenityDetail.rules';
  switch (key) {
    case 'padel':
      return t(`${r}.padel`, {
        durations: rules.padel.durationsMinutes.join('/'),
        days: rules.padel.bookingWindowDays,
        perWeek: rules.padel.quota.maxBookings,
      });
    case 'screening':
      return t(`${r}.screening`, { guests: rules.screening.maxGuestsPerUnitPerShowtime });
    case 'music':
      return t(`${r}.music`, {
        capacity: rules.music.capacity,
        guests: rules.music.maxGuestsPerUnitPerShowtime,
      });
    case 'creche':
      return t(`${r}.creche`, {
        morning: `${rules.creche.sessions.morning.start}–${rules.creche.sessions.morning.end}`,
        afternoon: `${rules.creche.sessions.afternoon.start}–${rules.creche.sessions.afternoon.end}`,
        fee: aed(rules.creche.tenantFeePerHourFils),
      });
    case 'dining':
      return t(`${r}.dining`, { max: rules.dining.restaurant.partySize.max });
    case 'pool':
      return t(`${r}.pool`, { age: rules.pool.minAge, capacity: rules.pool.capacity });
    case 'gym':
      return t(`${r}.gym`, { capacity: rules.gym.capacity });
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
  const t = useT();
  const fmt = useFmt();
  const amenityLabel = useAmenityLabel();
  const { pop, push } = useNav(slot);
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
      <TopBar title={amenityLabel(amenityKey)} onBack={pop} />
      {/* Focusable so the page can be scrolled from the keyboard (axe scrollable-region-focusable). */}
      <div className="flex-1 overflow-y-auto" tabIndex={0}>
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
              {t('resident.amenityDetail.tenantAccess', {
                date: fmt.date(unit.leaseEnd, 'd MMM yyyy'),
              })}
            </Banner>
          )}

          <p className="text-body-2 text-text-muted">{rulesSummaryFor(amenityKey, t, fmt.aed)}</p>

          {amenityKey === 'pool' && (
            <div>
              <h2 className="text-label-1 text-text-title mb-2">
                {t('resident.amenityDetail.liveOccupancy')}
              </h2>
              <OccupancyRing estimate={buildOccupancyEstimate(poolOccupancy, amenity.capacity)} />
            </div>
          )}
          {amenityKey === 'gym' && (
            <div>
              <h2 className="text-label-1 text-text-title mb-2">
                {t('resident.amenityDetail.liveOccupancy')}
              </h2>
              <OccupancyRing estimate={estimateOccupancy(now, amenity.capacity)} />
            </div>
          )}

          {HOURS_TABLE_KEYS.includes(amenityKey) && (
            <div>
              <h2 className="text-label-1 text-text-title mb-2">
                {t('resident.amenityDetail.hoursThisWeek')}
              </h2>
              <HoursTable hours={hours} exceptions={exceptions} now={now} />
            </div>
          )}

          {amenityKey === 'padel' && <PadelStatusCard slot={slot} />}
          {amenityKey === 'creche' && <CrecheParentCard slot={slot} />}
          {amenityKey === 'dining' && <DiningStatusCard slot={slot} />}

          {amenityKey === 'padel' ? (
            <Button
              variant="primary"
              fullWidth
              disabled={accessBlocked}
              onClick={() => push('padel-book')}
            >
              {accessBlocked ? t('resident.amenityDetail.unavailable') : t('ui.book')}
            </Button>
          ) : amenityKey === 'creche' ? (
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => push('creche-pass')}>
                {t('resident.amenityDetail.dropOffPass')}
              </Button>
              <Button
                variant="primary"
                fullWidth
                disabled={accessBlocked}
                onClick={() => push('creche-book')}
              >
                {accessBlocked ? t('resident.amenityDetail.unavailable') : t('ui.book')}
              </Button>
            </div>
          ) : amenityKey === 'screening' || amenityKey === 'music' ? (
            <Button
              variant="primary"
              fullWidth
              disabled={accessBlocked}
              onClick={() => push('whats-on')}
            >
              {accessBlocked
                ? t('resident.amenityDetail.unavailable')
                : t('resident.amenityDetail.seeWhatsOn')}
            </Button>
          ) : amenityKey === 'dining' ? (
            <Button
              variant="primary"
              fullWidth
              disabled={accessBlocked}
              onClick={() => push('dining-book')}
            >
              {accessBlocked
                ? t('resident.amenityDetail.unavailable')
                : t('resident.amenityDetail.reserve')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
