'use client';

/** Creche incidents (PRD §8.3): the log, newest first, with the parent's acknowledgement status. */
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { CircleAlert, Plus } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { fmtDateTime, fmtTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import { INCIDENT_TYPE_LABEL } from './parts/incidentTypes';

const SEVERITY_TAG = { low: 'info', medium: 'warning', high: 'danger' } as const;

export function IncidentsScreen({ slot }: { slot: DeviceSlotId }) {
  const { push } = useNav(slot);
  const incidents = useStore((s) => s.incidents);
  const children = useStore((s) => s.children);
  const staff = useStore((s) => s.staff);

  const list = Object.values(incidents)
    .filter((i) => i.amenity === 'creche')
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-title-l text-text-title">Incidents</h1>
        <Button variant="secondary" onClick={() => push('log-incident')}>
          <Plus className="me-1 inline h-4 w-4" strokeWidth={1.5} />
          Log
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={CircleAlert} message="No incidents logged." />
      ) : (
        list.map((i) => {
          const child = i.childId ? children[i.childId] : undefined;
          return (
            <Card key={i.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-label-2 text-text-title">
                  {child?.name ?? 'Facility'} ·{' '}
                  {INCIDENT_TYPE_LABEL[i.category as keyof typeof INCIDENT_TYPE_LABEL] ??
                    i.category}
                </p>
                <Tag variant={SEVERITY_TAG[i.severity]}>{i.severity}</Tag>
              </div>
              <p className="text-body-2 text-text-body">{i.description}</p>
              <p className="text-body-3 text-text-muted">
                {fmtDateTime(i.at)} · {staff[i.raisedBy]?.name ?? 'Staff'}
                {i.witnessId ? ` · witness ${staff[i.witnessId]?.name}` : ''}
                {i.firstAid ? ' · first aid given' : ''}
              </p>
              {child && (
                <p
                  className={i.parentAck ? 'text-body-3 text-success' : 'text-body-3 text-warning'}
                >
                  {i.parentAck
                    ? `Acknowledged ${fmtTime(i.parentAck.at)}`
                    : i.parentNotifiedAt
                      ? `Parent told ${fmtTime(i.parentNotifiedAt)} · awaiting acknowledgement`
                      : 'Parent will be told at check-out'}
                </p>
              )}
              {i.workOrderId && <p className="text-body-3 text-text-muted">Work order raised</p>}
            </Card>
          );
        })
      )}
    </div>
  );
}
