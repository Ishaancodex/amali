'use client';

/** The activity line parents see ("Story time", "Arts & crafts", "Snack") — one tap sets it for the room. */
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/cn';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { ACTIVITIES, activityLabel } from '@/features/creche/activities';
import type { CrecheBooking } from '@/types/creche';
import type { DeviceSlotId } from '@/types/demo';
import { useCrecheStaff } from '../../useCrecheStaff';

export function ActivityPicker({ slot, inRoom }: { slot: DeviceSlotId; inRoom: CrecheBooking[] }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const { actor } = useCrecheStaff(slot);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);

  const latest = inRoom
    .flatMap((b) => b.activity ?? [])
    .reduce<{ label: string; at: string } | undefined>(
      (acc, a) => (!acc || a.at >= acc.at ? a : acc),
      undefined,
    );

  function set(label: string) {
    if (!actor) return;
    const result = dispatch('creche.setActivity', { label }, actor);
    if (!result.ok) pushToast(slot, errorText(result.error), 'error');
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-label-1 text-text-title">{t('creche.happeningNow')}</h2>
        {latest && (
          <span className="text-body-3 text-text-muted">
            {t('creche.since', {
              label: activityLabel(latest.label, t),
              time: fmt.time(latest.at),
            })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.keys(ACTIVITIES).map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => set(label)}
            className={cn(
              'rounded-tag text-label-3 px-3 py-1.5',
              latest?.label === label ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
            )}
          >
            {activityLabel(label, t)}
          </button>
        ))}
      </div>
    </section>
  );
}
