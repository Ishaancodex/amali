'use client';

/**
 * Edit an occurrence (PRD §8.6): move it or delete it, then choose the
 * scope — "This occurrence / This and following / All". Before saving it
 * previews exactly what the command will check: bookings a deletion
 * cancels (class RSVPs), padel bookings a new time displaces (with the
 * blackout's options), and clashes that would block the save.
 */
import { useState } from 'react';
import { Sheet } from '@/ui/Sheet';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Input } from '@/ui/Input';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import {
  editAll,
  editThisAndFollowing,
  editThisOccurrence,
  type EditScope,
} from '@/domain/programme/editScope';
import { blockingConflicts } from '@/domain/programme/conflicts';
import { programmeConflicts } from '@/store/selectors/programme';
import { cn } from '@/lib/cn';
import { fmtTime } from '@/lib/time';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { BlackoutHandling } from '@/types/amenity';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../../useConsoleActor';

const SCOPES: EditScope[] = ['this', 'following', 'all'];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-tag text-label-3 px-3 py-1.5',
        active ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
      )}
    >
      {children}
    </button>
  );
}

export function OccurrenceSheet({
  slot,
  target,
  onClose,
}: {
  slot: DeviceSlotId;
  target: { programmeId: string; originalStart: string } | undefined;
  onClose: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const item = useStore((s) => (target ? s.programme[target.programmeId] : undefined));
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const { actor, assignedAmenities } = useConsoleActor(slot);
  const [action, setAction] = useState<'move' | 'delete'>('move');
  const [time, setTime] = useState('');
  const [scope, setScope] = useState<EditScope>('this');
  const [handling, setHandling] = useState<BlackoutHandling>('cancel_priority_rebook');
  const [skip, setSkip] = useState(false);

  if (!item || !target)
    return (
      <Sheet open={false} onClose={onClose}>
        {null}
      </Sheet>
    );
  const state = useStore.getState();
  const now = state.demo.clock.now;
  const current = item.overrides[target.originalStart]?.start ?? target.originalStart;
  const startTime = time || fmtTime(current);
  const change = action === 'delete' ? ({ delete: true } as const) : { startTime };

  // The series as it would be saved, for the preview.
  const preview = (() => {
    if (scope === 'this') return [editThisOccurrence(item, target.originalStart, change)];
    if (scope === 'following') {
      const { head, tail } = editThisAndFollowing(
        item,
        target.originalStart,
        change,
        'preview',
        now,
      );
      return tail ? [head, tail] : [head];
    }
    return action === 'delete' ? [] : [editAll(item, change as { startTime: string }, now)];
  })();
  const conflicts = preview.map((p) => programmeConflicts(state, p, now));
  const blocking = conflicts.reduce((n, c) => n + blockingConflicts(c), 0);
  const displaced = conflicts.reduce((n, c) => n + c.bookings.affectedBookings.length, 0);

  // Class bookings a deletion would cancel.
  const removedFrom =
    scope === 'this' ? target.originalStart : scope === 'following' ? target.originalStart : now;
  const rsvps =
    action === 'delete' && item.effect === 'event'
      ? Object.values(state.rsvps).filter((r) => {
          const st = state.showtimes[r.showtimeId];
          if (!st || st.programmeId !== item.id || (r.state !== 'held' && r.state !== 'confirmed'))
            return false;
          return scope === 'this' ? st.id.endsWith(target.originalStart) : st.start >= removedFrom;
        }).length
      : 0;

  function close() {
    setAction('move');
    setTime('');
    setScope('this');
    setSkip(false);
    onClose();
  }

  function save() {
    if (!actor || !item || !target) return;
    const result = dispatch(
      'programme.edit',
      {
        programmeId: item.id,
        originalStart: target.originalStart,
        scope,
        change,
        handling: displaced ? handling : undefined,
        skipConflicts: skip,
      },
      actor,
      { assignedAmenities },
    );
    if (!result.ok) {
      pushToast(slot, errorText(result.error), 'error');
      return;
    }
    const v = result.value;
    pushToast(
      slot,
      [
        t('console.occurrence.saved'),
        v.cancelledBookings
          ? t('console.occurrence.cancelled', { count: v.cancelledBookings })
          : '',
        v.displacedBookings
          ? t('console.occurrence.displaced', { count: v.displacedBookings })
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      'success',
    );
    close();
  }

  return (
    <Sheet open onClose={close} title={item.title}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-body-2 text-text-body">{fmt.dateTime(current)}</p>
        <div className="flex gap-2">
          <Chip active={action === 'move'} onClick={() => setAction('move')}>
            {t('console.occurrence.changeTime')}
          </Chip>
          <Chip active={action === 'delete'} onClick={() => setAction('delete')}>
            {t('console.occurrence.delete')}
          </Chip>
        </div>
        {action === 'move' && (
          <Input
            label={t('console.occurrence.startTime')}
            type="time"
            value={startTime}
            onChange={(e) => setTime(e.target.value)}
          />
        )}
        <div className="flex flex-wrap gap-2">
          {SCOPES.map((s) => (
            <Chip key={s} active={scope === s} onClick={() => setScope(s)}>
              {t(`console.occurrence.scope.${s}`)}
            </Chip>
          ))}
        </div>

        {rsvps > 0 && (
          <Banner style="warning">
            {t('console.occurrence.rsvpsCancelled', { count: rsvps })}
          </Banner>
        )}
        {displaced > 0 && (
          <div className="flex flex-col gap-2">
            <Banner style="warning">
              {t('console.occurrence.inTheWay', { count: displaced })}
            </Banner>
            <div className="flex gap-2">
              <Chip
                active={handling === 'cancel_priority_rebook'}
                onClick={() => setHandling('cancel_priority_rebook')}
              >
                {t('console.blackout.handling.cancel_priority_rebook')}
              </Chip>
              <Chip active={handling === 'auto_move'} onClick={() => setHandling('auto_move')}>
                {t('console.occurrence.autoMove')}
              </Chip>
            </div>
          </div>
        )}
        {blocking > 0 && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brand h-4 w-4"
              checked={skip}
              onChange={(e) => setSkip(e.target.checked)}
            />
            <span className="text-body-2 text-danger">
              {t('console.occurrence.clashSkip', { count: blocking })}
            </span>
          </label>
        )}
        <Button
          fullWidth
          variant={action === 'delete' ? 'destructive' : 'primary'}
          disabled={blocking > 0 && !skip}
          onClick={save}
        >
          {action === 'delete' ? t('console.occurrence.delete') : t('common.save')}
        </Button>
      </div>
    </Sheet>
  );
}
