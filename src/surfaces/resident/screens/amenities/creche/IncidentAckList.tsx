'use client';

/** Incident reports the parent has been told about but not yet acknowledged (PRD §8.3: "The parent must acknowledge"). */
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';

const SEVERITY_TAG = { low: 'info', medium: 'warning', high: 'danger' } as const;

export function IncidentAckList({ slot, childIds }: { slot: DeviceSlotId; childIds: string[] }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const incidents = useStore((s) => s.incidents);
  const children = useStore((s) => s.children);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);

  const open = Object.values(incidents)
    .filter((i) => i.childId && childIds.includes(i.childId) && i.parentNotifiedAt && !i.parentAck)
    .sort((a, b) => b.at.localeCompare(a.at));
  if (open.length === 0) return null;

  function acknowledge(incidentId: string) {
    const result = dispatch(
      'creche.acknowledgeIncident',
      { incidentId },
      { kind: 'resident', id: actorId },
    );
    pushToast(
      slot,
      result.ok ? t('kids.acknowledged') : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <>
      {open.map((i) => (
        <Card key={i.id} className="border-warning flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="font-serif-display text-serif-section text-text-title">
              {t('kids.incidentReport', { name: children[i.childId!]?.name.split(' ')[0] })}
            </p>
            <Tag variant={SEVERITY_TAG[i.severity]}>{t(`kids.severity.${i.severity}`)}</Tag>
          </div>
          <p className="text-body-2 text-text-body">{i.description}</p>
          <p className="text-body-3 text-text-muted">
            {fmt.time(i.at)}
            {i.firstAid ? ` · ${t('kids.firstAid')}` : ''}
          </p>
          <Button fullWidth onClick={() => acknowledge(i.id)}>
            {t('kids.acknowledge')}
          </Button>
        </Card>
      ))}
    </>
  );
}
