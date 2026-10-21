'use client';

/**
 * Event RSVP inputs (PRD §8.2): the showtime chips and who's coming — you,
 * household members, guest adults and (when the rating allows) guest
 * children, capped at the venue's guest limit.
 */
import { Stepper } from '@/ui/Stepper';
import { FillChip } from '@/ui/FillChip';
import { useFmt, useT } from '@/i18n/hooks';
import type { Showtime } from '@/types/event';

export function ShowtimePicker({
  showtimes,
  value,
  onChange,
}: {
  showtimes: Showtime[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  return (
    <>
      <h2 className="text-label-1 text-text-title mt-5 mb-2">{t('events.showtime')}</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {showtimes.map((sh) => (
          <FillChip
            key={sh.id}
            selected={sh.id === value}
            onClick={() => onChange(sh.id)}
            className="text-body-3 shrink-0 px-3 py-2"
          >
            {fmt.date(sh.start, 'EEE d MMM')} · {fmt.time(sh.start)}
          </FillChip>
        ))}
      </div>
    </>
  );
}

export interface Party {
  household: number;
  guestAdult: number;
  guestChild: number;
}

export function PartySteppers({
  value,
  onChange,
  maxGuests,
  childrenAllowed,
}: {
  value: Party;
  onChange: (party: Party) => void;
  maxGuests: number;
  childrenAllowed: boolean;
}) {
  const t = useT();
  return (
    <>
      <h2 className="text-label-1 text-text-title mt-5 mb-2">{t('events.whosComing')}</h2>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-body-2 text-text-body">{t('events.you')}</span>
          <span className="text-label-2 text-text-muted">1</span>
        </div>
        <Stepper
          label={t('events.householdMembers')}
          value={value.household}
          min={0}
          max={6}
          onChange={(household) => onChange({ ...value, household })}
        />
        <Stepper
          label={t('events.guestAdults')}
          value={value.guestAdult}
          min={0}
          max={maxGuests - value.guestChild}
          onChange={(guestAdult) => onChange({ ...value, guestAdult })}
        />
        {childrenAllowed && (
          <Stepper
            label={t('events.guestChildren')}
            value={value.guestChild}
            min={0}
            max={maxGuests - value.guestAdult}
            onChange={(guestChild) => onChange({ ...value, guestChild })}
          />
        )}
      </div>
    </>
  );
}
