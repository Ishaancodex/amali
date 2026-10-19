'use client';

/**
 * Log an incident (PRD §8.3): child, type, severity, description, witness,
 * first aid. Medium/High reach the parent immediately; Low at check-out.
 * A Facility incident needs no child and can become a work order from the
 * console's Incidents screen.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { cn } from '@/lib/cn';
import type { CrecheIncidentType } from '@/types/creche';
import type { IncidentSeverity } from '@/types/ops';
import type { DeviceSlotId } from '@/types/demo';
import { useCrecheStaff } from '../useCrecheStaff';
import { INCIDENT_TYPE_LABEL } from './parts/incidentTypes';

const SEVERITIES: IncidentSeverity[] = ['low', 'medium', 'high'];

/** "Omar Al Mansoori" → "Omar A." — first names alone can repeat in the room. */
function shortName(name: string): string {
  const [first, ...rest] = name.split(' ');
  return rest.length > 0 ? `${first} ${rest[0]![0]}.` : (first ?? '');
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-tag text-label-3 px-3 py-1.5 capitalize',
        active ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
      )}
    >
      {children}
    </button>
  );
}

export function LogIncidentScreen({
  slot,
  childId: initialChild,
}: {
  slot: DeviceSlotId;
  childId?: string;
}) {
  const { pop } = useNav(slot);
  const { actor } = useCrecheStaff(slot);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const crecheBookings = useStore((s) => s.crecheBookings);
  const children = useStore((s) => s.children);
  const staff = useStore((s) => s.staff);

  const [childId, setChildId] = useState(initialChild ?? '');
  const [type, setType] = useState<CrecheIncidentType>('minor_injury');
  const [severity, setSeverity] = useState<IncidentSeverity>('low');
  const [description, setDescription] = useState('');
  const [witnessId, setWitnessId] = useState('');
  const [firstAid, setFirstAid] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const inRoom = Object.values(crecheBookings).filter((b) => b.state === 'checked_in');
  const colleagues = Object.values(staff).filter(
    (s) => s.assignedAmenities?.includes('creche') && s.id !== actor?.id,
  );
  const needsChild = type !== 'facility';

  function submit() {
    if (!actor) return;
    const result = dispatch(
      'creche.logIncident',
      {
        childId: childId || undefined,
        type,
        severity,
        description,
        witnessId: witnessId || undefined,
        firstAid,
      },
      actor,
    );
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    pushToast(
      slot,
      severity === 'low'
        ? 'Logged. The parent sees it at check-out.'
        : 'Logged. The parent has been notified.',
      'success',
    );
    pop();
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Log incident" onBack={pop} />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-6 [&>*]:shrink-0">
        <section className="flex flex-col gap-2 pt-2">
          <h2 className="text-label-1 text-text-title">Type</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(INCIDENT_TYPE_LABEL) as CrecheIncidentType[]).map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>
                {INCIDENT_TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-label-1 text-text-title">Child{needsChild ? '' : ' (optional)'}</h2>
          {inRoom.length === 0 ? (
            <p className="text-body-3 text-text-muted">No children in the room.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {inRoom.map((b) => (
                <Chip
                  key={b.id}
                  active={childId === b.childId}
                  onClick={() => setChildId(childId === b.childId ? '' : b.childId)}
                >
                  {shortName(children[b.childId]?.name ?? '')}
                </Chip>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-label-1 text-text-title">Severity</h2>
          <div className="flex gap-2">
            {SEVERITIES.map((s) => (
              <Chip key={s} active={severity === s} onClick={() => setSeverity(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-1.5">
          <label className="text-label-3 text-text-muted" htmlFor="incident-description">
            What happened
          </label>
          <textarea
            id="incident-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded-input border-border-card bg-surface text-body-2 text-text-body placeholder:text-text-placeholder border px-3 py-2.5"
            placeholder="e.g. Minor scrape on the knee, plaster applied."
          />
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-label-1 text-text-title">Staff witness</h2>
          <div className="flex flex-wrap gap-2">
            {colleagues.map((c) => (
              <Chip
                key={c.id}
                active={witnessId === c.id}
                onClick={() => setWitnessId(witnessId === c.id ? '' : c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </section>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={firstAid}
            onChange={(e) => setFirstAid(e.target.checked)}
            className="accent-brand h-5 w-5"
          />
          <span className="text-label-2 text-text-title">First aid given</span>
        </label>

        {error && <Banner style="urgent">{error}</Banner>}
        <Button
          fullWidth
          disabled={!description.trim() || (needsChild && !childId)}
          onClick={submit}
        >
          Log incident
        </Button>
      </div>
    </div>
  );
}
