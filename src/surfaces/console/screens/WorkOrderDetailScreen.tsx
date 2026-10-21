'use client';

/**
 * Work order detail (PRD §8.5 steps 5-8): the state machine, SLA
 * countdowns, roster visibility for the amenity, a timeline, and the
 * simulated "Vendor update" action.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Tag } from '@/ui/Tag';
import { Input } from '@/ui/Input';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { dubaiDateKey } from '@/lib/time';
import { useAmenityLabel, useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';
import type { WorkOrderState } from '@/types/ops';
import { useConsoleActor } from '../useConsoleActor';
import { WorkOrderStatusSuggestion } from './parts/WorkOrderStatusSuggestion';
import { WorkOrderSla } from './parts/WorkOrderSla';

export function WorkOrderDetailScreen({
  slot,
  workOrderId,
}: {
  slot: DeviceSlotId;
  workOrderId: string;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const amenityLabel = useAmenityLabel();
  const { pop } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const workOrder = useStore((s) => s.workOrders[workOrderId]);
  const vendors = useStore((s) => s.vendors);
  const staff = useStore((s) => s.staff);
  const shifts = useStore((s) => s.shifts);
  const now = useStore((s) => s.demo.clock.now);
  const { actor, assignedAmenities } = useConsoleActor(slot);

  const [vendorNote, setVendorNote] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [costFils, setCostFils] = useState('');

  if (!workOrder) return null;

  const assigneeName =
    workOrder.assignee.kind === 'vendor'
      ? (vendors[workOrder.assignee.id]?.name ?? workOrder.assignee.id)
      : (staff[workOrder.assignee.id]?.name ?? workOrder.assignee.id);

  const todayKey = dubaiDateKey(now);
  const todayShifts = Object.values(shifts).filter(
    (s) => s.date === todayKey && s.amenity === workOrder.amenity,
  );

  function transition(toState: WorkOrderState, note?: string, silent = false) {
    if (!actor) return;
    const resolution =
      toState === 'closed'
        ? {
            note: resolutionNote,
            costFils: costFils ? Math.round(Number(costFils) * 100) : undefined,
          }
        : undefined;
    const result = dispatch(
      'workOrder.transition',
      { workOrderId, toState, note, resolution },
      actor,
      { assignedAmenities },
    );
    if (silent && result.ok) return;
    pushToast(
      slot,
      result.ok
        ? t('console.woDetail.moved', { state: t(`console.woState.${toState}`) })
        : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  // The simulated vendor update (S6 step 5) can land before anyone pressed "Start work" — the vendor
  // was on site regardless, so it walks the state machine through In progress on its way to Resolved.
  function vendorUpdate() {
    if (workOrder?.state === 'assigned')
      transition('in_progress', t('console.woDetail.onSite', { name: assigneeName }), true);
    transition(
      'resolved',
      vendorNote || t('console.woDetail.workComplete', { name: assigneeName }),
    );
    setVendorNote('');
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={workOrder.title} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <section className="flex flex-wrap items-center gap-2">
            <Tag variant="brand">{workOrder.priority}</Tag>
            <Tag variant="info">{t(`console.woState.${workOrder.state}`)}</Tag>
            <span className="text-body-3 text-text-muted">
              {amenityLabel(workOrder.amenity, 'short')}
            </span>
            <span className="text-body-3 text-text-muted">· {assigneeName}</span>
          </section>

          <WorkOrderStatusSuggestion slot={slot} workOrder={workOrder} />

          <WorkOrderSla workOrder={workOrder} now={now} />

          {todayShifts.length > 0 && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">
                {t('console.woDetail.roster', {
                  amenity: amenityLabel(workOrder.amenity, 'short'),
                })}
              </h2>
              <p className="text-body-2 text-text-body">
                {todayShifts
                  .map(
                    (s) =>
                      `${staff[s.staffId]?.name ?? s.staffId} (${fmt.time(s.start)}–${fmt.time(s.end)})`,
                  )
                  .join(' · ')}
              </p>
            </section>
          )}

          <section className="flex flex-wrap gap-2">
            {workOrder.state === 'assigned' && (
              <Button onClick={() => transition('in_progress')}>
                {t('console.woDetail.start')}
              </Button>
            )}
            {workOrder.state === 'in_progress' && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => transition('on_hold', t('console.woDetail.awaiting'))}
                >
                  {t('console.woDetail.hold')}
                </Button>
                <Button onClick={() => transition('resolved')}>
                  {t('console.woDetail.markResolved')}
                </Button>
              </>
            )}
            {workOrder.state === 'on_hold' && (
              <>
                <Button variant="secondary" onClick={() => transition('in_progress')}>
                  {t('console.woDetail.resume')}
                </Button>
                <Button onClick={() => transition('resolved')}>
                  {t('console.woDetail.markResolved')}
                </Button>
              </>
            )}
          </section>

          {(workOrder.state === 'assigned' ||
            workOrder.state === 'in_progress' ||
            workOrder.state === 'on_hold') &&
            workOrder.assignee.kind === 'vendor' && (
              <section>
                <h2 className="text-label-1 text-text-title mb-2">
                  {t('console.woDetail.vendorUpdate')}
                </h2>
                <div className="flex gap-2">
                  <input
                    value={vendorNote}
                    onChange={(e) => setVendorNote(e.target.value)}
                    placeholder={t('console.woDetail.updateHint', { name: assigneeName })}
                    aria-label={t('console.woDetail.vendorUpdate')}
                    className="rounded-input border-border-card bg-surface text-body-3 h-10 flex-1 border px-3"
                  />
                  <Button onClick={vendorUpdate}>{t('console.woDetail.send')}</Button>
                </div>
              </section>
            )}

          {workOrder.state === 'resolved' && (
            <section className="flex flex-col gap-2">
              <h2 className="text-label-1 text-text-title">{t('console.woDetail.closeTitle')}</h2>
              <Input
                label={t('console.woDetail.resolutionNote')}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
              <Input
                label={t('console.woDetail.cost')}
                type="number"
                value={costFils}
                onChange={(e) => setCostFils(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => transition('in_progress', t('console.woDetail.reopenNote'))}
                >
                  {t('console.woDetail.reopen')}
                </Button>
                <Button
                  fullWidth
                  disabled={!resolutionNote.trim()}
                  onClick={() => transition('closed')}
                >
                  {t('console.woDetail.verify')}
                </Button>
              </div>
            </section>
          )}

          {workOrder.resolution && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">
                {t('console.woDetail.resolution')}
              </h2>
              <p className="text-body-2 text-text-body">{workOrder.resolution.note}</p>
              {workOrder.resolution.costFils !== undefined && (
                <p className="text-body-3 text-text-muted mt-1">
                  {fmt.aed(workOrder.resolution.costFils)}
                </p>
              )}
            </section>
          )}

          <section>
            <h2 className="text-label-1 text-text-title mb-2">{t('fnb.tab.timeline')}</h2>
            <div className="flex flex-col gap-2">
              {[...workOrder.timeline].reverse().map((entry, i) => (
                <div key={i} className="text-body-3 text-text-body">
                  <span className="text-text-muted">{fmt.dateTime(entry.at)}</span> — {entry.text}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
