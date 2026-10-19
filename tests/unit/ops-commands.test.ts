import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import '@/scheduler/registerJobs';
import { schedulerEngine } from '@/scheduler/engine';
import { buildSeed } from '@/seed';
import { STAFF_IDS } from '@/seed/personaIds';
import { addMinutesIso, addHoursIso, dubaiDateKey } from '@/lib/time';
import { findCoverageGaps } from '@/domain/ops/roster';

const NOW = '2026-10-14T13:30:00.000Z'; // Wed 14 Oct, 17:30 Dubai

function resetStore(now = NOW): void {
  useStore.setState(buildSeed('amali-2026', now));
  schedulerEngine.queue.clear();
}

const manager = { kind: 'staff' as const, id: STAFF_IDS.cmHana, role: 'community_manager' };
const supervisor = {
  kind: 'staff' as const,
  id: STAFF_IDS.supervisorVictor,
  role: 'amenity_supervisor',
};
const callCentre = { kind: 'staff' as const, id: STAFF_IDS.agentDina, role: 'call_centre' };
const guard = { kind: 'staff' as const, id: STAFF_IDS.lifeguardSam, role: 'lifeguard' };
const supervisorOpts = {
  assignedAmenities: ['pool', 'gym', 'padel'] as ('pool' | 'gym' | 'padel')[],
};

function aquapureVendor() {
  const vendor = Object.values(useStore.getState().vendors).find(
    (v) => v.name === 'AquaPure Pools LLC',
  );
  if (!vendor) throw new Error('AquaPure vendor missing from seed');
  return vendor;
}

describe('amenity status/hours', () => {
  beforeEach(() => resetStore());

  it('sets a non-emergency status and it becomes current', () => {
    const result = useStore
      .getState()
      .dispatch(
        'amenity.setStatus',
        { amenity: 'pool', status: 'limited', reason: 'lanes closed' },
        supervisor,
        supervisorOpts,
      );
    expect(result.ok).toBe(true);
    const current = useStore.getState().amenityStatus.filter((e) => e.amenity === 'pool');
    expect(current.some((e) => e.status === 'limited' && e.reason === 'lanes closed')).toBe(true);
  });

  it('edits weekly hours for a day, replacing any existing entry', () => {
    const result = useStore
      .getState()
      .dispatch(
        'amenity.setHours',
        { amenity: 'pool', day: 3, open: '07:00', close: '21:00' },
        manager,
      );
    expect(result.ok).toBe(true);
    const entries = useStore.getState().hours.filter((h) => h.amenity === 'pool' && h.day === 3);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.open).toBe('07:00');
  });

  it('adds a date exception', () => {
    const result = useStore
      .getState()
      .dispatch(
        'amenity.addException',
        {
          amenity: 'pool',
          date: '2026-12-25',
          label: 'Holiday hours',
          open: '08:00',
          close: '20:00',
        },
        manager,
      );
    expect(result.ok).toBe(true);
  });

  it('a call-centre agent cannot change amenity status', () => {
    const result = useStore
      .getState()
      .dispatch('amenity.setStatus', { amenity: 'pool', status: 'closed' }, callCentre);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_PERMISSION');
  });
});

describe('checklist.submit', () => {
  beforeEach(() => resetStore());

  function poolOpeningTemplateId(): string {
    const t = Object.values(useStore.getState().checklistTemplates).find(
      (x) => x.amenity === 'pool' && x.kind === 'opening',
    );
    if (!t) throw new Error('pool opening template missing');
    return t.id;
  }

  it('submits on time and marks it not late', () => {
    resetStore('2026-10-14T01:00:00.000Z'); // 05:00 Dubai, before the 05:45 due time
    const templateId = poolOpeningTemplateId();
    const result = useStore
      .getState()
      .dispatch(
        'checklist.submit',
        { templateId, items: [{ itemId: 'item-0', result: 'pass' }] },
        manager,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.late).toBe(false);
  });

  it('submits late and flags it', () => {
    resetStore('2026-10-14T02:10:00.000Z'); // 06:10 Dubai, after the 05:45 due time
    const templateId = poolOpeningTemplateId();
    const result = useStore
      .getState()
      .dispatch(
        'checklist.submit',
        { templateId, items: [{ itemId: 'item-0', result: 'fail', note: 'towels short' }] },
        manager,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.late).toBe(true);
  });
});

describe('cleaning.log', () => {
  beforeEach(() => resetStore());

  it('logs a cleaning entry with the next-due time computed', () => {
    const result = useStore
      .getState()
      .dispatch('cleaning.log', { zone: 'Pool deck', nextDueHours: 2 }, manager);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nextDue).toBe(addHoursIso(NOW, 2));
  });
});

describe('water.log', () => {
  beforeEach(() => resetStore());

  it('an out-of-range reading, with both flags set, sets the pool to limited and raises an incident', () => {
    const result = useStore
      .getState()
      .dispatch(
        'water.log',
        {
          ph: 8.1,
          freeChlorine: 2.0,
          tempC: 27,
          clarity: 'pass',
          setStatusIfOutOfRange: 'limited',
          raiseIncidentIfOutOfRange: true,
        },
        supervisor,
        supervisorOpts,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reading.outOfRange).toEqual(['ph']);
    expect(result.value.statusEntry?.status).toBe('limited');
    expect(result.value.incident?.category).toBe('water_quality');

    const poolStatus = useStore.getState().amenityStatus.filter((e) => e.amenity === 'pool');
    expect(
      poolStatus.some((e) => e.status === 'limited' && e.reason === 'Water balancing in progress'),
    ).toBe(true);
  });

  it('a clean reading changes nothing besides logging it', () => {
    const result = useStore
      .getState()
      .dispatch(
        'water.log',
        {
          ph: 7.4,
          freeChlorine: 2.0,
          tempC: 27,
          clarity: 'pass',
          setStatusIfOutOfRange: 'limited',
          raiseIncidentIfOutOfRange: true,
        },
        supervisor,
        supervisorOpts,
      );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reading.outOfRange).toEqual([]);
    expect(result.value.statusEntry).toBeUndefined();
    expect(result.value.incident).toBeUndefined();
  });

  it('does not raise a second incident within the duplicate window', () => {
    useStore
      .getState()
      .dispatch(
        'water.log',
        { ph: 8.1, freeChlorine: 2.0, tempC: 27, clarity: 'pass', raiseIncidentIfOutOfRange: true },
        supervisor,
        supervisorOpts,
      );
    const second = useStore
      .getState()
      .dispatch(
        'water.log',
        { ph: 8.2, freeChlorine: 2.0, tempC: 27, clarity: 'pass', raiseIncidentIfOutOfRange: true },
        supervisor,
        supervisorOpts,
      );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.incident).toBeUndefined();
    const incidents = Object.values(useStore.getState().incidents).filter(
      (i) => i.category === 'water_quality',
    );
    expect(incidents).toHaveLength(1);
  });
});

describe('occupancy.adjust', () => {
  beforeEach(() => resetStore());

  it('increments and decrements, never below 0, with no capability required', () => {
    useStore.getState().dispatch('occupancy.adjust', { amenity: 'pool', delta: 1 }, guard);
    useStore.getState().dispatch('occupancy.adjust', { amenity: 'pool', delta: 1 }, guard);
    const down = useStore
      .getState()
      .dispatch('occupancy.adjust', { amenity: 'pool', delta: -5 }, guard);
    expect(down.ok).toBe(true);
    if (!down.ok) return;
    expect(down.value).toBe(0);
  });
});

describe('incidents and work orders — the S6 flow', () => {
  beforeEach(() => resetStore());

  it('raises an incident, converts it to a P2 work order assigned to AquaPure, and computes the SLA window', () => {
    const raised = useStore
      .getState()
      .dispatch(
        'incident.raise',
        {
          amenity: 'pool',
          category: 'water_quality',
          severity: 'medium',
          description: 'pH 8.1',
          raisedVia: 'checklist',
        },
        supervisor,
      );
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;

    const vendor = aquapureVendor();
    const converted = useStore
      .getState()
      .dispatch(
        'incident.convertToWorkOrder',
        {
          incidentId: raised.value.id,
          priority: 'P2',
          title: 'Rebalance pool chemicals',
          assignee: { kind: 'vendor', id: vendor.id },
        },
        supervisor,
        supervisorOpts,
      );
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    expect(converted.value.state).toBe('assigned');
    expect(converted.value.sla.respondBy).toBe(addHoursIso(NOW, 2)); // P2 respond: 2h
    expect(converted.value.sla.resolveBy).toBe(addHoursIso(NOW, 24)); // P2 resolve: 24h

    // Transition through the lifecycle, including the simulated "Vendor update".
    const wo1 = useStore
      .getState()
      .dispatch(
        'workOrder.transition',
        { workOrderId: converted.value.id, toState: 'in_progress' },
        supervisor,
        supervisorOpts,
      );
    expect(wo1.ok).toBe(true);

    const vendorUpdate = useStore
      .getState()
      .dispatch(
        'workOrder.transition',
        {
          workOrderId: converted.value.id,
          toState: 'resolved',
          note: 'AquaPure: chemical levels rebalanced',
        },
        supervisor,
        supervisorOpts,
      );
    expect(vendorUpdate.ok).toBe(true);
    if (!vendorUpdate.ok) return;
    expect(vendorUpdate.value.timeline.some((t) => t.text?.includes('AquaPure'))).toBe(true);

    const closedNoNote = useStore
      .getState()
      .dispatch(
        'workOrder.transition',
        { workOrderId: converted.value.id, toState: 'closed' },
        supervisor,
        supervisorOpts,
      );
    expect(closedNoNote.ok).toBe(false);

    const closed = useStore
      .getState()
      .dispatch(
        'workOrder.transition',
        {
          workOrderId: converted.value.id,
          toState: 'closed',
          resolution: { note: 'Verified pH back to 7.4', costFils: 35000 },
        },
        supervisor,
        supervisorOpts,
      );
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.state).toBe('closed');
    expect(closed.value.resolution?.costFils).toBe(35000);
  });

  it('a duplicate incident (same amenity+category within 2h) is flagged but still created', () => {
    useStore
      .getState()
      .dispatch(
        'incident.raise',
        {
          amenity: 'pool',
          category: 'water_quality',
          severity: 'low',
          description: 'first',
          raisedVia: 'guard',
        },
        guard,
      );
    const second = useStore
      .getState()
      .dispatch(
        'incident.raise',
        {
          amenity: 'pool',
          category: 'water_quality',
          severity: 'low',
          description: 'second',
          raisedVia: 'guard',
        },
        guard,
      );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.duplicateOf).toBeDefined();
  });

  it('rejects an invalid state transition', () => {
    const raised = useStore
      .getState()
      .dispatch(
        'incident.raise',
        {
          amenity: 'padel',
          category: 'equipment',
          severity: 'low',
          description: 'net torn',
          raisedVia: 'guard',
        },
        guard,
      );
    if (!raised.ok) throw new Error('setup failed');
    const converted = useStore
      .getState()
      .dispatch(
        'incident.convertToWorkOrder',
        {
          incidentId: raised.value.id,
          priority: 'P3',
          title: 'Replace net',
          assignee: { kind: 'staff', id: STAFF_IDS.technicianRavi },
        },
        manager,
      );
    if (!converted.ok) throw new Error('setup failed');
    const badTransition = useStore
      .getState()
      .dispatch(
        'workOrder.transition',
        { workOrderId: converted.value.id, toState: 'closed' },
        manager,
      );
    expect(badTransition.ok).toBe(false);
    if (badTransition.ok) return;
    expect(badTransition.error.code).toBe('INVALID_TRANSITION');
  });

  it('a pause and resume credits paused time to the SLA clock', () => {
    const raised = useStore
      .getState()
      .dispatch(
        'incident.raise',
        {
          amenity: 'pool',
          category: 'equipment',
          severity: 'high',
          description: 'filter down',
          raisedVia: 'guard',
        },
        guard,
      );
    if (!raised.ok) throw new Error('setup failed');
    const converted = useStore
      .getState()
      .dispatch(
        'incident.convertToWorkOrder',
        {
          incidentId: raised.value.id,
          priority: 'P1',
          title: 'Fix filter',
          assignee: { kind: 'staff', id: STAFF_IDS.technicianRavi },
        },
        manager,
      );
    if (!converted.ok) throw new Error('setup failed');
    const woId = converted.value.id;

    useStore
      .getState()
      .dispatch('workOrder.transition', { workOrderId: woId, toState: 'in_progress' }, manager);
    useStore
      .getState()
      .dispatch(
        'workOrder.transition',
        { workOrderId: woId, toState: 'on_hold', note: 'awaiting part' },
        manager,
      );
    expect(useStore.getState().workOrders[woId]?.sla.pausedSince).toBeDefined();

    useStore.setState((s) => {
      s.demo.clock.now = addHoursIso(NOW, 2); // 2h paused
    });
    useStore
      .getState()
      .dispatch('workOrder.transition', { workOrderId: woId, toState: 'in_progress' }, manager, {
        now: addHoursIso(NOW, 2),
      });
    const wo = useStore.getState().workOrders[woId];
    expect(wo?.sla.pausedSince).toBeUndefined();
    expect(wo?.sla.pausedMs).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 1000);
  });
});

describe('roster', () => {
  beforeEach(() => resetStore());

  it('upserts and edits a shift, and marks one sick', () => {
    const created = useStore
      .getState()
      .dispatch(
        'roster.upsertShift',
        {
          staffId: STAFF_IDS.lifeguardSam,
          date: '2026-10-20',
          start: '2026-10-20T02:00:00.000Z',
          end: '2026-10-20T10:00:00.000Z',
          amenity: 'pool',
        },
        manager,
      );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const sick = useStore
      .getState()
      .dispatch('roster.markSick', { shiftId: created.value.id }, manager);
    expect(sick.ok).toBe(true);
    if (!sick.ok) return;
    expect(sick.value.state).toBe('sick');
  });

  it('assigns a band roster entry, replacing any existing one for that date+band', () => {
    const first = useStore
      .getState()
      .dispatch(
        'roster.assignBand',
        { date: '2026-10-20', band: 'kids', staffIds: [STAFF_IDS.crecheGrace] },
        manager,
      );
    expect(first.ok).toBe(true);
    const second = useStore
      .getState()
      .dispatch(
        'roster.assignBand',
        {
          date: '2026-10-20',
          band: 'kids',
          staffIds: [STAFF_IDS.crecheGrace, STAFF_IDS.crecheMaria],
        },
        manager,
      );
    expect(second.ok).toBe(true);
    const entries = useStore
      .getState()
      .bandAssignments.filter((b) => b.date === '2026-10-20' && b.band === 'kids');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.staffIds).toHaveLength(2);
  });

  it("the seeded week has a real lifeguard coverage gap (PRD §8.5's own example)", () => {
    const shifts = Object.values(useStore.getState().shifts);
    const staff = useStore.getState().staff;
    const staffRoleById = new Map(Object.values(staff).map((s) => [s.id, s.role] as const));
    const todayKey = dubaiDateKey(NOW);
    const windowStart = `${todayKey}T02:00:00.000Z`; // 06:00 Dubai
    const windowEnd = `${todayKey}T18:00:00.000Z`; // 22:00 Dubai
    const gaps = findCoverageGaps(
      shifts,
      'pool',
      'lifeguard',
      staffRoleById,
      windowStart,
      windowEnd,
    );
    expect(gaps.length).toBeGreaterThan(0);
  });
});

describe('ops.slaSweep', () => {
  beforeEach(() => resetStore());

  it('notifies the community manager once a work order breaches, and only once', () => {
    const raised = useStore
      .getState()
      .dispatch(
        'incident.raise',
        {
          amenity: 'pool',
          category: 'equipment',
          severity: 'high',
          description: 'pump failed',
          raisedVia: 'guard',
        },
        guard,
      );
    if (!raised.ok) throw new Error('setup failed');
    const converted = useStore
      .getState()
      .dispatch(
        'incident.convertToWorkOrder',
        {
          incidentId: raised.value.id,
          priority: 'P1',
          title: 'Fix pump',
          assignee: { kind: 'staff', id: STAFF_IDS.technicianRavi },
        },
        manager,
      ); // P1 resolve: 4h
    if (!converted.ok) throw new Error('setup failed');

    const past = addHoursIso(NOW, 5); // past the 4h resolve deadline
    useStore.setState((s) => {
      s.demo.clock.now = past;
    });
    schedulerEngine.runDue(past);

    const notifs = Object.values(useStore.getState().notifications).filter(
      (n) => n.recipientId === STAFF_IDS.cmHana && n.title === 'SLA breached',
    );
    expect(notifs).toHaveLength(1);

    // Running due jobs again shouldn't duplicate the notification.
    schedulerEngine.runDue(addMinutesIso(past, 16));
    const notifsAfter = Object.values(useStore.getState().notifications).filter(
      (n) => n.recipientId === STAFF_IDS.cmHana && n.title === 'SLA breached',
    );
    expect(notifsAfter).toHaveLength(1);
  });
});
