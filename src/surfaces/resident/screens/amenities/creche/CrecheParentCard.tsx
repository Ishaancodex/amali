'use client';

/**
 * The parent's Kids' Club card (PRD §8.3 "Live status for the parent"):
 * per child, "In the Playroom · Checked in 09:04 · 1h 12m", what's
 * happening now, the room's headcount, and the timeline — plus anything
 * waiting on the parent: a pickup approval and incident reports to
 * acknowledge. Upcoming bookings show with Cancel.
 */
import { useStore } from '@/store';
import {
  selectBandLoads,
  selectBoardSession,
  selectChildCurrentBooking,
} from '@/store/selectors/creche';
import type { DeviceSlotId } from '@/types/demo';
import { ChildLiveCard } from './ChildLiveCard';
import { IncidentAckList } from './IncidentAckList';

export function CrecheParentCard({ slot }: { slot: DeviceSlotId }) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const unitId = useStore((s) => s.residents[actorId]?.unitId);
  const children = useStore((s) => s.children);
  const crecheBookings = useStore((s) => s.crecheBookings);
  const crecheSessions = useStore((s) => s.crecheSessions);
  const bandAssignments = useStore((s) => s.bandAssignments);
  const shifts = useStore((s) => s.shifts);
  const now = useStore((s) => s.demo.clock.now);

  const mine = Object.values(children).filter((c) => c.unitId === unitId);
  if (mine.length === 0) {
    return (
      <p className="text-body-3 text-text-muted">
        Register a child under My Unit to book the Kids’ Club.
      </p>
    );
  }

  const inRoom = Object.values(crecheBookings).filter((b) => b.state === 'checked_in').length;
  const loads = selectBandLoads(
    { crecheSessions, crecheBookings, bandAssignments, shifts },
    selectBoardSession({ crecheSessions }, now),
  );
  const carers = new Set(loads.flatMap((l) => l.staffIds)).size;

  return (
    <section className="flex flex-col gap-3">
      {mine.map((child) => {
        const booking = selectChildCurrentBooking(
          { crecheBookings, crecheSessions },
          child.id,
          now,
        );
        return booking ? (
          <ChildLiveCard
            key={child.id}
            slot={slot}
            child={child}
            booking={booking}
            roomSummary={`${inRoom} ${inRoom === 1 ? 'child' : 'children'} · ${carers} ${carers === 1 ? 'carer' : 'carers'}`}
          />
        ) : null;
      })}
      <IncidentAckList slot={slot} childIds={mine.map((c) => c.id)} />
    </section>
  );
}
