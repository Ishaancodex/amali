'use client';

/**
 * The room board (PRD §6.3, M25): children in the room by age band against
 * the ratio their rostered staff allow, live. A sick carer turns a band red
 * ("Over ratio by 4") and blocks its check-ins until the lead adds cover.
 * Below: the activity line parents see, and anything needing a person —
 * late pickups, collector approvals, the end-of-day sweep.
 */
import { useState } from 'react';
import { EmptyState } from '@/ui/EmptyState';
import { Baby } from '@/ui/icons';
import { useStore } from '@/store';
import { selectBandLoads, selectBoardSession, selectInRoom } from '@/store/selectors/creche';
import { useFmt, useT } from '@/i18n/hooks';
import type { AgeBand } from '@/types/creche';
import type { DeviceSlotId } from '@/types/demo';
import { useCrecheStaff } from '../useCrecheStaff';
import { BandCard } from './parts/BandCard';
import { AddCoverSheet } from './parts/AddCoverSheet';
import { ActivityPicker } from './parts/ActivityPicker';
import { AttentionList } from './parts/AttentionList';

export function RoomBoardScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const { staffMember, isLead } = useCrecheStaff(slot);
  const crecheSessions = useStore((s) => s.crecheSessions);
  const crecheBookings = useStore((s) => s.crecheBookings);
  const bandAssignments = useStore((s) => s.bandAssignments);
  const shifts = useStore((s) => s.shifts);
  const staff = useStore((s) => s.staff);
  const now = useStore((s) => s.demo.clock.now);
  const [coverBand, setCoverBand] = useState<AgeBand | undefined>();

  if (!staffMember) return null;

  const session = selectBoardSession({ crecheSessions }, now);
  const loads = selectBandLoads(
    { crecheSessions, crecheBookings, bandAssignments, shifts },
    session,
  );
  const inRoom = selectInRoom({ crecheBookings });
  const carers = new Set(loads.flatMap((l) => l.staffIds)).size;
  const running = !!session && session.start <= now;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <div>
        <span className="text-tag font-secondary text-brand">{t('amenity.creche.short')}</span>
        <h1 className="text-title-l text-text-title">{staffMember.name}</h1>
        <p className="text-body-3 text-text-muted">
          {session
            ? `${t(`creche.session.${session.kind}`)} · ${fmt.time(session.start)}–${fmt.time(session.end)}${running ? '' : ` ${t('creche.next')}`}`
            : t('creche.noMoreSessions')}
          {' · '}
          {t('kids.children', { count: inRoom.length })} · {t('kids.carers', { count: carers })}
        </p>
      </div>

      {session ? (
        <section className="flex flex-col gap-3">
          {loads.map((load) => (
            <BandCard
              key={load.band}
              load={load}
              staff={staff}
              canAddCover={isLead}
              onAddCover={() => setCoverBand(load.band)}
            />
          ))}
        </section>
      ) : (
        <EmptyState icon={Baby} message={t('creche.closedToday')} />
      )}

      {inRoom.length > 0 && <ActivityPicker slot={slot} inRoom={inRoom} />}

      <AttentionList slot={slot} />

      <AddCoverSheet slot={slot} band={coverBand} onClose={() => setCoverBand(undefined)} />
    </div>
  );
}
