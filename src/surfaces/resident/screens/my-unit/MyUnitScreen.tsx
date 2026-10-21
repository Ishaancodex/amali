'use client';

/** My Unit (PRD §6.1): Household · Children & guardians · Wallet · Guests · Amenity rights. */
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { BalanceChip } from '@/features/wallet/BalanceChip';
import { Users, Baby, Wallet as WalletIcon, UserPlus, Shield, ChevronRight } from '@/ui/icons';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { ageOnDate } from '@/domain/creche/bands';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { dubaiDateKey } from '@/lib/time';
import { useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';

function SectionHeader({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-5 pb-2">
      <Icon className="text-brand h-4 w-4" strokeWidth={1.5} />
      <h2 className="text-label-1 text-text-title">{label}</h2>
    </div>
  );
}

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
    <div className="flex h-full flex-col">
      <TopBar title={t('resident.nav.myUnit')} />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="px-4 pt-4">
          <p className="text-display text-text-title">
            <bdi>{unit.id}</bdi>
          </p>
          <p className="text-body-2 text-text-muted">{t(`myUnit.kind.${unit.kind}`)}</p>
        </div>

        <SectionHeader icon={Users} label={t('myUnit.household')} />
        <div className="flex flex-col gap-2 px-4">
          {householdMembers.map((m) => (
            <Card key={m.id} className="flex items-center gap-3">
              <span className="bg-brand-tint text-label-3 text-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                {m.avatar}
              </span>
              <div>
                <p className="text-label-2 text-text-body">{m.name}</p>
                <p className="text-body-3 text-text-muted">{t(`myUnit.type.${m.type}`)}</p>
              </div>
            </Card>
          ))}
        </div>

        <SectionHeader icon={Baby} label={t('myUnit.children')} />
        <div className="flex flex-col gap-2 px-4">
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
                  <p className="text-label-2 text-text-body">{child.name}</p>
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
            className="text-label-3 text-brand self-start py-1"
          >
            {t('myUnit.registerChild')}
          </button>
        </div>

        <SectionHeader icon={WalletIcon} label={t('resident.home.quick.wallet')} />
        <div className="px-4">
          <Card className="flex items-center justify-between">
            <div>
              <p className="text-body-3 text-text-muted">{t('wallet.balance')}</p>
              <BalanceChip balanceFils={wallet?.balanceFils ?? 0} />
            </div>
            <button
              type="button"
              onClick={() => push('wallet')}
              className="text-label-3 text-brand"
            >
              {t('myUnit.manage')}
            </button>
          </Card>
        </div>

        <SectionHeader icon={UserPlus} label={t('myUnit.guests')} />
        <p className="text-body-3 text-text-muted px-4">{t('myUnit.guestsSoon')}</p>

        <SectionHeader icon={Shield} label={t('myUnit.rights')} />
        <div className="px-4">
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
        </div>
      </div>
    </div>
  );
}
