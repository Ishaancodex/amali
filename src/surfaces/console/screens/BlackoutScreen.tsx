'use client';

/**
 * Padel blackout (PRD §8.1 ops flow): a window, a reason, and what happens
 * to the bookings in it — with the impact preview first ("4 bookings · 7
 * residents · 3 waitlist entries · AED 100 guest fees to refund"). Gated
 * by `blackout.create`: a role without it sees the no-permission state.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { computeBlackoutImpact } from '@/domain/booking/blackoutImpact';
import { addDaysIso, dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import { fmtAed } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { BlackoutHandling } from '@/types/amenity';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';

export function BlackoutScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop } = useNav(slot);
  const { actor, assignedAmenities } = useConsoleActor(slot);
  const now = useStore((s) => s.demo.clock.now);
  const bookings = useStore((s) => s.bookings);
  const waitlist = useStore((s) => s.waitlist);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const tomorrow = dubaiDateKey(addDaysIso(now, 1));
  const [date, setDate] = useState(tomorrow);
  const [from, setFrom] = useState('06:00');
  const [to, setTo] = useState('12:00');
  const [reason, setReason] = useState('Court resurfacing');
  const [handling, setHandling] = useState<BlackoutHandling>('cancel_priority_rebook');

  const start = dubaiDateTimeToIso(date, from);
  const end = dubaiDateTimeToIso(date, to);
  const impact = computeBlackoutImpact(
    start,
    end,
    Object.values(bookings).filter((b) => b.amenity === 'padel'),
    Object.values(waitlist),
  );

  function save() {
    if (!actor) return;
    const result = dispatch('blackout.create', { start, end, reason, handling }, actor, {
      assignedAmenities,
    });
    pushToast(
      slot,
      result.ok ? 'Blackout created.' : result.error.message,
      result.ok ? 'success' : 'error',
    );
    if (result.ok) pop();
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Padel blackout" onBack={pop} />
      <div className="flex max-w-xl flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 [&>*]:shrink-0">
        <div className="flex gap-3">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="From" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Card className="flex flex-col gap-2">
          <p className="text-label-2 text-text-title">Impact</p>
          <p className="text-body-2 text-text-body">
            {impact.affectedBookings.length} bookings · {impact.affectedResidentCount} residents ·{' '}
            {impact.affectedWaitlistEntries.length} waitlist entries ·{' '}
            {fmtAed(impact.guestFeesToRefundFils)} guest fees to refund
          </p>
          <div className="flex gap-2">
            {(['cancel_priority_rebook', 'auto_move'] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHandling(h)}
                className={cn(
                  'rounded-tag text-label-3 px-3 py-1.5',
                  handling === h ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
                )}
              >
                {h === 'cancel_priority_rebook'
                  ? 'Cancel & priority rebook'
                  : 'Auto-move to nearest slot'}
              </button>
            ))}
          </div>
        </Card>
        {end <= start && <Banner style="urgent">The blackout must end after it starts.</Banner>}
        <Button disabled={end <= start || !reason.trim()} onClick={save}>
          Create blackout
        </Button>
      </div>
    </div>
  );
}
