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
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
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
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
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

  function run(result: { ok: boolean; error?: { code: string; message: string } }, done: string) {
    pushToast(slot, result.ok ? done : errorText(result.error), result.ok ? 'success' : 'error');
  }

  return (
    <Sheet
      open={!!reservationId}
      onClose={() => {
        setSize(undefined);
        setNote(undefined);
        onClose();
      }}
      title={r.walkIn ? t('fnb.walkIn') : (guest?.name ?? t('fnb.guest'))}
    >
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{t(`dining.state.${r.state}`)}</Tag>
          <span className="text-body-2 text-text-body">
            {fmt.dateTime(r.start)}–{fmt.time(r.end)} · {r.partySize} ·{' '}
            {r.tableIds.join('+') || t('fnb.noTable')}
          </span>
        </div>
        {hasAllergy(r.dietary) && (
          <Banner style="urgent">
            {t('myUnit.allergy', {
              text: r.dietary.filter((d) => d.includes('allerg')).join(', '),
            })}
          </Banner>
        )}
        <p className="text-body-3 text-text-muted">
          {[
            r.occasion,
            r.dietary.filter((d) => !d.includes('allerg')).join(', '),
            r.highChair ? t('dining.requests.highChair') : '',
            r.accessibility,
            r.seatingPref
              ? t('dining.seatingRequested', { zone: t(`dining.zone.${r.seatingPref}`) })
              : '',
            r.requests ? `“${r.requests}”` : '',
            r.runningLateMinutes ? t('fnb.minLate', { minutes: r.runningLateMinutes }) : '',
            hold
              ? t('dining.depositState', {
                  amount: fmt.aed(hold.fils),
                  state: t(`dining.holdState.${hold.state}`),
                })
              : '',
            r.notes ? t('fnb.noteValue', { note: r.notes }) : '',
          ]
            .filter(Boolean)
            .join(' · ') || t('fnb.noPreferences')}
        </p>

        {(r.state === 'confirmed' || r.state === 'seated') && (
          <div className="flex items-end gap-3">
            <Stepper
              label={t('dining.partySize')}
              value={partySize}
              min={min}
              max={max}
              onChange={setSize}
            />
            <Button
              variant="secondary"
              disabled={partySize === r.partySize}
              onClick={() =>
                run(
                  dispatch('dining.changePartySize', { reservationId: r.id, partySize }, actor),
                  t('fnb.partyOf', { count: partySize }),
                )
              }
            >
              {t('fnb.saveSize')}
            </Button>
          </div>
        )}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label={t('fnb.note')}
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
                t('fnb.noteSaved'),
              )
            }
          >
            {t('common.save')}
          </Button>
        </div>

        {r.state === 'confirmed' && (
          <Button
            fullWidth
            onClick={() =>
              run(dispatch('dining.seat', { reservationId: r.id }, actor), t('fnb.seatedToast'))
            }
          >
            {t('fnb.seat')}
          </Button>
        )}
        {r.state === 'seated' && !r.billRequestedAt && (
          <Button
            variant="secondary"
            fullWidth
            onClick={() =>
              run(
                dispatch('dining.requestBill', { reservationId: r.id }, actor),
                t('fnb.table.bill'),
              )
            }
          >
            {t('fnb.requestBill')}
          </Button>
        )}
        {r.state === 'seated' && <SettlePanel slot={slot} reservation={r} />}
        {r.bill && (
          <Banner style={r.bill.flagged ? 'warning' : 'success'}>
            {[
              t('fnb.settledAmount', { amount: fmt.aed(r.bill.totalFils) }),
              r.bill.minimumSpendTopUpFils
                ? t('dining.minTopUp', { amount: fmt.aed(r.bill.minimumSpendTopUpFils) })
                : '',
              r.bill.depositAppliedFils
                ? t('dining.depositApplied', { amount: fmt.aed(r.bill.depositAppliedFils) })
                : '',
              t(r.bill.method === 'wallet' ? 'fnb.toWallet' : 'fnb.toUnitShort', {
                amount: fmt.aed(r.bill.chargedFils),
              }),
              r.bill.flagged ?? '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Banner>
        )}
      </div>
    </Sheet>
  );
}
