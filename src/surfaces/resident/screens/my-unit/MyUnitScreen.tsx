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
import { dubaiDateKey, fmtDate } from '@/lib/time';
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
  useNav(slot);
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
      <TopBar title="My Unit" />
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="px-4 pt-4">
          <p className="text-display text-text-title">{unit.id}</p>
          <p className="text-body-2 text-text-muted capitalize">{unit.kind}</p>
        </div>

        <SectionHeader icon={Users} label="Household" />
        <div className="flex flex-col gap-2 px-4">
          {householdMembers.map((m) => (
            <Card key={m.id} className="flex items-center gap-3">
              <span className="bg-brand-tint text-label-3 text-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                {m.avatar}
              </span>
              <div>
                <p className="text-label-2 text-text-body">{m.name}</p>
                <p className="text-body-3 text-text-muted capitalize">{m.type}</p>
              </div>
            </Card>
          ))}
        </div>

        <SectionHeader icon={Baby} label="Children & guardians" />
        <div className="flex flex-col gap-2 px-4">
          {children.length === 0 && (
            <p className="text-body-3 text-text-muted">No children registered to this unit.</p>
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
                    {ageOnDate(child.dob, dubaiDateKey(now))} yrs · Guardians:{' '}
                    {child.guardianIds
                      .map((gId) => guardians[gId]?.name.split(' ')[0])
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
                <ChevronRight className="text-text-muted h-4 w-4" strokeWidth={1.5} />
              </Card>
            </button>
          ))}
          <button
            type="button"
            onClick={() => push('child-register')}
            className="text-label-3 text-brand self-start py-1"
          >
            + Register a child
          </button>
        </div>

        <SectionHeader icon={WalletIcon} label="Wallet" />
        <div className="px-4">
          <Card className="flex items-center justify-between">
            <div>
              <p className="text-body-3 text-text-muted">Balance</p>
              <BalanceChip balanceFils={wallet?.balanceFils ?? 0} />
            </div>
            <button
              type="button"
              onClick={() => push('wallet')}
              className="text-label-3 text-brand"
            >
              Manage
            </button>
          </Card>
        </div>

        <SectionHeader icon={UserPlus} label="Guests" />
        <p className="text-body-3 text-text-muted px-4">Guest management lands in a later phase.</p>

        <SectionHeader icon={Shield} label="Amenity rights" />
        <div className="px-4">
          <Card>
            <p className="text-body-2 text-text-body">
              Held by {rightsHolder?.name ?? 'Unknown'}
              {rightsHolder?.id === resident.id ? ' (you)' : ''}
            </p>
            {unit.leaseEnd && (
              <p className="text-body-3 text-text-muted mt-1">
                Rights transfer back {fmtDate(unit.leaseEnd)}.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
