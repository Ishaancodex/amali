'use client';

/** Large-party requests (PRD §8.4 "Approvals"): accept or decline with a message — manager only. */
import { useState } from 'react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { EmptyState } from '@/ui/EmptyState';
import { NoPermission } from '@/ui/NoPermission';
import { CheckCircle2 } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';

export function Approvals({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const reservations = useStore((s) => s.reservations);
  const residents = useStore((s) => s.residents);
  const dispatch = useStore((s) => s.dispatch);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const role = useStore((s) => s.staff[actorId]?.role);
  const pushToast = useUiStore((s) => s.pushToast);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const requests = Object.values(reservations)
    .filter((r) => r.state === 'requested')
    .sort((a, b) => a.start.localeCompare(b.start));

  if (role !== 'fnb_manager') {
    return <NoPermission askWho={t('fnb.manager')} />;
  }
  if (requests.length === 0)
    return <EmptyState icon={CheckCircle2} message={t('fnb.noRequests')} />;

  function decide(reservationId: string, accept: boolean) {
    const result = dispatch(
      accept ? 'dining.approveRequest' : 'dining.declineRequest',
      { reservationId, message: messages[reservationId] },
      { kind: 'staff', id: actorId, role },
    );
    pushToast(
      slot,
      result.ok ? (accept ? t('fnb.accepted') : t('fnb.declined')) : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-3">
      {requests.map((r) => (
        <Card key={r.id} className="flex flex-col gap-2">
          <p className="text-label-1 text-text-title">
            {residents[r.residentId]?.name} · {t('common.people', { count: r.partySize })}
          </p>
          <p className="text-body-2 text-text-muted">
            {t(`dining.venue.${r.venue}`)} · {fmt.dateTime(r.start)}
            {r.occasion ? ` · ${r.occasion}` : ''}
            {r.requests ? ` · “${r.requests}”` : ''}
          </p>
          <Input
            placeholder={t('fnb.messageToResident')}
            value={messages[r.id] ?? ''}
            onChange={(e) => setMessages({ ...messages, [r.id]: e.target.value })}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => decide(r.id, false)}>
              {t('fnb.decline')}
            </Button>
            <Button onClick={() => decide(r.id, true)}>{t('padel.accept')}</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
