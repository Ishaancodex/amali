'use client';

/**
 * Linked amenity status (PRD §8.5 step 7): "while a P1 work order is
 * open, the console suggests setting the amenity to Under maintenance.
 * Resolving the work order suggests reopening it." A suggestion only —
 * the supervisor taps it; nothing changes the amenity's status on its own.
 */
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { selectCurrentStatusEntry } from '@/store/selectors/amenities';
import type { DeviceSlotId } from '@/types/demo';
import type { WorkOrder } from '@/types/ops';
import { useConsoleActor } from '../../useConsoleActor';

export function WorkOrderStatusSuggestion({
  slot,
  workOrder,
}: {
  slot: DeviceSlotId;
  workOrder: WorkOrder;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const amenityName = useStore((s) => s.amenities[workOrder.amenity]?.name ?? workOrder.amenity);
  const now = useStore((s) => s.demo.clock.now);
  const { actor, assignedAmenities } = useConsoleActor(slot);

  const status =
    selectCurrentStatusEntry({ amenityStatus }, workOrder.amenity, now)?.status ?? 'open';
  const isDone = workOrder.state === 'resolved' || workOrder.state === 'closed';

  const suggestMaintenance =
    !isDone && workOrder.priority === 'P1' && status !== 'maintenance' && status !== 'emergency';
  // Not after an emergency closure — that has its own "Reopened" announcement (`amenity.reopen`).
  const suggestReopen = isDone && status !== 'open' && status !== 'emergency';

  function setStatus(next: 'maintenance' | 'open') {
    if (!actor) return;
    const result = dispatch(
      'amenity.setStatus',
      {
        amenity: workOrder.amenity,
        status: next,
        reason: next === 'maintenance' ? workOrder.title : undefined,
        workOrderId: workOrder.id,
      },
      actor,
      { assignedAmenities },
    );
    pushToast(
      slot,
      result.ok
        ? `${amenityName} set to ${next === 'open' ? 'Open' : 'Under maintenance'}.`
        : result.error.message,
      result.ok ? 'success' : 'error',
    );
  }

  if (suggestMaintenance) {
    return (
      <Banner
        style="warning"
        cta={{ label: 'Set Under maintenance', onClick: () => setStatus('maintenance') }}
      >
        A P1 work order is open on the {amenityName}.
      </Banner>
    );
  }
  if (suggestReopen) {
    return (
      <Banner
        style="success"
        cta={{ label: `Reopen ${amenityName}`, onClick: () => setStatus('open') }}
      >
        Work order {workOrder.state}. The {amenityName} is still {status}.
      </Banner>
    );
  }
  return null;
}
