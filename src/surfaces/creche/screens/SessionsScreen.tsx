'use client';

/** Today's sessions (PRD §6.3): bookings per band, expected arrivals, who's in, and the waitlist. */
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { EmptyState } from '@/ui/EmptyState';
import { CalendarDays } from '@/ui/icons';
import { BAND_ORDER } from '@/domain/creche/bands';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { dubaiDateKey } from '@/lib/time';
import { useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';

export function SessionsScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const { push } = useNav(slot);
  const crecheSessions = useStore((s) => s.crecheSessions);
  const crecheBookings = useStore((s) => s.crecheBookings);
  const children = useStore((s) => s.children);
  const now = useStore((s) => s.demo.clock.now);

  const today = dubaiDateKey(now);
  const sessions = Object.values(crecheSessions)
    .filter((s) => s.date === today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const bookings = Object.values(crecheBookings);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <h1 className="text-title-l text-text-title">{t('creche.todaysSessions')}</h1>
      {sessions.length === 0 && <EmptyState icon={CalendarDays} message={t('creche.noSessions')} />}
      {sessions.map((session) => {
        const inSession = bookings.filter(
          (b) => b.sessionId === session.id && b.state !== 'cancelled',
        );
        const waitlist = inSession.filter((b) => b.state === 'waitlisted');
        return (
          <section key={session.id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-label-1 text-text-title">
                {t(`creche.kind.${session.kind}`)} · {fmt.time(session.start)}–
                {fmt.time(session.end)}
              </h2>
              <span className="text-body-3 text-text-muted">
                {t('creche.booked', {
                  count: inSession.filter((b) => b.state !== 'waitlisted').length,
                })}
              </span>
            </div>
            {BAND_ORDER.map((band) => {
              const rows = inSession.filter((b) => b.band === band && b.state !== 'waitlisted');
              if (rows.length === 0) return null;
              const expected = rows.filter((b) => b.state === 'confirmed').length;
              const arrived = rows.filter((b) => b.state === 'checked_in').length;
              return (
                <Card key={band} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-label-2 text-text-title">{t(`kids.band.${band}`)}</p>
                    <span className="text-body-3 text-text-muted">
                      {t('creche.inExpected', { arrived, expected })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rows.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => push('check', { child: b.childId })}
                      >
                        <Tag
                          variant={
                            b.state === 'checked_in'
                              ? 'success'
                              : b.state === 'checked_out'
                                ? 'info'
                                : 'brand'
                          }
                        >
                          {children[b.childId]?.name.split(' ')[0]}
                        </Tag>
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
            {waitlist.length > 0 && (
              <p className="text-body-3 text-warning">
                {t('creche.waitlistNames', {
                  names: waitlist.map((b) => children[b.childId]?.name.split(' ')[0]).join(', '),
                })}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
