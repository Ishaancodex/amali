import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import '@/scheduler/registerJobs';
import { schedulerEngine } from '@/scheduler/engine';
import { buildSeed } from '@/seed';
import { STAFF_IDS } from '@/seed/personaIds';
import { addDaysIso, addHoursIso, dubaiDateKey } from '@/lib/time';
import { rules } from '@/config/rules';
import { gapAt } from '@/domain/ops/roster';
import { isWaterReadingOverdue } from '@/domain/ops/water';
import { vendorPerformance } from '@/domain/ops/vendorPerformance';
import { selectCurrentStatus } from '@/store/selectors/amenities';
import type { WorkOrder } from '@/types/ops';

const NOW = '2026-10-14T13:30:00.000Z'; // Wed 14 Oct, 17:30 Dubai
const manager = { kind: 'staff' as const, id: STAFF_IDS.cmHana, role: 'community_manager' };

function resetStore(now = NOW): void {
  useStore.setState(buildSeed('amali-2026', now));
  schedulerEngine.queue.clear();
}

describe('isWaterReadingOverdue with an opening time', () => {
  const openAt = '2026-10-15T02:00:00.000Z'; // 06:00 Dubai
  const yesterdayLast = '2026-10-14T16:00:00.000Z'; // 20:00 Dubai

  it("doesn't count overnight against the pool — today's first reading is due at opening", () => {
    expect(isWaterReadingOverdue(yesterdayLast, '2026-10-15T02:20:00.000Z', 2, 30, openAt)).toBe(
      false,
    ); // 06:20
    expect(isWaterReadingOverdue(yesterdayLast, '2026-10-15T02:31:00.000Z', 2, 30, openAt)).toBe(
      true,
    ); // 06:31
  });

  it('with no reading at all, anchors to opening', () => {
    expect(isWaterReadingOverdue(undefined, '2026-10-15T02:31:00.000Z', 2, 30, openAt)).toBe(true);
  });
});

describe('gapAt', () => {
  const gaps = [{ start: '2026-10-14T09:30:00.000Z', end: '2026-10-14T10:00:00.000Z' }];
  it('finds the gap covering an instant, start-inclusive and end-exclusive', () => {
    expect(gapAt(gaps, '2026-10-14T09:30:00.000Z')).toBe(gaps[0]);
    expect(gapAt(gaps, '2026-10-14T10:00:00.000Z')).toBeUndefined();
  });
});

describe('selectCurrentStatus — same-timestamp tie', () => {
  beforeEach(() => resetStore());

  it('the later of two status changes at the same instant wins', () => {
    const { dispatch } = useStore.getState();
    dispatch('amenity.setStatus', { amenity: 'pool', status: 'limited' }, manager);
    dispatch('amenity.setStatus', { amenity: 'pool', status: 'open' }, manager);
    expect(selectCurrentStatus(useStore.getState(), 'pool', NOW)).toBe('open');
  });
});

describe('a lifeguard gap triggers the alert (P6 exit criterion)', () => {
  beforeEach(() => resetStore());

  function rahulTodayShiftId(): string {
    const today = dubaiDateKey(NOW);
    const shift = Object.values(useStore.getState().shifts).find(
      (s) => s.staffId === STAFF_IDS.lifeguardRahul && s.date === today,
    );
    if (!shift) throw new Error("Rahul's shift missing from the seed");
    return shift.id;
  }

  function gapAlerts() {
    return Object.values(useStore.getState().notifications).filter(
      (n) => n.title === 'Pool open with no lifeguard',
    );
  }

  it('marking the on-shift lifeguard sick while the pool is open alerts the supervisor and community manager', () => {
    const result = useStore
      .getState()
      .dispatch('roster.markSick', { shiftId: rahulTodayShiftId() }, manager);
    expect(result.ok).toBe(true);
    const recipients = gapAlerts().map((n) => n.recipientId);
    expect(recipients).toContain(STAFF_IDS.supervisorVictor);
    expect(recipients).toContain(STAFF_IDS.cmHana);
    expect(gapAlerts()[0]?.priority).toBe('high');
  });

  it('raises nothing if the pool is already closed', () => {
    useStore
      .getState()
      .dispatch('amenity.setStatus', { amenity: 'pool', status: 'closed' }, manager);
    useStore.getState().dispatch('roster.markSick', { shiftId: rahulTodayShiftId() }, manager);
    expect(gapAlerts()).toHaveLength(0);
  });

  it('raises nothing for a non-pool shift', () => {
    const today = dubaiDateKey(NOW);
    const leo = Object.values(useStore.getState().shifts).find(
      (s) => s.staffId === STAFF_IDS.gymLeo && s.date === today,
    );
    useStore.getState().dispatch('roster.markSick', { shiftId: leo!.id }, manager);
    expect(
      Object.values(useStore.getState().notifications).filter((n) => n.title.includes('lifeguard')),
    ).toHaveLength(0);
  });
});

describe('work order resolvedAt', () => {
  beforeEach(() => resetStore());

  it('freezes at Resolved, survives Closed, and clears on a failed verification', () => {
    const { dispatch } = useStore.getState();
    const raised = dispatch(
      'incident.raise',
      {
        amenity: 'gym',
        category: 'equipment',
        severity: 'low',
        description: 'treadmill belt',
        raisedVia: 'console',
      },
      manager,
    );
    if (!raised.ok) throw new Error('setup');
    const wo = dispatch(
      'incident.convertToWorkOrder',
      {
        incidentId: raised.value.id,
        priority: 'P3',
        title: 'Fix belt',
        assignee: { kind: 'staff', id: STAFF_IDS.technicianRavi },
      },
      manager,
    );
    if (!wo.ok) throw new Error('setup');
    const woId = wo.value.id;

    dispatch('workOrder.transition', { workOrderId: woId, toState: 'in_progress' }, manager);
    dispatch('workOrder.transition', { workOrderId: woId, toState: 'resolved' }, manager);
    expect(useStore.getState().workOrders[woId]?.sla.resolvedAt).toBe(NOW);

    dispatch(
      'workOrder.transition',
      { workOrderId: woId, toState: 'in_progress', note: 'verification failed' },
      manager,
    );
    expect(useStore.getState().workOrders[woId]?.sla.resolvedAt).toBeUndefined();

    const later = addHoursIso(NOW, 1);
    useStore.setState((s) => {
      s.demo.clock.now = later;
    });
    dispatch('workOrder.transition', { workOrderId: woId, toState: 'resolved' }, manager);
    dispatch(
      'workOrder.transition',
      { workOrderId: woId, toState: 'closed', resolution: { note: 'done' } },
      manager,
      { now: addHoursIso(later, 2) },
    );
    expect(useStore.getState().workOrders[woId]?.sla.resolvedAt).toBe(later);
  });
});

describe('vendorPerformance', () => {
  function wo(
    id: string,
    createdAt: string,
    resolvedAt: string | undefined,
    pausedMs = 0,
  ): WorkOrder {
    return {
      id,
      createdAt,
      updatedAt: resolvedAt ?? createdAt,
      amenity: 'pool',
      title: id,
      priority: 'P1', // 4h resolve
      assignee: { kind: 'vendor', id: 'v1' },
      state: resolvedAt ? 'closed' : 'in_progress',
      sla: {
        respondBy: addHoursIso(createdAt, 0.5),
        resolveBy: addHoursIso(createdAt, 4),
        pausedMs,
        resolvedAt,
      },
      timeline: [],
    };
  }

  it('scores resolutions in the 90-day window, crediting paused time', () => {
    const t = '2026-10-01T06:00:00.000Z';
    const list = [
      wo('in-sla', t, addHoursIso(t, 2)),
      wo('breached', t, addHoursIso(t, 5)),
      wo('paused-ok', t, addHoursIso(t, 5), 2 * 3600 * 1000), // 5h wall clock, 3h active
      wo('unresolved', t, undefined),
      wo('too-old', addDaysIso(NOW, -120), addDaysIso(NOW, -119)),
    ];
    const perf = vendorPerformance(list, 'v1', NOW, rules.ops.slaAtRiskFraction);
    expect(perf.resolvedCount).toBe(3);
    expect(perf.breaches).toBe(1);
    expect(perf.pctWithinSla).toBe(67);
    expect(perf.avgResolveMinutes).toBe(Math.round((120 + 300 + 180) / 3));
  });

  it('is empty for a vendor with nothing resolved', () => {
    expect(vendorPerformance([], 'v1', NOW, rules.ops.slaAtRiskFraction)).toEqual({
      resolvedCount: 0,
      breaches: 0,
    });
  });
});

describe('seeded water readings', () => {
  it('cover 7 days up to now, every 2h while open, with one deliberate pH excursion', () => {
    const state = buildSeed('amali-2026', NOW);
    const readings = Object.values(state.waterReadings);
    expect(readings.every((r) => r.at <= NOW && r.at >= addDaysIso(NOW, -7))).toBe(true);
    expect(readings.filter((r) => r.outOfRange.length > 0)).toHaveLength(1);
    expect(new Set(readings.map((r) => dubaiDateKey(r.at))).size).toBe(7);
    // 6 closed days × 8 readings (06:00-20:00) + today up to 17:30 (06:00-16:00 → 6).
    expect(readings).toHaveLength(6 * 8 + 6);
  });

  it('is deterministic under (seed, now)', () => {
    expect(buildSeed('amali-2026', NOW).waterReadings).toEqual(
      buildSeed('amali-2026', NOW).waterReadings,
    );
  });
});
