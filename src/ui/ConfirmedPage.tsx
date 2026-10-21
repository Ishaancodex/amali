'use client';

/**
 * Success page for a booking flow (M9): the check mark draws itself, a serif headline, and the
 * ticket rises with one sheen. Built on `ScreenShell` so it shares the header and arrival motion.
 */
import { ScreenShell } from './ScreenShell';
import { ConfirmedMark, Ticket } from './ConfirmedMark';
import { Button } from './Button';

export function ConfirmedPage({
  eyebrow,
  title,
  image,
  headline,
  detail,
  primary,
  secondary,
}: {
  eyebrow?: string;
  title: string;
  image?: string;
  headline: string;
  detail?: React.ReactNode;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <ScreenShell
      eyebrow={eyebrow}
      title={title}
      image={image}
      bodyClassName="items-center gap-5 text-center"
    >
      <ConfirmedMark />
      <p className="font-serif-display text-serif-title text-text-title">{headline}</p>
      {detail && <Ticket>{detail}</Ticket>}
      <div className="flex w-full flex-col gap-2">
        {secondary && (
          <Button variant="secondary" fullWidth onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
        <Button fullWidth onClick={primary.onClick}>
          {primary.label}
        </Button>
      </div>
    </ScreenShell>
  );
}
