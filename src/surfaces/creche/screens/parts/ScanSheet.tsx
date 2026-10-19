'use client';

/**
 * The simulated scanner: the passes "in front of the camera" are the
 * guardians of children booked for the current session or in the room.
 * Picking one is the scan — it lands on that child with the guardian set.
 */
import { Sheet } from '@/ui/Sheet';
import { Card } from '@/ui/Card';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { useStore } from '@/store';
import { selectBoardSession } from '@/store/selectors/creche';

export function ScanSheet({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (guardianId: string, childId: string) => void;
}) {
  const children = useStore((s) => s.children);
  const guardians = useStore((s) => s.guardians);
  const crecheBookings = useStore((s) => s.crecheBookings);
  const crecheSessions = useStore((s) => s.crecheSessions);
  const now = useStore((s) => s.demo.clock.now);

  const session = selectBoardSession({ crecheSessions }, now);
  const passes = Object.values(crecheBookings)
    .filter(
      (b) =>
        b.state === 'checked_in' ||
        (session && b.sessionId === session.id && b.state === 'confirmed'),
    )
    .flatMap((b) =>
      (children[b.childId]?.guardianIds ?? [])
        .map((gId) => guardians[gId])
        .filter((g) => g?.residentId)
        .map((g) => ({ guardian: g!, child: children[b.childId]! })),
    )
    .sort((a, b) => a.guardian.name.localeCompare(b.guardian.name));

  return (
    <Sheet open={open} onClose={onClose} title="Scan drop-off pass">
      <p className="text-body-3 text-text-muted pb-3">Hold the guardian’s pass to the camera.</p>
      <div className="flex flex-col gap-2 pb-2">
        {passes.map(({ guardian, child }) => (
          <button
            key={`${guardian.id}:${child.id}`}
            type="button"
            className="text-start"
            onClick={() => onScan(guardian.id, child.id)}
          >
            <Card className="flex items-center gap-3">
              <ChildAvatar initials={guardian.photo} />
              <div>
                <p className="text-label-2 text-text-title">{guardian.name}</p>
                <p className="text-body-3 text-text-muted">
                  {guardian.relation} of {child.name}
                </p>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
