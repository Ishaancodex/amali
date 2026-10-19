'use client';

/**
 * The child's card at the door (PRD §8.3 step 2): photo, age band,
 * allergies in red, today's booking, and the guardians' photos for a
 * visual match. Pick who's at the desk, then check in or out.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Banner } from '@/ui/Banner';
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Check } from '@/ui/icons';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { BAND_LABEL, ageOnDate, bandForChild } from '@/domain/creche/bands';
import { guardianAuthorisation } from '@/domain/creche/guardians';
import { useStore } from '@/store';
import { selectBoardSession } from '@/store/selectors/creche';
import { rules } from '@/config/rules';
import { cn } from '@/lib/cn';
import { dubaiDateKey } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import { CheckInPanel } from './CheckInPanel';
import { CheckOutPanel } from './CheckOutPanel';

export function ChildCheckCard({
  slot,
  childId,
  initialGuardianId,
  onBack,
}: {
  slot: DeviceSlotId;
  childId: string;
  initialGuardianId?: string;
  onBack: () => void;
}) {
  const child = useStore((s) => s.children[childId]);
  const guardians = useStore((s) => s.guardians);
  const crecheBookings = useStore((s) => s.crecheBookings);
  const crecheSessions = useStore((s) => s.crecheSessions);
  const now = useStore((s) => s.demo.clock.now);
  const [guardianId, setGuardianId] = useState(initialGuardianId ?? child?.guardianIds[0] ?? '');

  if (!child) return null;

  const today = dubaiDateKey(now);
  const age = ageOnDate(child.dob, today);
  const band = bandForChild(child.dob, today, rules.creche.bands, rules.creche.minAcceptedAge);
  const session = selectBoardSession({ crecheSessions }, now);
  const inRoom = Object.values(crecheBookings).find(
    (b) => b.childId === child.id && b.state === 'checked_in',
  );
  const booking =
    inRoom ??
    Object.values(crecheBookings).find(
      (b) => b.childId === child.id && b.sessionId === session?.id && b.state !== 'cancelled',
    );

  return (
    <div className="flex h-full flex-col">
      <TopBar title={inRoom ? 'Check out' : 'Check in'} onBack={onBack} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 [&>*]:shrink-0">
        <div className="flex items-center gap-4 pt-2">
          <ChildAvatar initials={child.photo} size="lg" />
          <div>
            <p className="text-title-l text-text-title">{child.name}</p>
            <p className="text-body-2 text-text-muted">
              {age} yrs · {band.ok ? BAND_LABEL[band.band] : band.message}
            </p>
            <div className="mt-1">
              {booking ? (
                <Tag variant={booking.state === 'waitlisted' ? 'warning' : 'success'}>
                  {booking.state === 'checked_in'
                    ? 'In the room'
                    : booking.state === 'waitlisted'
                      ? 'Waitlisted'
                      : 'Booked'}
                </Tag>
              ) : (
                <Tag variant="warning">No booking now</Tag>
              )}
            </div>
          </div>
        </div>

        {child.allergies && (
          <Banner style={child.allergies.severe ? 'urgent' : 'warning'}>
            {child.allergies.severe ? 'Severe allergy: ' : 'Allergy: '}
            {child.allergies.text}
          </Banner>
        )}
        {child.dietary && <p className="text-body-3 text-text-muted">Diet: {child.dietary}</p>}

        <section className="flex flex-col gap-2">
          <h2 className="text-label-1 text-text-title">Who’s here?</h2>
          {child.guardianIds.map((gId) => {
            const g = guardians[gId];
            if (!g) return null;
            const auth = guardianAuthorisation(g, child, now);
            return (
              <button
                key={gId}
                type="button"
                className="text-start"
                onClick={() => setGuardianId(gId)}
              >
                <Card
                  className={cn('flex items-center gap-3', guardianId === gId && 'border-brand')}
                >
                  <ChildAvatar initials={g.photo} />
                  <div className="min-w-0 flex-1">
                    <p className="text-label-2 text-text-title">{g.name}</p>
                    <p className="text-body-3 text-text-muted">
                      {g.relation} · ID ••{g.idLast4}
                    </p>
                  </div>
                  {guardianId === gId && (
                    <Check className="text-brand h-4 w-4" strokeWidth={2} aria-label="Selected" />
                  )}
                  <Tag variant={auth.ok ? 'success' : 'danger'}>
                    {auth.ok
                      ? 'Authorised'
                      : auth.reason === 'pending'
                        ? 'Pending'
                        : auth.reason === 'expired'
                          ? 'Expired'
                          : 'Not authorised'}
                  </Tag>
                </Card>
              </button>
            );
          })}
        </section>

        {inRoom ? (
          <CheckOutPanel slot={slot} booking={inRoom} guardianId={guardianId} />
        ) : (
          <CheckInPanel slot={slot} child={child} guardianId={guardianId} />
        )}
      </div>
    </div>
  );
}
