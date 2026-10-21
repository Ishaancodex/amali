'use client';

/**
 * New season (PRD §8.6): a named date range with a banner and optional
 * hours overrides for one amenity. On save, any class those hours now
 * exclude is listed with a suggested time — flagged, not moved.
 */
import { useState } from 'react';
import { Sheet } from '@/ui/Sheet';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/cn';
import { useAmenityLabel, useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { AmenityKey } from '@/types/amenity';
import type { Season } from '@/types/event';
import type { DeviceSlotId } from '@/types/demo';
import type { SeasonClash } from '@/store/commands/season';
import { useConsoleActor } from '../../useConsoleActor';

const TONES: NonNullable<Season['tone']>[] = ['info', 'success', 'warning', 'brand'];
const TONE_CLASS = {
  info: 'bg-info/30',
  success: 'bg-success/30',
  warning: 'bg-warning/30',
  brand: 'bg-brand',
};
const AMENITIES: AmenityKey[] = ['pool', 'gym', 'padel'];

export function SeasonSheet({
  slot,
  open,
  onClose,
}: {
  slot: DeviceSlotId;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const amenityLabel = useAmenityLabel();
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const { actor, assignedAmenities } = useConsoleActor(slot);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [banner, setBanner] = useState('');
  const [tone, setTone] = useState<NonNullable<Season['tone']>>('info');
  const [hoursOn, setHoursOn] = useState(false);
  const [amenity, setAmenity] = useState<AmenityKey>('pool');
  const [openAt, setOpenAt] = useState('08:00');
  const [closeAt, setCloseAt] = useState('20:00');
  const [clashes, setClashes] = useState<SeasonClash[] | undefined>();

  function close() {
    setClashes(undefined);
    setName('');
    onClose();
  }

  function save() {
    if (!actor) return;
    const result = dispatch(
      'season.create',
      {
        name,
        startDate,
        endDate,
        banner,
        tone,
        hours: hoursOn ? [{ amenity, open: openAt, close: closeAt }] : [],
      },
      actor,
      { assignedAmenities },
    );
    if (!result.ok) {
      pushToast(slot, errorText(result.error), 'error');
      return;
    }
    pushToast(slot, t('console.season.saved', { name: result.value.season.name }), 'success');
    if (result.value.clashes.length) setClashes(result.value.clashes);
    else close();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={clashes ? t('console.season.toMove') : t('console.programme.newSeason')}
    >
      {clashes ? (
        <div className="flex flex-col gap-3 pb-2">
          {clashes.map((c) => (
            <Banner key={c.programmeId} style="warning">
              {t('console.season.clash', { title: c.title, count: c.occurrences })}
              {c.suggestedStart
                ? ` ${t('console.series.moveTo', { time: fmt.time(c.suggestedStart) })}`
                : ''}
            </Banner>
          ))}
          <p className="text-body-3 text-text-muted">{t('console.season.howToMove')}</p>
          <Button fullWidth onClick={close}>
            {t('common.done')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <Input
            label={t('console.schedule.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('console.season.nameHint')}
          />
          <div className="flex gap-3">
            <Input
              label={t('console.from')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label={t('console.to')}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Input
            label={t('console.season.banner')}
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            placeholder={t('console.season.bannerHint')}
          />
          <div className="flex items-center gap-2">
            <span className="text-label-3 text-text-muted">{t('console.season.band')}</span>
            {TONES.map((tn) => (
              <button
                key={tn}
                type="button"
                aria-label={t(`console.season.tone.${tn}`)}
                aria-pressed={tone === tn}
                onClick={() => setTone(tn)}
                className={cn(
                  'h-6 w-6 rounded-full',
                  TONE_CLASS[tn],
                  tone === tn && 'ring-brand ring-2 ring-offset-2',
                )}
              />
            ))}
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brand h-4 w-4"
              checked={hoursOn}
              onChange={(e) => setHoursOn(e.target.checked)}
            />
            <span className="text-label-2 text-text-body">{t('console.season.changeHours')}</span>
          </label>
          {hoursOn && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex gap-1">
                {AMENITIES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmenity(a)}
                    className={cn(
                      'rounded-tag text-label-3 px-3 py-1.5',
                      amenity === a ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
                    )}
                  >
                    {amenityLabel(a, 'short')}
                  </button>
                ))}
              </div>
              <Input
                label={t('console.season.opens')}
                type="time"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
              />
              <Input
                label={t('console.season.closes')}
                type="time"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
              />
            </div>
          )}
          <Button fullWidth disabled={!name.trim() || !startDate || !endDate} onClick={save}>
            {t('console.season.save')}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
