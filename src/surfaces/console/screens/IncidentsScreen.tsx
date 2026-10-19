'use client';

/**
 * Incidents (PRD §8.5 step 2): triage into a work order — priority sets
 * the SLA, and the fields carry straight over from the incident.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Tag } from '@/ui/Tag';
import { Input } from '@/ui/Input';
import { EmptyState } from '@/ui/EmptyState';
import { CircleAlert } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { fmtDateTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import type { Priority, WorkOrderAssignee } from '@/types/ops';
import { useConsoleActor } from '../useConsoleActor';

const PRIORITIES: Priority[] = ['P1', 'P2', 'P3'];

export function IncidentsScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop, push } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const incidents = useStore((s) => s.incidents);
  const vendors = useStore((s) => s.vendors);
  const staff = useStore((s) => s.staff);
  const { actor, assignedAmenities } = useConsoleActor(slot);

  const [converting, setConverting] = useState<string | undefined>();
  const [priority, setPriority] = useState<Priority>('P2');
  const [title, setTitle] = useState('');
  const [assigneeKey, setAssigneeKey] = useState('');

  const list = Object.values(incidents)
    .filter((i) => !i.workOrderId && !i.mergedInto)
    .sort((a, b) => b.at.localeCompare(a.at));

  const assigneeOptions = [
    ...Object.values(vendors).map((v) => ({ key: `vendor:${v.id}`, label: v.name })),
    ...Object.values(staff)
      .filter((s) => s.role === 'technician' || s.role === 'housekeeping')
      .map((s) => ({ key: `staff:${s.id}`, label: s.name })),
  ];

  function startConvert(incidentId: string, defaultTitle: string) {
    setConverting(incidentId);
    setTitle(defaultTitle);
    setAssigneeKey(assigneeOptions[0]?.key ?? '');
  }

  function confirmConvert() {
    if (!converting || !actor || !assigneeKey) return;
    const [kind, id] = assigneeKey.split(':') as [WorkOrderAssignee['kind'], string];
    const result = dispatch(
      'incident.convertToWorkOrder',
      { incidentId: converting, priority, title: title || 'Work order', assignee: { kind, id } },
      actor,
      { assignedAmenities },
    );
    if (result.ok) {
      pushToast(slot, 'Converted to a work order.', 'success');
      setConverting(undefined);
      push('work-order-detail', { id: result.value.id });
    } else {
      pushToast(slot, result.error.message, 'error');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Incidents" onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {list.length === 0 ? (
            <EmptyState icon={CircleAlert} message="No open incidents." />
          ) : (
            list.map((inc) => (
              <div key={inc.id} className="rounded-card border-border-card border-[0.5px] p-3">
                <div className="flex items-center gap-2">
                  <Tag
                    variant={
                      inc.severity === 'high'
                        ? 'danger'
                        : inc.severity === 'medium'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {inc.severity}
                  </Tag>
                  <span className="text-label-2 text-text-title capitalize">{inc.amenity}</span>
                  <span className="text-body-3 text-text-muted">· {inc.category}</span>
                </div>
                <p className="text-body-2 text-text-body mt-1">{inc.description}</p>
                <p className="text-body-3 text-text-muted mt-1">{fmtDateTime(inc.at)}</p>

                {converting === inc.id ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`rounded-tag text-label-3 flex-1 py-1.5 text-center ${priority === p ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    <select
                      value={assigneeKey}
                      onChange={(e) => setAssigneeKey(e.target.value)}
                      className="rounded-input border-border-card bg-surface text-body-3 h-10 border px-2"
                    >
                      {assigneeOptions.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <Button variant="tertiary" onClick={() => setConverting(undefined)}>
                        Cancel
                      </Button>
                      <Button fullWidth onClick={confirmConvert}>
                        Convert to work order
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="mt-2"
                    onClick={() => startConvert(inc.id, `${inc.amenity} — ${inc.category}`)}
                  >
                    Convert to work order
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
