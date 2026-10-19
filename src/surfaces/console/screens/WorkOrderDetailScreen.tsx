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
import { resolveSlaState } from '@/domain/ops/sla';
import { rules } from '@/config/rules';
import { dubaiDateKey, fmtDateTime, fmtTime, minutesBetween } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import type { WorkOrderState } from '@/types/ops';
import { useConsoleActor } from '../useConsoleActor';
import { WorkOrderStatusSuggestion } from './parts/WorkOrderStatusSuggestion';

const SLA_TAG = { on_track: 'success', at_risk: 'warning', breached: 'danger' } as const;

function countdownLabel(now: string, deadline: string): string {
  const minutes = minutesBetween(now, deadline);
  if (minutes <= 0) return `overdue by ${Math.abs(minutes)}m`;
  if (minutes < 60) return `${minutes}m left`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
}

export function WorkOrderDetailScreen({
  slot,
  workOrderId,
}: {
  slot: DeviceSlotId;
  workOrderId: string;
}) {
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

  const respondState = resolveSlaState(
    workOrder.sla.respondBy,
    workOrder.createdAt,
    workOrder.sla,
    now,
    rules.ops.slaAtRiskFraction,
    workOrder.sla.respondedAt,
  );
  const resolveState = resolveSlaState(
    workOrder.sla.resolveBy,
    workOrder.createdAt,
    workOrder.sla,
    now,
    rules.ops.slaAtRiskFraction,
    workOrder.sla.resolvedAt,
  );

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
      result.ok ? `Moved to ${toState.replace(/_/g, ' ')}.` : result.error.message,
      result.ok ? 'success' : 'error',
    );
  }

  // The simulated vendor update (S6 step 5) can land before anyone pressed "Start work" — the vendor
  // was on site regardless, so it walks the state machine through In progress on its way to Resolved.
  function vendorUpdate() {
    if (workOrder?.state === 'assigned') transition('in_progress', `${assigneeName} on site`, true);
    transition('resolved', vendorNote || `${assigneeName}: work complete`);
    setVendorNote('');
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={workOrder.title} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <section className="flex flex-wrap items-center gap-2">
            <Tag variant="brand">{workOrder.priority}</Tag>
            <Tag variant="info">{workOrder.state.replace(/_/g, ' ')}</Tag>
            <span className="text-body-3 text-text-muted capitalize">{workOrder.amenity}</span>
            <span className="text-body-3 text-text-muted">· {assigneeName}</span>
          </section>

          <WorkOrderStatusSuggestion slot={slot} workOrder={workOrder} />

          <section>
            <h2 className="text-label-1 text-text-title mb-2">SLA</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-card border-border-card border-[0.5px] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-label-2 text-text-title">Respond</span>
                  <Tag variant={SLA_TAG[respondState]}>{respondState.replace(/_/g, ' ')}</Tag>
                </div>
                <p className="text-body-3 text-text-muted mt-1">
                  {workOrder.sla.respondedAt
                    ? `Responded ${fmtTime(workOrder.sla.respondedAt)}`
                    : countdownLabel(now, workOrder.sla.respondBy)}
                </p>
              </div>
              <div className="rounded-card border-border-card border-[0.5px] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-label-2 text-text-title">Resolve</span>
                  <Tag variant={SLA_TAG[resolveState]}>{resolveState.replace(/_/g, ' ')}</Tag>
                </div>
                <p className="text-body-3 text-text-muted mt-1">
                  {workOrder.sla.resolvedAt
                    ? `Resolved ${fmtTime(workOrder.sla.resolvedAt)}`
                    : countdownLabel(now, workOrder.sla.resolveBy)}
                </p>
              </div>
            </div>
          </section>

          {todayShifts.length > 0 && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">
                Today&apos;s roster — {workOrder.amenity}
              </h2>
              <p className="text-body-2 text-text-body">
                {todayShifts
                  .map(
                    (s) =>
                      `${staff[s.staffId]?.name ?? s.staffId} (${fmtTime(s.start)}–${fmtTime(s.end)})`,
                  )
                  .join(' · ')}
              </p>
            </section>
          )}

          <section className="flex flex-wrap gap-2">
            {workOrder.state === 'assigned' && (
              <Button onClick={() => transition('in_progress')}>Start work</Button>
            )}
            {workOrder.state === 'in_progress' && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => transition('on_hold', 'Awaiting parts/vendor')}
                >
                  Put on hold
                </Button>
                <Button onClick={() => transition('resolved')}>Mark resolved</Button>
              </>
            )}
            {workOrder.state === 'on_hold' && (
              <>
                <Button variant="secondary" onClick={() => transition('in_progress')}>
                  Resume
                </Button>
                <Button onClick={() => transition('resolved')}>Mark resolved</Button>
              </>
            )}
          </section>

          {(workOrder.state === 'assigned' ||
            workOrder.state === 'in_progress' ||
            workOrder.state === 'on_hold') &&
            workOrder.assignee.kind === 'vendor' && (
              <section>
                <h2 className="text-label-1 text-text-title mb-2">Vendor update</h2>
                <div className="flex gap-2">
                  <input
                    value={vendorNote}
                    onChange={(e) => setVendorNote(e.target.value)}
                    placeholder={`${assigneeName}: what's the update?`}
                    className="rounded-input border-border-card bg-surface text-body-3 h-10 flex-1 border px-3"
                  />
                  <Button onClick={vendorUpdate}>Send</Button>
                </div>
              </section>
            )}

          {workOrder.state === 'resolved' && (
            <section className="flex flex-col gap-2">
              <h2 className="text-label-1 text-text-title">Close — verify and resolve</h2>
              <Input
                label="Resolution note"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
              <Input
                label="Cost (AED, optional)"
                type="number"
                value={costFils}
                onChange={(e) => setCostFils(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => transition('in_progress', 'Reopened — verification failed')}
                >
                  Reopen
                </Button>
                <Button
                  fullWidth
                  disabled={!resolutionNote.trim()}
                  onClick={() => transition('closed')}
                >
                  Verify and close
                </Button>
              </div>
            </section>
          )}

          {workOrder.resolution && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">Resolution</h2>
              <p className="text-body-2 text-text-body">{workOrder.resolution.note}</p>
              {workOrder.resolution.costFils !== undefined && (
                <p className="text-body-3 text-text-muted mt-1">
                  AED {(workOrder.resolution.costFils / 100).toFixed(0)}
                </p>
              )}
            </section>
          )}

          <section>
            <h2 className="text-label-1 text-text-title mb-2">Timeline</h2>
            <div className="flex flex-col gap-2">
              {[...workOrder.timeline].reverse().map((entry, i) => (
                <div key={i} className="text-body-3 text-text-body">
                  <span className="text-text-muted">{fmtDateTime(entry.at)}</span> — {entry.text}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
