'use client';

/** The RSVP's outcome (PRD §8.2, M9): the confirmation screen, and the "you're going" card with Cancel. */
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { ConfirmedMark, Ticket } from '@/ui/ConfirmedMark';
import { useFmt, useT } from '@/i18n/hooks';
import type { Rsvp, Showtime } from '@/types/event';

export function RsvpConfirmed({
  showtime,
  onDone,
}: {
  showtime: Showtime | undefined;
  onDone: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('events.confirmedTitle')} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <ConfirmedMark />
        <p className="text-title-l text-text-title">{t('events.onTheList')}</p>
        {showtime && (
          <Ticket>
            <p className="text-body-2 text-text-muted">
              {fmt.date(showtime.start)} · {fmt.time(showtime.start)}
            </p>
          </Ticket>
        )}
        <Button fullWidth onClick={onDone}>
          {t('common.done')}
        </Button>
      </div>
    </div>
  );
}

export function MyRsvp({ rsvp, onCancel }: { rsvp: Rsvp; onCancel: () => void }) {
  const t = useT();
  return (
    <div className="mt-4">
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
