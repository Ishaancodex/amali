'use client';

/**
 * Operations home (PRD §8.5/§8.8): Pool/Gym status at a glance with a
 * quick status change, today's lifeguard/attendant coverage gaps, an
 * overdue-water-reading warning, and links into the rest of ops.
 */
import { Tag } from '@/ui/Tag';
import { Card } from '@/ui/Card';
import {
  CircleAlert,
  ClipboardCheck,
  Waves,
  Users,
  Wrench,
  Building2,
  ScrollText,
  CalendarDays,
} from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { selectCurrentStatusEntry } from '@/store/selectors/amenities';
import { findCoverageGaps } from '@/domain/ops/roster';
import { effectiveHoursForDate } from '@/domain/booking/hours';
import { OpsAlerts } from './parts/OpsAlerts';
import { rules } from '@/config/rules';
import { dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import { useAmenityLabel, useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';
import type { AmenityKey, AmenityStatus } from '@/types/amenity';
import { useConsoleActor } from '../useConsoleActor';
import { canOpenRoute } from '@/config/consoleAccess';

const STATUS_OPTIONS: Exclude<AmenityStatus, 'emergency'>[] = [
  'open',
  'limited',
  'closed',
  'maintenance',
];

export function OpsHomeScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const amenityLabel = useAmenityLabel();
  const { push } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const shifts = useStore((s) => s.shifts);
  const staff = useStore((s) => s.staff);
  const hours = useStore((s) => s.hours);
  const exceptions = useStore((s) => s.exceptions);
  const now = useStore((s) => s.demo.clock.now);
  const { actor, consoleRole, assignedAmenities } = useConsoleActor(slot);

  const staffRoleById = new Map(Object.values(staff).map((s) => [s.id, s.role] as const));
  const todayKey = dubaiDateKey(now);
  const poolHours = effectiveHoursForDate(hours, Object.values(exceptions), 'pool', todayKey);
  const poolWindow = poolHours
    ? { start: poolHours.open, end: poolHours.close }
    : { start: now, end: now };
  const gymWindow = {
    start: dubaiDateTimeToIso(todayKey, rules.gym.staffedWindow.open),
    end: dubaiDateTimeToIso(todayKey, rules.gym.staffedWindow.close),
  };
  const poolGaps = findCoverageGaps(
    Object.values(shifts),
    'pool',
    'lifeguard',
    staffRoleById,
    poolWindow.start,
    poolWindow.end,
  );
  const gymGaps = findCoverageGaps(
    Object.values(shifts),
    'gym',
    'gym_attendant',
    staffRoleById,
    gymWindow.start,
    gymWindow.end,
  );

  function setStatus(amenity: AmenityKey, status: Exclude<AmenityStatus, 'emergency'>) {
    if (!actor) return;
    const result = dispatch('amenity.setStatus', { amenity, status }, actor, { assignedAmenities });
    pushToast(
      slot,
      result.ok
        ? t('console.wo.statusSet', {
            amenity: amenityLabel(amenity),
            status: t(`status.${status}`),
          })
        : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  const quickLinks = [
    { route: 'checklist', label: 'console.checklist.title', icon: ClipboardCheck },
    { route: 'water', label: 'console.water.title', icon: Waves },
    { route: 'roster', label: 'console.roster.title', icon: Users },
    { route: 'incidents', label: 'creche.nav.incidents', icon: CircleAlert },
    { route: 'work-orders', label: 'console.wo.title', icon: Wrench },
    { route: 'vendors', label: 'console.vendors.title', icon: Building2 },
    { route: 'blackout', label: 'console.blackout.title', icon: CalendarDays },
    { route: 'audit-log', label: 'console.audit.title', icon: ScrollText },
  ] as const;

  return (
    <div className="flex h-full flex-col">
      <div className="border-border-card border-b px-6 py-4">
        <h1 className="text-title-l text-text-title">{t('console.nav.ops')}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <OpsAlerts slot={slot} />

          <section className="grid grid-cols-2 gap-4">
            {(['pool', 'gym'] as const).map((key) => {
              const entry = selectCurrentStatusEntry({ amenityStatus }, key, now);
              const gaps = key === 'pool' ? poolGaps : gymGaps;
              return (
                <Card key={key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-label-1 text-text-title">{amenityLabel(key)}</span>
                    <Tag
                      variant={
                        entry?.status === 'open' || !entry
                          ? 'success'
                          : entry.status === 'limited'
                            ? 'warning'
                            : 'brand'
                      }
                    >
                      {t(`status.${entry?.status ?? 'open'}`)}
                    </Tag>
                  </div>
                  {entry?.reason && <p className="text-body-3 text-text-muted">{entry.reason}</p>}
                  {gaps.length > 0 && (
                    <p className="text-body-3 text-danger">
                      {t(
                        key === 'pool'
                          ? 'console.ops.noLifeguardGap'
                          : 'console.ops.noAttendantGap',
                        {
                          from: fmt.time(gaps[0]!.start),
                          to: fmt.time(gaps[0]!.end),
                        },
                      )}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(key, s)}
                        className="rounded-tag bg-brand-tint text-brand text-label-3 px-2.5 py-1"
                      >
                        {t(`status.${s}`)}
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </section>

          <section>
            <h2 className="text-label-1 text-text-title mb-2">{t('console.nav.ops')}</h2>
            <div className="grid grid-cols-3 gap-3">
              {quickLinks
                .filter((l) => canOpenRoute(consoleRole, l.route))
                .map((l) => (
                  <button
                    key={l.route}
                    type="button"
                    onClick={() => push(l.route)}
                    className="rounded-card border-border-card bg-surface flex flex-col items-center gap-2 border-[0.5px] px-3 py-4"
                  >
                    <l.icon className="text-brand h-5 w-5" strokeWidth={1.5} />
                    <span className="text-label-3 text-text-body">{t(l.label)}</span>
                  </button>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
