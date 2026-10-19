'use client';

/**
 * One booking, host side (PRD §8.4): who, when, which tables, dietary
 * (allergies in red), requests and occasion, the deposit, then the
 * actions for its state — seat or mark no-show, edit the party size (a
 * party that outgrows its table is moved or combined), add a note,
 * request the bill, settle.
 */
import { useState } from 'react';
import { Sheet } from '@/ui/Sheet';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Stepper } from '@/ui/Stepper';
import { Input } from '@/ui/Input';
import { Tag } from '@/ui/Tag';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { fmtAed } from '@/lib/money';
import { fmtDateTime, fmtTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import { hasAllergy } from '../../useService';
import { SettlePanel } from './SettlePanel';

export function ReservationPanel({
  slot,
  reservationId,
  onClose,
}: {
  slot: DeviceSlotId;
  reservationId: string | undefined;
  onClose: () => void;
}) {
  const r = useStore((s) => (reservationId ? s.reservations[reservationId] : undefined));
  const guest = useStore((s) => (r ? s.residents[r.residentId] : undefined));
  const hold = useStore((s) => (r?.depositHoldId ? s.walletHolds[r.depositHoldId] : undefined));
  const dispatch = useStore((s) => s.dispatch);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const role = useStore((s) => s.staff[actorId]?.role);
  const pushToast = useUiStore((s) => s.pushToast);
  const [size, setSize] = useState<number | undefined>();
  const [note, setNote] = useState<string | undefined>();
  const actor = { kind: 'staff' as const, id: actorId, role };

  if (!r)
    return (
      <Sheet open={false} onClose={onClose}>
        {null}
      </Sheet>
    );
  const partySize = size ?? r.partySize;
  const { min, max } = rules.dining[r.venue].partySize;

  function run(result: { ok: boolean; error?: { message: string } }, done: string) {
    pushToast(
      slot,
      result.ok ? done : (result.error?.message ?? ''),
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <Sheet
      open={!!reservationId}
      onClose={() => {
        setSize(undefined);
        setNote(undefined);
        onClose();
      }}
      title={r.walkIn ? 'Walk-in' : (guest?.name ?? 'Guest')}
    >
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{r.state.replace('_', ' ')}</Tag>
          <span className="text-body-2 text-text-body">
            {fmtDateTime(r.start)}–{fmtTime(r.end)} · {r.partySize} ·{' '}
            {r.tableIds.join('+') || 'no table yet'}
          </span>
        </div>
        {hasAllergy(r.dietary) && (
          <Banner style="urgent">
            Allergy: {r.dietary.filter((d) => d.includes('allerg')).join(', ')}
          </Banner>
        )}
        <p className="text-body-3 text-text-muted">
          {[
            r.occasion,
            r.dietary.filter((d) => !d.includes('allerg')).join(', '),
            r.highChair ? 'High chair' : '',
            r.accessibility,
            r.seatingPref ? `Requested: ${r.seatingPref}` : '',
            r.requests ? `“${r.requests}”` : '',
            r.runningLateMinutes ? `Running ~${r.runningLateMinutes} min late` : '',
            hold
              ? `Deposit ${fmtAed(hold.fils)} (${hold.state === 'active' ? 'on hold' : hold.state})`
              : '',
            r.notes ? `Note: ${r.notes}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || 'No preferences.'}
        </p>

        {(r.state === 'confirmed' || r.state === 'seated') && (
          <div className="flex items-end gap-3">
            <Stepper label="Party size" value={partySize} min={min} max={max} onChange={setSize} />
            <Button
              variant="secondary"
              disabled={partySize === r.partySize}
              onClick={() =>
                run(
                  dispatch('dining.changePartySize', { reservationId: r.id, partySize }, actor),
                  `Party of ${partySize}.`,
                )
              }
            >
              Save size
            </Button>
          </div>
        )}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Note"
              value={note ?? r.notes ?? ''}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={note === undefined}
            onClick={() =>
              run(
                dispatch('dining.addNote', { reservationId: r.id, note: note ?? '' }, actor),
                'Note saved.',
              )
            }
          >
            Save
          </Button>
        </div>

        {r.state === 'confirmed' && (
          <Button
            fullWidth
            onClick={() => run(dispatch('dining.seat', { reservationId: r.id }, actor), 'Seated.')}
          >
            Seat
          </Button>
        )}
        {r.state === 'seated' && !r.billRequestedAt && (
          <Button
            variant="secondary"
            fullWidth
            onClick={() =>
              run(dispatch('dining.requestBill', { reservationId: r.id }, actor), 'Bill requested.')
            }
          >
            Bill requested
          </Button>
        )}
        {r.state === 'seated' && <SettlePanel slot={slot} reservation={r} />}
        {r.bill && (
          <Banner style={r.bill.flagged ? 'warning' : 'success'}>
            Settled {fmtAed(r.bill.totalFils)}
            {r.bill.minimumSpendTopUpFils
              ? ` + ${fmtAed(r.bill.minimumSpendTopUpFils)} minimum-spend top-up`
              : ''}
            {r.bill.depositAppliedFils
              ? ` · deposit ${fmtAed(r.bill.depositAppliedFils)} applied`
              : ''}{' '}
            · {fmtAed(r.bill.chargedFils)}{' '}
            {r.bill.method === 'wallet' ? 'to the wallet' : 'to the unit account'}
            {r.bill.flagged ? ` — ${r.bill.flagged}` : ''}.
          </Banner>
        )}
      </div>
    </Sheet>
  );
}
