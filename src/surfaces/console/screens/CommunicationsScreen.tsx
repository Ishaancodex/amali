'use client';

/**
 * Communications home (PRD §8.7): sent/scheduled/draft announcements, a
 * "New" composer entry point, and the urgent closure flow's "Emergency
 * close" quick action for each of this supervisor's assigned amenities.
 */
import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Tag } from '@/ui/Tag';
import { EmptyState } from '@/ui/EmptyState';
import { Megaphone, CircleAlert } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { can, grantFor } from '@/domain/rbac/can';
import { fmtDateTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';
import type { AnnouncementType } from '@/types/comms';
import { useConsoleActor } from '../useConsoleActor';

const TYPE_LABEL: Record<AnnouncementType, string> = {
  daily: 'Daily update',
  event: 'Event',
  closure: 'Closure',
  urgent: 'Urgent',
  general: 'General',
};

export function CommunicationsScreen({ slot }: { slot: DeviceSlotId }) {
  const { push } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const announcements = useStore((s) => s.announcements);
  const amenities = useStore((s) => s.amenities);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const { actor, consoleRole, assignedAmenities } = useConsoleActor(slot);
  const [closing, setClosing] = useState<AmenityKey | undefined>();

  const canCompose = !!consoleRole && can({ consoleRole, capability: 'announcement.compose' });
  const statusGrant = consoleRole
    ? grantFor(consoleRole, 'amenity_status_hours.change')
    : undefined;
  const canChangeStatus = !!statusGrant && statusGrant.scope !== 'none';
  // scope 'all' (Community Manager) can emergency-close any of these; scope 'assigned' (Supervisor) only their own.
  const EMERGENCY_CAPABLE: AmenityKey[] = ['pool', 'gym', 'padel'];
  const emergencyTargets =
    statusGrant?.scope === 'all'
      ? EMERGENCY_CAPABLE
      : EMERGENCY_CAPABLE.filter((a) => (assignedAmenities ?? []).includes(a));

  const list = Object.values(announcements).sort((a, b) =>
    (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt),
  );

  function emergencyClose(amenity: AmenityKey) {
    if (!actor) return;
    const result = dispatch(
      'amenity.emergencyClose',
      { amenity, reason: 'an operational issue' },
      actor,
      { assignedAmenities },
    );
    pushToast(
      slot,
      result.ok
        ? `${amenities[amenity]?.name ?? amenity} closed and residents notified.`
        : result.error.message,
      result.ok ? 'success' : 'error',
    );
    setClosing(undefined);
  }

  function reopen(amenity: AmenityKey) {
    if (!actor) return;
    const result = dispatch('amenity.reopen', { amenity }, actor, { assignedAmenities });
    pushToast(
      slot,
      result.ok ? `${amenities[amenity]?.name ?? amenity} reopened.` : result.error.message,
      result.ok ? 'success' : 'error',
    );
  }

  function isEmergencyClosed(key: AmenityKey): boolean {
    return amenityStatus.some((e) => e.amenity === key && e.status === 'emergency' && !e.to);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border-card flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-title-l text-text-title">Communications</h1>
        {canCompose && (
          <Button variant="primary" onClick={() => push('composer')}>
            New
          </Button>
        )}
      </div>

      {canChangeStatus && emergencyTargets.length > 0 && (
        <div className="border-border-card flex flex-wrap items-center gap-2 border-b px-6 py-3">
          <span className="text-body-3 text-text-muted">Urgent closure:</span>
          {emergencyTargets.map((key) => {
            const isClosed = isEmergencyClosed(key);
            return isClosed ? (
              <Button key={key} variant="secondary" onClick={() => reopen(key)}>
                Reopen {amenities[key]?.name ?? key}
              </Button>
            ) : (
              <Button key={key} variant="destructive" onClick={() => setClosing(key)}>
                Emergency close {amenities[key]?.name ?? key}
              </Button>
            );
          })}
        </div>
      )}

      {closing && (
        <div className="border-border-card bg-danger/5 border-b px-6 py-3">
          <div className="flex items-center gap-2.5">
            <CircleAlert className="text-danger h-4 w-4 shrink-0" strokeWidth={1.5} />
            <p className="text-body-2 text-text-body flex-1">
              Close {amenities[closing]?.name} now, for everyone, on every channel?
            </p>
            <Button variant="destructive" onClick={() => emergencyClose(closing)}>
              Confirm close
            </Button>
            <Button variant="tertiary" onClick={() => setClosing(undefined)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {list.length === 0 ? (
          <EmptyState icon={Megaphone} message="No announcements yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => push('announcement-detail', { id: a.id })}
                className="rounded-card border-border-card bg-surface flex items-center justify-between border-[0.5px] px-4 py-3 text-start"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Tag variant={a.type === 'urgent' ? 'danger' : 'brand'}>
                      {TYPE_LABEL[a.type]}
                    </Tag>
                    <span className="text-label-2 text-text-title truncate">{a.title}</span>
                  </div>
                  <p className="text-body-3 text-text-muted mt-0.5">
                    {a.sentAt
                      ? `Sent ${fmtDateTime(a.sentAt)}`
                      : `${a.state === 'scheduled' ? 'Scheduled' : 'Draft'}`}{' '}
                    · {(a.resolvedRecipientIds ?? []).length} recipients
                  </p>
                </div>
                <Tag
                  variant={
                    a.state === 'recalled' ? 'warning' : a.state === 'sent' ? 'success' : 'info'
                  }
                >
                  {a.state}
                </Tag>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
