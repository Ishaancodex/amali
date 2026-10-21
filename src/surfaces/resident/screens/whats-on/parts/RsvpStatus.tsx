'use client';

/** The RSVP's outcome (PRD §8.2, M9): the confirmation screen, and the "you're going" card with Cancel. */
import { Button } from '@/ui/Button';
import { ConfirmedPage } from '@/ui/ConfirmedPage';
import { Banner } from '@/ui/Banner';
import { useFmt, useT } from '@/i18n/hooks';
import type { Rsvp, Showtime } from '@/types/event';

export function RsvpConfirmed({
  showtime,
  image,
  onDone,
}: {
  showtime: Showtime | undefined;
  image?: string;
  onDone: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  return (
    <ConfirmedPage
      eyebrow={t('events.confirmedTitle')}
      title={t('events.onTheList')}
      image={image}
      headline={t('events.onTheList')}
      detail={
        showtime && (
          <p className="text-body-2 text-text-muted">
            {fmt.date(showtime.start)} · {fmt.time(showtime.start)}
          </p>
        )
      }
      primary={{ label: t('common.done'), onClick: onDone }}
    />
  );
}

export function MyRsvp({ rsvp, onCancel }: { rsvp: Rsvp; onCancel: () => void }) {
  const t = useT();
  return (
    <div>
      <Banner style="success">
        {t(rsvp.state === 'held' ? 'events.holding' : 'events.going', {
          count: rsvp.attendees.length,
        })}
      </Banner>
      {rsvp.state === 'confirmed' && (
        <Button variant="destructive" fullWidth className="mt-3" onClick={onCancel}>
          {t('events.cancelRsvp')}
        </Button>
      )}
    </div>
  );
}
