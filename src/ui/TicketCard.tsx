'use client';

/**
 * "Next up" as a ticket stub: an Ember card with a dashed perforation and two notches cut into
 * the stub edge. The whole card is one button (opens the pass).
 */
import { Ticket } from './icons';
import { Eyebrow } from './Eyebrow';

export function TicketCard({
  eyebrow,
  title,
  subtitle,
  stubLabel,
  onClick,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  stubLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-ember text-on-ember rounded-sheet shadow-card-hover flex w-full items-stretch overflow-hidden text-start transition-transform active:scale-[0.98]"
    >
      <div className="flex-1 px-5 py-4">
        <Eyebrow className="text-sand-soft">{eyebrow}</Eyebrow>
        <p className="font-serif-display text-serif-title mt-1.5">{title}</p>
        <p className="text-body-3 text-on-ember-muted mt-1.5">{subtitle}</p>
      </div>
      <div className="border-ember-hairline text-sand-soft relative flex w-24 flex-col items-center justify-center gap-2 border-s border-dashed">
        <span className="bg-bg-page absolute -start-2 -top-2 h-4 w-4 rounded-full" />
        <span className="bg-bg-page absolute -start-2 -bottom-2 h-4 w-4 rounded-full" />
        <Ticket className="h-6 w-6" strokeWidth={1.5} />
        <Eyebrow className="text-sand-soft">{stubLabel}</Eyebrow>
      </div>
    </button>
  );
}
