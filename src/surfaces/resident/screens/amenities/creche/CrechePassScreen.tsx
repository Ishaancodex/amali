'use client';

/**
 * The guardian's drop-off pass (PRD §8.3 step 1: "Kids' Club → Drop-off
 * pass"). The code is a mock — a deterministic pattern from the guardian
 * id with QR-style finder squares; the creche scanner is simulated too.
 */
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { QrCode } from '@/ui/icons';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import type { DeviceSlotId } from '@/types/demo';

const N = 21;
const FINDER = 7;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function inFinder(x: number, y: number): boolean | undefined {
  for (const [ox, oy] of [
    [0, 0],
    [N - FINDER, 0],
    [0, N - FINDER],
  ] as const) {
    const dx = x - ox;
    const dy = y - oy;
    if (dx >= 0 && dx < FINDER && dy >= 0 && dy < FINDER) {
      const ring = Math.min(dx, dy, FINDER - 1 - dx, FINDER - 1 - dy);
      return ring !== 1;
    }
  }
  return undefined;
}

function MockCode({ value }: { value: string }) {
  let seed = hash(value);
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const finder = inFinder(x, y);
      seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
      if (finder ?? seed % 2 === 0) cells.push({ x, y });
    }
  }
  return (
    <svg
      viewBox={`-1 -1 ${N + 2} ${N + 2}`}
      className="h-auto w-full"
      role="img"
      aria-label="Drop-off pass code"
    >
      <rect x={-1} y={-1} width={N + 2} height={N + 2} fill="var(--surface)" />
      {cells.map((c) => (
        <rect key={`${c.x}:${c.y}`} x={c.x} y={c.y} width={1} height={1} fill="var(--text-title)" />
      ))}
    </svg>
  );
}

export function CrechePassScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop } = useNav(slot);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const guardians = useStore((s) => s.guardians);
  const children = useStore((s) => s.children);
  const guardian = Object.values(guardians).find((g) => g.residentId === actorId);

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Drop-off pass" onBack={pop} />
      <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-6 pb-6">
        {!guardian ? (
          <EmptyState
            icon={QrCode}
            message="You’re not an authorised guardian for any child yet."
          />
        ) : (
          <>
            <Card className="mt-4 w-full max-w-64 p-4">
              <MockCode value={guardian.id} />
            </Card>
            <div className="flex items-center gap-3">
              <ChildAvatar initials={guardian.photo} />
              <div>
                <p className="text-label-1 text-text-title">{guardian.name}</p>
                <p className="text-body-3 text-text-muted">
                  Authorised for{' '}
                  {guardian.childIds
                    .map((id) => children[id]?.name.split(' ')[0])
                    .filter(Boolean)
                    .join(' & ')}
                </p>
              </div>
            </div>
            <p className="text-body-3 text-text-muted text-center">
              Show this at the Kids’ Club desk for drop-off and pickup.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
