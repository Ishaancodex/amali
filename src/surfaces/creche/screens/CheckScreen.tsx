'use client';

/**
 * Check-in / check-out (PRD §8.3 steps 1-5): scan the guardian's drop-off
 * pass or search for the child, then the child's card handles the rest.
 */
import { useState } from 'react';
import { Input } from '@/ui/Input';
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { QrCode, Search } from '@/ui/icons';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { useT } from '@/i18n/hooks';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { selectBoardSession } from '@/store/selectors/creche';
import type { DeviceSlotId } from '@/types/demo';
import { ScanSheet } from './parts/ScanSheet';
import { ChildCheckCard } from './parts/ChildCheckCard';

const STATE_TONE = {
  confirmed: 'brand',
  waitlisted: 'warning',
  checked_in: 'success',
  checked_out: 'info',
  cancelled: 'danger',
  no_show: 'danger',
} as const;

export function CheckScreen({
  slot,
  childId,
  guardianId,
}: {
  slot: DeviceSlotId;
  childId?: string;
  /** Set when the child was reached by scanning a guardian's pass. */
  guardianId?: string;
}) {
  const t = useT();
  const { replace } = useNav(slot);
  const children = useStore((s) => s.children);
  const crecheBookings = useStore((s) => s.crecheBookings);
  const crecheSessions = useStore((s) => s.crecheSessions);
  const now = useStore((s) => s.demo.clock.now);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);

  if (childId && children[childId]) {
    return (
      <ChildCheckCard
        slot={slot}
        childId={childId}
        initialGuardianId={guardianId}
        onBack={() => replace('check')}
      />
    );
  }

  const session = selectBoardSession({ crecheSessions }, now);
  const todays = Object.values(crecheBookings).filter(
    (b) => b.state === 'checked_in' || (session && b.sessionId === session.id),
  );
  const q = query.trim().toLowerCase();
  const list = q
    ? Object.values(children)
        .filter((c) => c.name.toLowerCase().includes(q))
        .map((c) => ({ child: c, booking: todays.find((b) => b.childId === c.id) }))
    : todays
        .map((b) => ({ child: children[b.childId]!, booking: b }))
        .filter((r) => r.child)
        .sort((a, b) => a.child.name.localeCompare(b.child.name));

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <h1 className="text-title-l text-text-title">{t('creche.checkTitle')}</h1>
      <Button fullWidth onClick={() => setScanning(true)}>
        <QrCode className="me-2 inline h-4 w-4" strokeWidth={1.5} />
        {t('creche.scanPass')}
      </Button>
      <Input
        placeholder={t('creche.searchChild')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={Search}
          message={q ? t('creche.noChildByName') : t('creche.noneExpected')}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map(({ child, booking }) => (
            <button
              key={child.id}
              type="button"
              className="text-start"
              onClick={() => replace('check', { child: child.id })}
            >
              <Card className="flex items-center gap-3">
                <ChildAvatar initials={child.photo} />
                <div className="min-w-0 flex-1">
                  <p className="text-label-2 text-text-title">{child.name}</p>
                  <p className="text-body-3 text-text-muted">
                    {booking ? t(`kids.band.${booking.band}`) : t('creche.noBookingNow')}
                    {child.allergies && (
                      <span className={child.allergies.severe ? 'text-danger' : ''}>
                        {' · '}
                        {t('creche.allergy')}
                      </span>
                    )}
                  </p>
                </div>
                {booking && (
                  <Tag variant={STATE_TONE[booking.state]}>
                    {t(`creche.state.${booking.state}`)}
                  </Tag>
                )}
              </Card>
            </button>
          ))}
        </div>
      )}
      <ScanSheet
        open={scanning}
        onClose={() => setScanning(false)}
        onScan={(scannedGuardianId, scannedChildId) => {
          setScanning(false);
          replace('check', { child: scannedChildId, guardian: scannedGuardianId });
        }}
      />
    </div>
  );
}
