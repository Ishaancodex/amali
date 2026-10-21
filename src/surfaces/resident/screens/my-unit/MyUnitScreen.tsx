'use client';

/** My Unit (PRD §6.1): Household · Children & guardians · Wallet · Guests · Amenity rights. */
import { ScreenShell } from '@/ui/ScreenShell';
import { SectionHeading } from '@/ui/SectionHeading';
import { Eyebrow } from '@/ui/Eyebrow';
import { Card } from '@/ui/Card';
import { BalanceChip } from '@/features/wallet/BalanceChip';
import { ChevronRight } from '@/ui/icons';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { ageOnDate } from '@/domain/creche/bands';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { dubaiDateKey } from '@/lib/time';
import { useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';

export function MyUnitScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const unit = useStore((s) => (resident ? s.units[resident.unitId] : undefined));
  const push = useNav(slot).push;

  const residentsRecord = useStore((s) => s.residents);
  const householdMembers = resident
    ? Object.values(residentsRecord).filter((r) => r.unitId === resident.unitId)
    : [];
  const childrenRecord = useStore((s) => s.children);
  const children = resident
    ? Object.values(childrenRecord).filter((c) => c.unitId === resident.unitId)
    : [];
  const guardians = useStore((s) => s.guardians);
  const now = useStore((s) => s.demo.clock.now);
  const wallet = useStore((s) => (resident ? s.wallets[resident.unitId] : undefined));
  const rightsHolder = useStore((s) =>
    unit ? s.residents[unit.amenityRightsHolderId] : undefined,
  );

  if (!resident || !unit) return null;

  return (
    <ScreenShell
      eyebrow={t(`myUnit.kind.${unit.kind}`)}
      title={unit.id}
      image="/stock/my-unit.jpg"
      bodyClassName="gap-7"
    >
      <section>
        <SectionHeading title={t('myUnit.household')} />
        <div className="flex flex-col gap-2.5">
          {householdMembers.map((m) => (
            <Card key={m.id} className="flex items-center gap-3">
              <span className="bg-ember text-sand-soft font-wide text-eyebrow flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                {m.avatar}
              </span>
              <div>
                <p className="text-label-2 text-text-title">{m.name}</p>
                <p className="text-body-3 text-text-muted">{t(`myUnit.type.${m.type}`)}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title={t('myUnit.children')} />
        <div className="flex flex-col gap-2.5">
          {children.length === 0 && (
            <p className="text-body-3 text-text-muted">{t('myUnit.noChildren')}</p>
          )}
          {children.map((child) => (
            <button
              key={child.id}
              type="button"
              className="text-start"
              onClick={() => push('child-detail', { id: child.id })}
            >
              <Card className="flex items-center gap-3">
                <ChildAvatar initials={child.photo} />
                <div className="min-w-0 flex-1">
                  <p className="text-label-2 text-text-title">{child.name}</p>
                  <p className="text-body-3 text-text-muted">
                    {t('myUnit.childLine', {
                      age: ageOnDate(child.dob, dubaiDateKey(now)),
                      names: child.guardianIds
                        .map((gId) => guardians[gId]?.name.split(' ')[0])
                        .filter(Boolean)
                        .join('، '),
                    })}
                  </p>
                </div>
                <ChevronRight
                  className="text-text-muted h-4 w-4 rtl:-scale-x-100"
                  strokeWidth={1.5}
                />
              </Card>
            </button>
          ))}
          <button
            type="button"
            onClick={() => push('child-register')}
            className="font-wide text-eyebrow text-brand self-start py-1"
          >
            {t('myUnit.registerChild')}
          </button>
        </div>
      </section>

      <section>
        <SectionHeading
          title={t('resident.home.quick.wallet')}
          linkLabel={t('myUnit.manage')}
          onLink={() => push('wallet')}
        />
        <Card className="flex flex-col items-start gap-1.5">
          <Eyebrow>{t('wallet.balance')}</Eyebrow>
          <BalanceChip balanceFils={wallet?.balanceFils ?? 0} />
        </Card>
      </section>

      <section>
        <SectionHeading title={t('myUnit.guests')} />
        <p className="text-body-3 text-text-muted">{t('myUnit.guestsSoon')}</p>
      </section>

      <section>
        <SectionHeading title={t('myUnit.rights')} />
        <Card>
          <p className="text-body-2 text-text-body">
            {t(rightsHolder?.id === resident.id ? 'myUnit.heldByYou' : 'myUnit.heldBy', {
              name: rightsHolder?.name ?? t('myUnit.unknown'),
            })}
          </p>
          {unit.leaseEnd && (
            <p className="text-body-3 text-text-muted mt-1">
              {t('myUnit.transferBack', { date: fmt.date(unit.leaseEnd) })}
            </p>
          )}
        </Card>
      </section>
    </ScreenShell>
  );
}
