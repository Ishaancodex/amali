'use client';

/**
 * Children directory (PRD §6.3): profile, allergies and notes, authorised
 * guardians. New guardians waiting on the Creche Lead sit at the top —
 * only the lead can approve or reject them.
 */
import { useState } from 'react';
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { ageOnDate, bandForChild } from '@/domain/creche/bands';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { guardianAuthorisation } from '@/domain/creche/guardians';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { dubaiDateKey } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import { useCrecheStaff } from '../useCrecheStaff';

export function ChildrenScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const { actor, isLead } = useCrecheStaff(slot);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const children = useStore((s) => s.children);
  const guardians = useStore((s) => s.guardians);
  const now = useStore((s) => s.demo.clock.now);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | undefined>();

  const today = dubaiDateKey(now);
  const pending = Object.values(guardians).filter((g) => g.approval === 'pending');
  const q = query.trim().toLowerCase();
  const list = Object.values(children)
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  function decide(guardianId: string, decision: 'approved' | 'rejected') {
    if (!actor) return;
    const result = dispatch('creche.decideGuardian', { guardianId, decision }, actor);
    pushToast(
      slot,
      result.ok ? t(`creche.guardian.${decision}`) : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <h1 className="text-title-l text-text-title">{t('creche.nav.children')}</h1>

      {pending.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-label-1 text-text-title">{t('myUnit.auth.pending')}</h2>
          {pending.map((g) => (
            <Card key={g.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <ChildAvatar initials={g.photo} />
                <div className="min-w-0 flex-1">
                  <p className="text-label-2 text-text-title">{g.name}</p>
                  <p className="text-body-3 text-text-muted">
                    {t('creche.guardian.of', {
                      relation: g.relation,
                      names: g.childIds.map((id) => children[id]?.name.split(' ')[0]).join(', '),
                    })}{' '}
                    · <bdi>{t('creche.guardian.id', { last4: g.idLast4 })}</bdi>
                  </p>
                </div>
              </div>
              {isLead ? (
                <div className="flex gap-2">
                  <Button variant="secondary" fullWidth onClick={() => decide(g.id, 'rejected')}>
                    {t('creche.reject')}
                  </Button>
                  <Button fullWidth onClick={() => decide(g.id, 'approved')}>
                    {t('kids.approve')}
                  </Button>
                </div>
              ) : (
                <p className="text-body-3 text-text-muted">{t('creche.waitingLead')}</p>
              )}
            </Card>
          ))}
        </section>
      )}

      <Input
        placeholder={t('creche.searchChildren')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-col gap-2">
        {list.map((c) => {
          const band = bandForChild(c.dob, today, rules.creche.bands, rules.creche.minAcceptedAge);
          const expanded = open === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className="text-start"
              onClick={() => setOpen(expanded ? undefined : c.id)}
            >
              <Card className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <ChildAvatar initials={c.photo} />
                  <div className="min-w-0 flex-1">
                    <p className="text-label-2 text-text-title">{c.name}</p>
                    <p className="text-body-3 text-text-muted">
                      {t('myUnit.years', { age: ageOnDate(c.dob, today) })} ·{' '}
                      {band.ok
                        ? t(`kids.band.${band.band}`)
                        : t(`kids.bandReason.${band.reason}`, {
                            age: rules.creche.minAcceptedAge,
                          })}{' '}
                      · <bdi>{c.unitId}</bdi>
                    </p>
                  </div>
                  {c.allergies && (
                    <Tag variant={c.allergies.severe ? 'danger' : 'warning'}>
                      {t('creche.allergy')}
                    </Tag>
                  )}
                </div>
                {expanded && (
                  <div className="border-border-card flex flex-col gap-1 border-t-[0.5px] pt-2">
                    <p className="text-body-3 text-text-body">
                      {t('myUnit.born', { date: fmt.dateKey(c.dob) })}
                    </p>
                    {c.allergies && (
                      <p
                        className={
                          c.allergies.severe
                            ? 'text-body-3 text-danger'
                            : 'text-body-3 text-text-body'
                        }
                      >
                        {t('myUnit.allergy', { text: c.allergies.text })}
                      </p>
                    )}
                    {c.dietary && (
                      <p className="text-body-3 text-text-body">
                        {t('myUnit.diet', { text: c.dietary })}
                      </p>
                    )}
                    <p className="text-body-3 text-text-body">
                      {t('myUnit.photoConsentValue', {
                        value: c.photoConsent ? t('common.yes') : t('common.no'),
                      })}
                    </p>
                    <p className="text-body-3 text-text-body">
                      {t('myUnit.emergency', { name: c.emergencyContact.name })} ·{' '}
                      <bdi>{c.emergencyContact.phone}</bdi>
                    </p>
                    {c.guardianIds.map((gId) => {
                      const g = guardians[gId];
                      if (!g) return null;
                      const auth = guardianAuthorisation(g, c, now);
                      return (
                        <p key={gId} className="text-body-3 text-text-muted">
                          {g.name} ({g.relation}) —{' '}
                          {auth.ok ? t('myUnit.auth.ok') : t(`creche.auth.${auth.reason}`)}
                        </p>
                      );
                    })}
                  </div>
                )}
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
