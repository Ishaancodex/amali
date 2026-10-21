'use client';

/** The report request (PRD §8.10): types, date range (30 / 90 days or custom), amenities, towers. */
import { useState } from 'react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { useStore } from '@/store';
import { rules } from '@/config/rules';
import { REPORT_SECTIONS, type ReportRequest, type ReportSection } from '@/store/selectors/report';
import { addDaysIso, dubaiDateKey } from '@/lib/time';
import { cn } from '@/lib/cn';
import type { AmenityKey } from '@/types/amenity';
import type { Tower } from '@/types/community';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../../useConsoleActor';
import { grantFor } from '@/domain/rbac/can';

const SECTION_LABEL: Record<ReportSection, string> = {
  utilisation: 'Utilisation & occupancy',
  peak: 'Peak times',
  noshow: 'No-shows',
  trends: 'Booking trends',
  revenue: 'Revenue',
  comms: 'Communication reach',
  ops: 'Ops & SLAs',
};
const AMENITY_LABEL: Record<string, string> = {
  padel: 'Padel',
  screening: 'Screening',
  music: 'Music',
  dining: 'Restaurant',
  pool: 'Pool',
  gym: 'Gym',
  creche: 'Kids’ Club',
};
const TOWERS: { key: Tower; label: string }[] = [
  { key: 'east', label: 'East' },
  { key: 'west', label: 'West' },
];

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
        'rounded-tag text-label-3 px-3 py-1.5',
        active ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
      )}
    >
      {children}
    </button>
  );
}

const toggle = <T,>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export function ReportForm({
  slot,
  amenities,
  onGenerate,
  busy,
}: {
  slot: DeviceSlotId;
  amenities: AmenityKey[];
  onGenerate: (r: ReportRequest) => void;
  busy: boolean;
}) {
  const now = useStore((s) => s.demo.clock.now);
  const { consoleRole } = useConsoleActor(slot);
  const revenueAllowed = !!consoleRole && grantFor(consoleRole, 'revenue.view')?.scope === 'all';
  const sectionsAllowed = REPORT_SECTIONS.filter((x) => x !== 'revenue' || revenueAllowed);
  const yesterday = dubaiDateKey(addDaysIso(now, -1));
  const [sections, setSections] = useState<ReportSection[]>([...sectionsAllowed]);
  const [days, setDays] = useState<number | 'custom'>(30);
  const [from, setFrom] = useState(dubaiDateKey(addDaysIso(now, -30)));
  const [to, setTo] = useState(yesterday);
  const [chosen, setChosen] = useState<AmenityKey[]>(amenities);
  const [towers, setTowers] = useState<Tower[]>([]);

  const range =
    days === 'custom'
      ? { from, to }
      : { from: dubaiDateKey(addDaysIso(now, -days)), to: yesterday };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sectionsAllowed.map((x) => (
          <Chip
            key={x}
            active={sections.includes(x)}
            onClick={() => setSections(toggle(sections, x))}
          >
            {SECTION_LABEL[x]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {rules.reports.rangePresetsDays.map((d) => (
          <Chip key={d} active={days === d} onClick={() => setDays(d)}>
            Last {d} days
          </Chip>
        ))}
        <Chip active={days === 'custom'} onClick={() => setDays('custom')}>
          Custom
        </Chip>
        {days === 'custom' && (
          <>
            <Input
              type="date"
              label="From"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {amenities.map((a) => (
          <Chip key={a} active={chosen.includes(a)} onClick={() => setChosen(toggle(chosen, a))}>
            {AMENITY_LABEL[a] ?? a}
          </Chip>
        ))}
        <span className="border-border-card mx-1 border-s" />
        {TOWERS.map((t) => (
          <Chip
            key={t.key}
            active={towers.includes(t.key)}
            onClick={() => setTowers(toggle(towers, t.key))}
          >
            {t.label} tower
          </Chip>
        ))}
        <span className="text-body-3 text-text-muted self-center">
          {towers.length ? '' : 'All towers'}
        </span>
      </div>
      <Button
        disabled={busy || chosen.length === 0 || sections.length === 0 || range.from > range.to}
        onClick={() => onGenerate({ ...range, amenities: chosen, towers, sections })}
      >
        {busy ? 'Generating…' : 'Generate report'}
      </Button>
    </Card>
  );
}
