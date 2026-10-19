/** The creche device's signed-in staff member and their dispatch actor. */
import { useStore } from '@/store';
import type { Actor } from '@/types/common';
import type { DeviceSlotId } from '@/types/demo';

export function useCrecheStaff(slot: DeviceSlotId) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const staffMember = useStore((s) => s.staff[actorId]);
  const actor: Actor | undefined = staffMember
    ? { kind: 'staff', id: staffMember.id, role: staffMember.role }
    : undefined;
  return { staffMember, actor, isLead: staffMember?.role === 'creche_lead' };
}
