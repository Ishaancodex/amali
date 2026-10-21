'use client';

/** One age band on the room board: ratio gauge, staff on it, and the over-ratio alarm. */
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { RingGauge } from '@/ui/RingGauge';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { ratioGauge } from '@/features/creche/ratioGauge';
import { useT } from '@/i18n/hooks';
import { rules } from '@/config/rules';
import type { BandLoad } from '@/domain/creche/capacity';
import type { Staff } from '@/types/community';

export function BandCard({
  load,
  staff,
  canAddCover,
  onAddCover,
}: {
  load: BandLoad;
  staff: Record<string, Staff>;
  canAddCover: boolean;
  onAddCover: () => void;
}) {
  const t = useT();
  const gauge = ratioGauge(load);
  const { minAge, maxAge, ratioStaffToChildren } = rules.creche.bands[load.band];
  const over = load.overBy > 0;

  return (
    <Card className={over ? 'border-danger flex flex-col gap-3' : 'flex flex-col gap-3'}>
      <div className="flex items-center gap-4">
        <RingGauge fraction={gauge.fraction} band={gauge.band} size={64} strokeWidth={6}>
          <span className="text-label-2 text-text-title tabular-nums">
            {load.inRoom}/{load.capacity}
          </span>
        </RingGauge>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-label-1 text-text-title">{t(`kids.band.${load.band}`)}</p>
            <span className="text-body-3 text-text-placeholder">
              {minAge}–{maxAge} · 1:{ratioStaffToChildren}
            </span>
          </div>
          {over ? (
            <Tag variant="danger" className="mt-1">
              {t('creche.overRatio', { count: load.overBy })}
            </Tag>
          ) : (
            <p className="text-body-3 text-text-muted mt-1">
              {t('kids.placesLeft', { count: load.capacity - load.inRoom })}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {load.staffIds.length === 0 ? (
              <span className="text-body-3 text-danger">{t('creche.noCarer')}</span>
            ) : (
              load.staffIds.map((id) => (
                <span key={id} className="text-body-3 text-text-body flex items-center gap-1">
                  <ChildAvatar initials={staff[id]?.avatar ?? '?'} size="sm" />
                  {staff[id]?.name}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
      {over && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-3 text-danger">{t('creche.checkInsBlocked')}</p>
          {canAddCover && <Button onClick={onAddCover}>{t('creche.addCover')}</Button>}
        </div>
      )}
    </Card>
  );
}
