'use client';

/** The activity line parents see ("Story time", "Arts & crafts", "Snack") — one tap sets it for the room. */
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/cn';
import { fmtTime } from '@/lib/time';
import type { CrecheBooking } from '@/types/creche';
import type { DeviceSlotId } from '@/types/demo';
import { useCrecheStaff } from '../../useCrecheStaff';

const ACTIVITIES = [
  'Free play',
  'Story time',
  'Arts & crafts',
  'Snack',
  'Outdoor play',
  'Quiet time',
];

export function ActivityPicker({ slot, inRoom }: { slot: DeviceSlotId; inRoom: CrecheBooking[] }) {
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
    if (!result.ok) pushToast(slot, result.error.message, 'error');
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-label-1 text-text-title">Happening now</h2>
        {latest && (
          <span className="text-body-3 text-text-muted">
            {latest.label} since {fmtTime(latest.at)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTIVITIES.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => set(label)}
            className={cn(
              'rounded-tag text-label-3 px-3 py-1.5',
              latest?.label === label ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
