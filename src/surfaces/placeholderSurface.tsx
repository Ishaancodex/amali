'use client';

/**
 * Shared placeholder surface (Phase P1 only). Each role's real app
 * (Phase P2+) replaces this with its own routes — `DeviceSlot` only ever
 * imports `surfaces/<role>/<Role>App.tsx`, so swapping this out later
 * won't touch shell code. For now it exists to prove the `Navigator`'s
 * push/pop transitions (PRD M3) work end to end, per device.
 */
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Navigator, type RouteComponent } from '@/navigation/Navigator';
import { useNav } from '@/navigation/useNav';
import { useStore } from '@/store';
import type { DeviceSlotId, Role } from '@/types/demo';

function ActorLabel({ slot }: { slot: DeviceSlotId }) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId);
  const resident = useStore((s) => (actorId ? s.residents[actorId] : undefined));
  const staff = useStore((s) => (actorId ? s.staff[actorId] : undefined));
  const unit = useStore((s) => (resident ? s.units[resident.unitId] : undefined));

  if (resident) {
    return (
      <p className="text-body-2 text-text-muted">
        {resident.name} · {unit?.id ?? resident.unitId}
      </p>
    );
  }
  if (staff) {
    return (
      <p className="text-body-2 text-text-muted">
        {staff.name} · {staff.post ?? staff.role}
      </p>
    );
  }
  return <p className="text-body-2 text-text-muted">No actor selected</p>;
}

function HomeScreen({ slot, roleLabel }: { slot: DeviceSlotId; roleLabel: string }) {
  const { push } = useNav(slot);
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <span className="text-tag text-brand">{roleLabel.toUpperCase()}</span>
      <h1 className="text-title-l text-text-title">Home</h1>
      <ActorLabel slot={slot} />
      <button
        type="button"
        onClick={() => push('detail', { from: 'home' })}
        className="rounded-card border-border-card bg-surface mt-4 flex items-center justify-between border px-4 py-3 text-left transition-transform active:scale-[0.97]"
      >
        <span className="text-label-2 text-text-body">Open a test screen</span>
        <ChevronRight className="text-text-muted h-4 w-4" strokeWidth={1.5} />
      </button>
      <p className="text-body-3 text-text-placeholder">
        This surface is a Phase P1 placeholder — the real screens for this role land in a later
        phase (TRD §13).
      </p>
    </div>
  );
}

function DetailScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop } = useNav(slot);
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <button
        type="button"
        onClick={() => pop()}
        className="text-label-2 text-brand flex items-center gap-1 self-start"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>
      <h1 className="text-title-l text-text-title">Test screen</h1>
      <p className="text-body-2 text-text-muted">
        Pushed via the Navigator (PRD M3). Swipe from the left edge, or tap Back, to pop.
      </p>
    </div>
  );
}

export function PlaceholderSurface({ slot, role }: { slot: DeviceSlotId; role: Role }) {
  const routes: Record<string, RouteComponent> = {
    home: () => <HomeScreen slot={slot} roleLabel={role} />,
    detail: () => <DetailScreen slot={slot} />,
  };

  return <Navigator slot={slot} routes={routes} />;
}
