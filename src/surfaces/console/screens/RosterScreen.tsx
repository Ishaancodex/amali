'use client';

/**
 * The roster week grid (PRD §8.8): staff × days, shifts coloured by role,
 * coverage gaps for the pool (lifeguard) and gym (attendant) highlighted
 * in red. Mark sick / clear shift is the one edit this screen exposes —
 * adding a brand-new shift is left to the seeded roster for this phase.
 */
import { TopBar } from '@/ui/TopBar';
import { Tag } from '@/ui/Tag';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { findCoverageGaps } from '@/domain/ops/roster';
import { rules } from '@/config/rules';
import {
  addDaysIso,
  dubaiDateKey,
  dubaiDateTimeToIso,
  dubaiWeekday,
  fmtDate,
  fmtTime,
  startOfDubaiDay,
} from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';

const ROLE_TAG: Record<string, 'brand' | 'info' | 'success' | 'warning'> = {
  lifeguard: 'info',
  gym_attendant: 'success',
  guard: 'brand',
  creche_lead: 'warning',
  creche_carer: 'warning',
};

export function RosterScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const shifts = useStore((s) => s.shifts);
  const staff = useStore((s) => s.staff);
  const now = useStore((s) => s.demo.clock.now);
  const { actor } = useConsoleActor(slot);

  const weekStart = addDaysIso(startOfDubaiDay(now), -dubaiWeekday(now));
  const days = Array.from({ length: 7 }, (_, i) => dubaiDateKey(addDaysIso(weekStart, i)));

  const relevantRoles = new Set([
    'lifeguard',
    'gym_attendant',
    'guard',
    'creche_lead',
    'creche_carer',
  ]);
  const rosterStaff = Object.values(staff).filter((s) => relevantRoles.has(s.role));

  const staffRoleById = new Map(Object.values(staff).map((s) => [s.id, s.role] as const));
  const gapsByDay = new Map(
    days.map((dateKey) => {
      const poolGaps = findCoverageGaps(
        Object.values(shifts),
        'pool',
        'lifeguard',
        staffRoleById,
        dubaiDateTimeToIso(dateKey, rules.pool.hours.open),
        dubaiDateTimeToIso(dateKey, rules.pool.hours.close),
      );
      const gymGaps = findCoverageGaps(
        Object.values(shifts),
        'gym',
        'gym_attendant',
        staffRoleById,
        dubaiDateTimeToIso(dateKey, rules.gym.staffedWindow.open),
        dubaiDateTimeToIso(dateKey, rules.gym.staffedWindow.close),
      );
      return [dateKey, poolGaps.length + gymGaps.length] as const;
    }),
  );

  function markSick(shiftId: string) {
    if (!actor) return;
    const result = dispatch('roster.markSick', { shiftId }, actor);
    pushToast(
      slot,
      result.ok ? 'Marked sick.' : result.error.message,
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Roster" onBack={pop} />
      <div className="flex-1 overflow-auto px-6 pb-8">
        <table className="w-full min-w-[840px] border-collapse">
          <thead>
            <tr>
              <th className="text-body-3 text-text-muted bg-bg-page sticky left-0 w-40 px-2 py-2 text-start">
                Staff
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className={`text-body-3 px-2 py-2 text-start ${(gapsByDay.get(d) ?? 0) > 0 ? 'text-danger' : 'text-text-muted'}`}
                >
                  {fmtDate(dubaiDateTimeToIso(d, '12:00'), 'EEE d')}
                  {(gapsByDay.get(d) ?? 0) > 0 && <span className="ms-1">⚠</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rosterStaff.map((member) => (
              <tr key={member.id} className="border-border-card border-t">
                <td className="bg-bg-page sticky left-0 px-2 py-2">
                  <p className="text-label-3 text-text-title">{member.name}</p>
                  <Tag variant={ROLE_TAG[member.role] ?? 'brand'} className="mt-0.5">
                    {member.role.replace(/_/g, ' ')}
                  </Tag>
                </td>
                {days.map((d) => {
                  const shift = Object.values(shifts).find(
                    (s) => s.staffId === member.id && s.date === d,
                  );
                  return (
                    <td key={d} className="px-2 py-2">
                      {shift ? (
                        <button
                          type="button"
                          disabled={shift.state === 'sick'}
                          onClick={() => markSick(shift.id)}
                          className={`text-body-3 rounded-tag px-2 py-1 ${shift.state === 'sick' ? 'bg-danger/15 text-danger' : 'bg-brand-tint text-brand'}`}
                        >
                          {shift.state === 'sick'
                            ? 'Sick'
                            : `${fmtTime(shift.start)}–${fmtTime(shift.end)}`}
                        </button>
                      ) : (
                        <span className="text-text-placeholder">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
