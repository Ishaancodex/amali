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
import { fmtTime } from '@/lib/time';
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
      pushToast(slot, result.error.message, 'error');
      return;
    }
    pushToast(slot, `${result.value.season.name} saved.`, 'success');
    if (result.value.clashes.length) setClashes(result.value.clashes);
    else close();
  }

  return (
    <Sheet open={open} onClose={close} title={clashes ? 'Classes to move' : 'New season'}>
      {clashes ? (
        <div className="flex flex-col gap-3 pb-2">
          {clashes.map((c) => (
            <Banner key={c.programmeId} style="warning">
              {c.title}: {c.occurrences} {c.occurrences === 1 ? 'class falls' : 'classes fall'}{' '}
              outside the season’s hours
              {c.suggestedStart ? ` — suggest moving it to ${fmtTime(c.suggestedStart)}` : ''}.
            </Banner>
          ))}
          <p className="text-body-3 text-text-muted">
            Move them from the calendar (edit an occurrence → This and following).
          </p>
          <Button fullWidth onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramadan"
          />
          <div className="flex gap-3">
            <Input
              label="From"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="To"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Input
            label="Banner"
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            placeholder="Shown on What’s On"
          />
          <div className="flex items-center gap-2">
            <span className="text-label-3 text-text-muted">Band</span>
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={t}
                onClick={() => setTone(t)}
                className={cn(
                  'h-6 w-6 rounded-full',
                  TONE_CLASS[t],
                  tone === t && 'ring-brand ring-2 ring-offset-2',
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
            <span className="text-label-2 text-text-body">
              Change opening hours during the season
            </span>
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
                      'rounded-tag text-label-3 px-3 py-1.5 capitalize',
                      amenity === a ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <Input
                label="Opens"
                type="time"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
              />
              <Input
                label="Closes"
                type="time"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
              />
            </div>
          )}
          <Button fullWidth disabled={!name.trim() || !startDate || !endDate} onClick={save}>
            Save season
          </Button>
        </div>
      )}
    </Sheet>
  );
}
