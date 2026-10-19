'use client';

/**
 * A child's profile (PRD §8.3, My Unit → Children): age band, allergies,
 * authorised guardians with their approval state, and the way into
 * booking. A nanny added here waits for Creche Lead approval.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { UserPlus } from '@/ui/icons';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { BAND_LABEL, ageOnDate, bandForChild } from '@/domain/creche/bands';
import { guardianAuthorisation } from '@/domain/creche/guardians';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { dubaiDateKey, fmtDate, fmtDateKey } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import { AddGuardianSheet } from './AddGuardianSheet';

export function ChildDetailScreen({ slot, childId }: { slot: DeviceSlotId; childId: string }) {
  const { pop, push } = useNav(slot);
  const child = useStore((s) => s.children[childId]);
  const guardians = useStore((s) => s.guardians);
  const now = useStore((s) => s.demo.clock.now);
  const [adding, setAdding] = useState(false);

  if (!child) return null;
  const today = dubaiDateKey(now);
  const band = bandForChild(child.dob, today, rules.creche.bands, rules.creche.minAcceptedAge);
  const full = child.guardianIds.length >= rules.creche.guardians.max;

  return (
    <div className="flex h-full flex-col">
      <TopBar title={child.name.split(' ')[0]!} onBack={pop} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
        <div className="flex items-center gap-4 pt-2">
          <ChildAvatar initials={child.photo} size="lg" />
          <div>
            <p className="text-title-l text-text-title">{child.name}</p>
            <p className="text-body-2 text-text-muted">
              {ageOnDate(child.dob, today)} yrs ·{' '}
              {band.ok ? `${BAND_LABEL[band.band]} band` : band.message}
            </p>
          </div>
        </div>

        {child.allergies && (
          <Banner style={child.allergies.severe ? 'urgent' : 'warning'}>
            {child.allergies.severe ? 'Severe allergy: ' : 'Allergy: '}
            {child.allergies.text}
          </Banner>
        )}

        <Card className="flex flex-col gap-1">
          <p className="text-body-3 text-text-muted">Born {fmtDateKey(child.dob)}</p>
          {child.dietary && <p className="text-body-3 text-text-muted">Diet: {child.dietary}</p>}
          <p className="text-body-3 text-text-muted">
            Photo consent: {child.photoConsent ? 'yes' : 'no'}
          </p>
          <p className="text-body-3 text-text-muted">
            Emergency contact: {child.emergencyContact.name} · {child.emergencyContact.phone}
          </p>
        </Card>

        {band.ok && (
          <Button fullWidth onClick={() => push('creche-book', { child: child.id })}>
            Book a session
          </Button>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-label-1 text-text-title">Authorised guardians</h2>
            <span className="text-body-3 text-text-muted">
              {child.guardianIds.length} of {rules.creche.guardians.max}
            </span>
          </div>
          {child.guardianIds.map((gId) => {
            const g = guardians[gId];
            if (!g) return null;
            const auth = guardianAuthorisation(g, child, now);
            return (
              <Card key={gId} className="flex items-center gap-3">
                <ChildAvatar initials={g.photo} />
                <div className="min-w-0 flex-1">
                  <p className="text-label-2 text-text-body">{g.name}</p>
                  <p className="text-body-3 text-text-muted">
                    {g.relation}
                    {g.validUntil ? ` · until ${fmtDate(g.validUntil)}` : ''}
                  </p>
                </div>
                <Tag
                  variant={auth.ok ? 'success' : auth.reason === 'pending' ? 'warning' : 'danger'}
                >
                  {auth.ok
                    ? 'Authorised'
                    : auth.reason === 'pending'
                      ? 'Pending approval'
                      : auth.reason === 'expired'
                        ? 'Expired'
                        : 'Not approved'}
                </Tag>
              </Card>
            );
          })}
          <Button variant="secondary" fullWidth disabled={full} onClick={() => setAdding(true)}>
            <UserPlus className="me-2 inline h-4 w-4" strokeWidth={1.5} />
            {full ? 'Guardian limit reached' : 'Add a guardian'}
          </Button>
        </section>
      </div>
      <AddGuardianSheet
        slot={slot}
        childId={child.id}
        open={adding}
        onClose={() => setAdding(false)}
      />
    </div>
  );
}
