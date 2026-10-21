/**
 * Builds this console device's `Actor` for `dispatch()` calls. The
 * presenter's persona picker only ever offers staff whose own `StaffRole`
 * is one of the three `ConsoleRole` values (`PersonaPicker`'s
 * `STAFF_ROLES_FOR.console`), so when the presenter hasn't separately set
 * `device.consoleRole` (the scenario-only "Take me there" path does),
 * falling back to the picked staff member's own role is always valid.
 */
import { useStore } from '@/store';
import type { DeviceSlotId } from '@/types/demo';
import type { Actor } from '@/types/common';
import type { ConsoleRole } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';
import { DEMO_SUPERVISOR_AMENITIES } from '@/store/selectors/report';

const CONSOLE_ROLES: readonly ConsoleRole[] = [
  'community_manager',
  'amenity_supervisor',
  'call_centre',
];

export interface ConsoleActor {
  actor: Actor | undefined;
  consoleRole: ConsoleRole | undefined;
  assignedAmenities: AmenityKey[] | undefined;
}

export function useConsoleActor(slot: DeviceSlotId): ConsoleActor {
  const device = useStore((s) => s.demo.devices[slot]);
  const staffMember = useStore((s) => (device?.actorId ? s.staff[device.actorId] : undefined));

  if (!device?.actorId || !staffMember) {
    return { actor: undefined, consoleRole: undefined, assignedAmenities: undefined };
  }

  const consoleRole =
    device.consoleRole ??
    (CONSOLE_ROLES.includes(staffMember.role as ConsoleRole)
      ? (staffMember.role as ConsoleRole)
      : undefined);

  // The demo's role switch can make any console user a supervisor; one with no assignment of their
  // own gets the PRD's ("Assigned amenities (Pool, Gym, Padel)").
  const assignedAmenities =
    consoleRole === 'amenity_supervisor' && !staffMember.assignedAmenities?.length
      ? DEMO_SUPERVISOR_AMENITIES
      : staffMember.assignedAmenities;
  return {
    actor: { kind: 'staff', id: device.actorId, role: consoleRole },
    consoleRole,
    assignedAmenities,
  };
}
