'use client';

/** Walk-in (+): a party size, seated at the first free table that fits (or counter seats). */
import { useState } from 'react';
import { Sheet } from '@/ui/Sheet';
import { Stepper } from '@/ui/Stepper';
import { Button } from '@/ui/Button';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import type { VenueKey } from '@/types/dining';
import type { DeviceSlotId } from '@/types/demo';

export function WalkInSheet({
  slot,
  venue,
  open,
  onClose,
}: {
  slot: DeviceSlotId;
  venue: VenueKey;
  open: boolean;
  onClose: () => void;
}) {
  const [size, setSize] = useState(2);
  const dispatch = useStore((s) => s.dispatch);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const role = useStore((s) => s.staff[actorId]?.role);
  const pushToast = useUiStore((s) => s.pushToast);
  const { min, max } = rules.dining[venue].partySize;

  function seat() {
    const result = dispatch(
      'dining.walkIn',
      { venue, partySize: size },
      { kind: 'staff', id: actorId, role },
    );
    pushToast(
      slot,
      result.ok
        ? `Walk-in for ${size} at ${result.value.tableIds.join('+')}.`
        : result.error.message,
      result.ok ? 'success' : 'error',
    );
    if (result.ok) onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Walk-in">
      <div className="flex flex-col gap-4 pb-2">
        <Stepper label="Party size" value={size} min={min} max={max} onChange={setSize} />
        <Button fullWidth onClick={seat}>
          Seat now
        </Button>
      </div>
    </Sheet>
  );
}
