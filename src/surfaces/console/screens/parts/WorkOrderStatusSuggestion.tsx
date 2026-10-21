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
import { useAmenityLabel, useErrorText, useT } from '@/i18n/hooks';

export function WorkOrderStatusSuggestion({
  slot,
  workOrder,
}: {
  slot: DeviceSlotId;
  workOrder: WorkOrder;
}) {
  const t = useT();
  const errorText = useErrorText();
  const amenityLabel = useAmenityLabel();
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const amenityName = amenityLabel(workOrder.amenity);
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
        ? t('console.wo.statusSet', { amenity: amenityName, status: t(`status.${next}`) })
        : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  if (suggestMaintenance) {
    return (
      <Banner
        style="warning"
        cta={{
          label: t('console.wo.setMaintenance'),
          onClick: () => setStatus('maintenance'),
        }}
      >
        {t('console.wo.p1Open', { amenity: amenityName })}
      </Banner>
    );
  }
  if (suggestReopen) {
    return (
      <Banner
        style="success"
        cta={{
          label: t('console.wo.reopen', { amenity: amenityName }),
          onClick: () => setStatus('open'),
        }}
      >
        {t('console.wo.stillStatus', {
          state: t(`console.woState.${workOrder.state}`),
          amenity: amenityName,
          status: t(`status.${status}`),
        })}
      </Banner>
    );
  }
  return null;
}
