'use client';

/** Check-in (PRD §8.3 steps 3-4): the allergy tick when needed, then the command's own blocks speak for themselves. */
import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { fmtTime } from '@/lib/time';
import type { Child } from '@/types/creche';
import type { DeviceSlotId } from '@/types/demo';
import { useCrecheStaff } from '../../useCrecheStaff';

export function CheckInPanel({
  slot,
  child,
  guardianId,
}: {
  slot: DeviceSlotId;
  child: Child;
  guardianId: string;
}) {
  const { actor } = useCrecheStaff(slot);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const [allergyAck, setAllergyAck] = useState(false);
  const [blocked, setBlocked] = useState<string | undefined>();
  const needsAck = !!child.allergies?.severe;

  function checkIn() {
    if (!actor) return;
    const result = dispatch('creche.checkIn', { childId: child.id, guardianId, allergyAck }, actor);
    if (result.ok) {
      setBlocked(undefined);
      pushToast(
        slot,
        `${child.name.split(' ')[0]} checked in at ${fmtTime(result.value.checkIn!.at)}.`,
        'success',
      );
    } else {
      setBlocked(result.error.message);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {needsAck && (
        <label className="border-danger rounded-card flex items-center gap-3 border p-3">
          <input
            type="checkbox"
            checked={allergyAck}
            onChange={(e) => setAllergyAck(e.target.checked)}
            className="accent-brand h-5 w-5"
          />
          <span className="text-label-2 text-text-title">Allergy plan noted</span>
        </label>
      )}
      {blocked && <Banner style="urgent">{blocked}</Banner>}
      <Button fullWidth disabled={!guardianId || (needsAck && !allergyAck)} onClick={checkIn}>
        Check in
      </Button>
    </section>
  );
}
