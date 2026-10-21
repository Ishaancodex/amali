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
import { ageOnDate, bandForChild } from '@/domain/creche/bands';
import { useFmt, useT } from '@/i18n/hooks';
import { guardianAuthorisation } from '@/domain/creche/guardians';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { dubaiDateKey } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import { AddGuardianSheet } from './AddGuardianSheet';

export function ChildDetailScreen({ slot, childId }: { slot: DeviceSlotId; childId: string }) {
  const t = useT();
  const fmt = useFmt();
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
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 [&>*]:shrink-0">
        <div className="flex items-center gap-4 pt-2">
          <ChildAvatar initials={child.photo} size="lg" />
          <div>
            <p className="text-title-l text-text-title">{child.name}</p>
            <p className="text-body-2 text-text-muted">
              {t('myUnit.years', { age: ageOnDate(child.dob, today) })} ·{' '}
              {band.ok
                ? t('myUnit.band', { band: t(`kids.band.${band.band}`) })
                : t(`kids.bandReason.${band.reason}`, { age: rules.creche.minAcceptedAge })}
            </p>
          </div>
        </div>

        {child.allergies && (
          <Banner style={child.allergies.severe ? 'urgent' : 'warning'}>
            {t(child.allergies.severe ? 'myUnit.severeAllergy' : 'myUnit.allergy', {
              text: child.allergies.text,
            })}
          </Banner>
        )}

        <Card className="flex flex-col gap-1">
          <p className="text-body-3 text-text-muted">
            {t('myUnit.born', { date: fmt.dateKey(child.dob) })}
          </p>
          {child.dietary && (
            <p className="text-body-3 text-text-muted">
              {t('myUnit.diet', { text: child.dietary })}
            </p>
          )}
          <p className="text-body-3 text-text-muted">
            {t('myUnit.photoConsentValue', {
              value: child.photoConsent ? t('common.yes') : t('common.no'),
            })}
          </p>
          <p className="text-body-3 text-text-muted">
            {t('myUnit.emergency', { name: child.emergencyContact.name })} ·{' '}
            <bdi>{child.emergencyContact.phone}</bdi>
          </p>
        </Card>

        {band.ok && (
          <Button fullWidth onClick={() => push('creche-book', { child: child.id })}>
            {t('myUnit.bookSession')}
          </Button>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-label-1 text-text-title">{t('myUnit.guardians')}</h2>
            <span className="text-body-3 text-text-muted">
              {t('ui.occupancy.countOf', {
                count: child.guardianIds.length,
                capacity: rules.creche.guardians.max,
              })}
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
                    {g.validUntil
                      ? ` · ${t('myUnit.until', { date: fmt.date(g.validUntil) })}`
                      : ''}
                  </p>
                </div>
                <Tag
                  variant={auth.ok ? 'success' : auth.reason === 'pending' ? 'warning' : 'danger'}
                >
                  {auth.ok
                    ? t('myUnit.auth.ok')
                    : auth.reason === 'pending'
                      ? t('myUnit.auth.pending')
                      : auth.reason === 'expired'
                        ? t('myUnit.auth.expired')
                        : t('myUnit.auth.denied')}
                </Tag>
              </Card>
            );
          })}
          <Button variant="secondary" fullWidth disabled={full} onClick={() => setAdding(true)}>
            <UserPlus className="me-2 inline h-4 w-4" strokeWidth={1.5} />
            {full ? t('myUnit.guardianLimit') : t('myUnit.addGuardian')}
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
