'use client';

/**
 * Info card (PRD §5.7): used for announcements and tickets. 36px avatar or
 * icon, title row with a status tag, meta row with a dot separator, body
 * truncated with "Show More", a divider, a footer row.
 */
import { useState } from 'react';
import { Card } from './Card';
import type { LucideIcon } from './icons';

export function InfoCard({
  icon: Icon,
  title,
  tag,
  meta,
  body,
  footer,
}: {
  icon: LucideIcon;
  title: string;
  tag?: React.ReactNode;
  meta: string[];
  body?: string;
  footer?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (body?.length ?? 0) > 120;

  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <span className="bg-brand-tint flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <Icon className="text-brand h-4 w-4" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-label-2 text-text-title truncate">{title}</span>
            {tag}
          </div>
          <div className="text-body-3 text-text-muted flex items-center gap-1.5">
            {meta.map((m, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>·</span>}
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      {body && (
        <p className={`text-body-2 text-text-body ${!expanded && isLong ? 'line-clamp-2' : ''}`}>
          {body}
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-label-3 text-brand ms-1.5"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </p>
      )}

      {footer && (
        <>
          <div className="bg-border-card h-px" />
          {footer}
        </>
      )}
    </Card>
  );
}
