'use client';

/**
 * "Add cover from the roster (available staff list)" (PRD §8.3): creche
 * staff on a creche shift today who aren't off sick and aren't already on
 * this band. Picking one moves them onto it (and off any other band).
 */
import { Sheet } from '@/ui/Sheet';
import { Card } from '@/ui/Card';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { BAND_LABEL } from '@/domain/creche/bands';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { dubaiDateKey, fmtTime } from '@/lib/time';
import type { AgeBand } from '@/types/creche';
import type { DeviceSlotId } from '@/types/demo';
import { useCrecheStaff } from '../../useCrecheStaff';

export function AddCoverSheet({
  slot,
  band,
  onClose,
}: {
  slot: DeviceSlotId;
  band: AgeBand | undefined;
  onClose: () => void;
}) {
  const { actor } = useCrecheStaff(slot);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const shifts = useStore((s) => s.shifts);
  const staff = useStore((s) => s.staff);
  const bandAssignments = useStore((s) => s.bandAssignments);
  const now = useStore((s) => s.demo.clock.now);

  const today = dubaiDateKey(now);
  const onBand = new Set(
    bandAssignments.find((a) => a.date === today && a.band === band)?.staffIds ?? [],
  );
  const available = Object.values(shifts).filter(
    (s) =>
      s.amenity === 'creche' &&
      s.date === today &&
      s.state === 'scheduled' &&
      s.end > now &&
      !onBand.has(s.staffId),
  );
  const currentBand = (staffId: string) =>
    bandAssignments.find((a) => a.date === today && a.staffIds.includes(staffId))?.band;

  function cover(staffId: string) {
    if (!actor || !band) return;
    const result = dispatch('creche.addCover', { band, staffId }, actor);
    pushToast(
      slot,
      result.ok ? `${staff[staffId]?.name} now covers ${BAND_LABEL[band]}.` : result.error.message,
      result.ok ? 'success' : 'error',
    );
    if (result.ok) onClose();
  }

  return (
    <Sheet open={!!band} onClose={onClose} title={band ? `Cover ${BAND_LABEL[band]}` : undefined}>
      {available.length === 0 ? (
        <p className="text-body-2 text-text-muted pb-4">
          No other creche staff on shift. Stop new check-ins until cover arrives.
        </p>
      ) : (
        <div className="flex flex-col gap-2 pb-2">
          {available.map((shift) => {
            const from = currentBand(shift.staffId);
            return (
              <button
                key={shift.id}
                type="button"
                onClick={() => cover(shift.staffId)}
                className="text-start"
              >
                <Card className="flex items-center gap-3">
                  <ChildAvatar initials={staff[shift.staffId]?.avatar ?? '?'} />
                  <div className="min-w-0 flex-1">
                    <p className="text-label-2 text-text-title">
                      {staff[shift.staffId]?.name}
                      {staff[shift.staffId]?.role === 'creche_lead' ? ' (Lead)' : ''}
                    </p>
                    <p className="text-body-3 text-text-muted">
                      On shift {fmtTime(shift.start)}–{fmtTime(shift.end)}
                      {from ? ` · moves off ${BAND_LABEL[from]}` : ' · floating'}
                    </p>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
