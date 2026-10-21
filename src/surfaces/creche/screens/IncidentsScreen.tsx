'use client';

/** Creche incidents (PRD §8.3): the log, newest first, with the parent's acknowledgement status. */
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { CircleAlert, Plus } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';
import { isIncidentType } from './parts/incidentTypes';

const SEVERITY_TAG = { low: 'info', medium: 'warning', high: 'danger' } as const;

export function IncidentsScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
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
        <h1 className="text-title-l text-text-title">{t('creche.nav.incidents')}</h1>
        <Button variant="secondary" onClick={() => push('log-incident')}>
          <Plus className="me-1 inline h-4 w-4" strokeWidth={1.5} />
          {t('creche.log')}
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={CircleAlert} message={t('creche.noIncidents')} />
      ) : (
        list.map((i) => {
          const child = i.childId ? children[i.childId] : undefined;
          return (
            <Card key={i.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-label-2 text-text-title">
                  {child?.name ?? t('creche.incidentType.facility')} ·{' '}
                  {isIncidentType(i.category) ? t(`creche.incidentType.${i.category}`) : i.category}
                </p>
                <Tag variant={SEVERITY_TAG[i.severity]}>{t(`kids.severity.${i.severity}`)}</Tag>
              </div>
              <p className="text-body-2 text-text-body">{i.description}</p>
              <p className="text-body-3 text-text-muted">
                {fmt.dateTime(i.at)} · {staff[i.raisedBy]?.name ?? t('kids.staff')}
                {i.witnessId ? ` · ${t('creche.witness', { name: staff[i.witnessId]?.name })}` : ''}
                {i.firstAid ? ` · ${t('kids.firstAid')}` : ''}
              </p>
              {child && (
                <p
                  className={i.parentAck ? 'text-body-3 text-success' : 'text-body-3 text-warning'}
                >
                  {i.parentAck
                    ? t('creche.ackAt', { time: fmt.time(i.parentAck.at) })
                    : i.parentNotifiedAt
                      ? t('creche.parentTold', { time: fmt.time(i.parentNotifiedAt) })
                      : t('creche.parentAtCheckout')}
                </p>
              )}
              {i.workOrderId && (
                <p className="text-body-3 text-text-muted">{t('creche.workOrderRaised')}</p>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
