'use client';

/** Check-in (PRD §8.3 steps 3-4): the allergy tick when needed, then the command's own blocks speak for themselves. */
import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
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
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
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
        t('creche.checkedInAt', {
          name: child.name.split(' ')[0],
          time: fmt.time(result.value.checkIn!.at),
        }),
        'success',
      );
    } else {
      setBlocked(errorText(result.error));
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
          <span className="text-label-2 text-text-title">{t('creche.allergyNoted')}</span>
        </label>
      )}
      {blocked && <Banner style="urgent">{blocked}</Banner>}
      <Button fullWidth disabled={!guardianId || (needsAck && !allergyAck)} onClick={checkIn}>
        {t('padel.checkIn')}
      </Button>
    </section>
  );
}
