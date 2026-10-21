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
import { useAmenityLabel, useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';
import { useConsoleActor } from '../useConsoleActor';

export function CommunicationsScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const amenityLabel = useAmenityLabel();
  const { push } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const announcements = useStore((s) => s.announcements);
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
        ? t('console.comms.closedNotified', { amenity: amenityLabel(amenity) })
        : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
    setClosing(undefined);
  }

  function reopen(amenity: AmenityKey) {
    if (!actor) return;
    const result = dispatch('amenity.reopen', { amenity }, actor, { assignedAmenities });
    pushToast(
      slot,
      result.ok
        ? t('console.comms.reopened', { amenity: amenityLabel(amenity) })
        : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  function isEmergencyClosed(key: AmenityKey): boolean {
    return amenityStatus.some((e) => e.amenity === key && e.status === 'emergency' && !e.to);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border-card flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-title-l text-text-title">{t('console.nav.comms')}</h1>
        {canCompose && (
          <Button variant="primary" onClick={() => push('composer')}>
            {t('console.comms.new')}
          </Button>
        )}
      </div>

      {canChangeStatus && emergencyTargets.length > 0 && (
        <div className="border-border-card flex flex-wrap items-center gap-2 border-b px-6 py-3">
          <span className="text-body-3 text-text-muted">{t('console.comms.urgentClosure')}</span>
          {emergencyTargets.map((key) => {
            const isClosed = isEmergencyClosed(key);
            return isClosed ? (
              <Button key={key} variant="secondary" onClick={() => reopen(key)}>
                {t('console.wo.reopen', { amenity: amenityLabel(key) })}
              </Button>
            ) : (
              <Button key={key} variant="destructive" onClick={() => setClosing(key)}>
                {t('console.comms.emergencyClose', { amenity: amenityLabel(key) })}
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
              {t('console.comms.confirmQuestion', { amenity: amenityLabel(closing) })}
            </p>
            <Button variant="destructive" onClick={() => emergencyClose(closing)}>
              {t('console.comms.confirmClose')}
            </Button>
            <Button variant="tertiary" onClick={() => setClosing(undefined)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {list.length === 0 ? (
          <EmptyState icon={Megaphone} message={t('console.comms.none')} />
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
                      {t(`console.comms.type.${a.type}`)}
                    </Tag>
                    <span className="text-label-2 text-text-title truncate">{a.title}</span>
                  </div>
                  <p className="text-body-3 text-text-muted mt-0.5">
                    {a.sentAt
                      ? t('console.comms.sentAt', { date: fmt.dateTime(a.sentAt) })
                      : t(
                          `console.comms.state.${a.state === 'scheduled' ? 'scheduled' : 'draft'}`,
                        )}{' '}
                    ·{' '}
                    {t('console.comms.recipients', {
                      count: (a.resolvedRecipientIds ?? []).length,
                    })}
                  </p>
                </div>
                <Tag
                  variant={
                    a.state === 'recalled' ? 'warning' : a.state === 'sent' ? 'success' : 'info'
                  }
                >
                  {t(`console.comms.state.${a.state}`)}
                </Tag>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
