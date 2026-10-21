/**
 * S6 — Pool & Gym: one operational day (PRD §15, C3/C5).
 */
import { PERSONA_IDS, STAFF_IDS } from '@/seed/personaIds';
import { selectCurrentStatusEntry } from '@/store/selectors/amenities';
import { resolveSlaState } from '@/domain/ops/sla';
import { rules } from '@/config/rules';
import { addHoursIso } from '@/lib/time';
import type { AppState } from '@/store/types';
import type { Scenario } from './types';

const SUPERVISOR = {
  kind: 'staff' as const,
  id: STAFF_IDS.supervisorVictor,
  role: 'amenity_supervisor',
};
const SUPERVISOR_AMENITIES: ('pool' | 'gym' | 'padel')[] = ['pool', 'gym', 'padel'];
const LIFEGUARD = { kind: 'staff' as const, id: STAFF_IDS.lifeguardSam, role: 'lifeguard' };

const START = '2026-10-15T02:10:00.000Z'; // Thu 15 Oct, 06:10 Dubai — 25 min after the opening checklist was due
const VENDOR_UPDATE_AT = '2026-10-15T09:00:00.000Z'; // 13:00 Dubai

const POOL_OPENING_TEMPLATE = 'checklist_pool_opening';
const WATER_INCIDENT_CATEGORY = 'water_quality';

function waterIncident(s: AppState) {
  const incident = Object.values(s.incidents).find(
    (i) => i.amenity === 'pool' && i.category === WATER_INCIDENT_CATEGORY,
  );
  if (!incident) throw new Error('Expected a pool water-quality incident');
  return incident;
}

function waterWorkOrder(s: AppState) {
  const workOrderId = waterIncident(s).workOrderId;
  const workOrder = workOrderId ? s.workOrders[workOrderId] : undefined;
  if (!workOrder) throw new Error('Expected the water incident to have a work order');
  return workOrder;
}

function aquapureId(s: AppState): string {
  const vendor = Object.values(s.vendors).find((v) => v.name === 'AquaPure Pools LLC');
  if (!vendor) throw new Error('AquaPure missing from the seed');
  return vendor.id;
}

export const s6PoolGym: Scenario = {
  id: 'S6',
  title: 'Pool & Gym: one operational day',
  capability: ['C3', 'C5'],
  startAt: START,

  steps: [
    {
      title:
        'Opening checklist, then a pH 8.1 water reading — "Set to Limited and raise incident?"',
      body: 'Supervisor ticks the pool opening checklist (done 06:10 against a 05:45 due time, so it shows amber), then logs pH 8.1. It turns red as it is typed; choose Yes to set the pool to Limited and raise an incident in one step.',
      setup: {
        devices: {
          A: {
            role: 'console',
            actorId: STAFF_IDS.supervisorVictor,
            consoleRole: 'amenity_supervisor',
            deepLink: 'amali://console/checklist',
          },
        },
      },
      script: [
        {
          command: 'checklist.submit',
          input: (s: AppState) => ({
            templateId: POOL_OPENING_TEMPLATE,
            items: (s.checklistTemplates[POOL_OPENING_TEMPLATE]?.items ?? []).map((item) => ({
              itemId: item.id,
              result: 'pass',
            })),
          }),
          actor: SUPERVISOR,
          assignedAmenities: SUPERVISOR_AMENITIES,
        },
        {
          command: 'water.log',
          input: {
            ph: 8.1,
            freeChlorine: 2.0,
            tempC: 27.5,
            clarity: 'pass',
            setStatusIfOutOfRange: 'limited',
            raiseIncidentIfOutOfRange: true,
          },
          actor: SUPERVISOR,
          assignedAmenities: SUPERVISOR_AMENITIES,
        },
      ],
      expect: (s) => {
        // Today's run — the seed's 90 days of history hold earlier ones for the same template.
        const run = Object.values(s.checklistRuns).find(
          (r) => r.templateId === POOL_OPENING_TEMPLATE && r.createdAt === START,
        );
        if (!run) throw new Error('Expected the pool opening checklist to be submitted');
        const audit = s.auditLog.find(
          (a) => a.action === 'checklist.submit' && a.target.id === run.id,
        );
        if (!audit) throw new Error('Expected the completed checklist in the audit log');
        if (!(audit.after as { late?: boolean }).late)
          throw new Error('Expected 06:10 against a 05:45 due time to be flagged late');

        const reading = Object.values(s.waterReadings).find((r) => r.at === START);
        if (!reading?.outOfRange.includes('ph'))
          throw new Error('Expected the pH 8.1 reading to be flagged out of range');

        const pool = selectCurrentStatusEntry(s, 'pool', s.demo.clock.now);
        if (pool?.status !== 'limited')
          throw new Error(`Expected the pool to be Limited, got ${pool?.status ?? 'open'}`);
        waterIncident(s);
      },
    },
    {
      title: 'Convert the incident to a P2 work order, assigned to AquaPure',
      body: 'From Incidents, Convert to work order: P2 (respond 2h, resolve 24h), assigned to AquaPure Pools LLC. The detail shows both SLA countdowns and today’s pool roster — including the 13:30–14:00 lifeguard gap.',
      script: [
        {
          command: 'incident.convertToWorkOrder',
          input: (s: AppState) => ({
            incidentId: waterIncident(s).id,
            priority: 'P2',
            title: 'Rebalance pool pH',
            assignee: { kind: 'vendor', id: aquapureId(s) },
          }),
          actor: SUPERVISOR,
          assignedAmenities: SUPERVISOR_AMENITIES,
        },
      ],
      expect: (s) => {
        const wo = waterWorkOrder(s);
        if (wo.priority !== 'P2') throw new Error('Expected a P2 work order');
        if (wo.assignee.kind !== 'vendor' || wo.assignee.id !== aquapureId(s)) {
          throw new Error('Expected the work order assigned to AquaPure');
        }
        if (wo.sla.resolveBy !== addHoursIso(wo.createdAt, 24))
          throw new Error('Expected a 24h resolve-by for P2');
        const state = resolveSlaState(
          wo.sla.resolveBy,
          wo.createdAt,
          wo.sla,
          s.demo.clock.now,
          rules.ops.slaAtRiskFraction,
        );
        if (state !== 'on_track') throw new Error(`Expected the SLA on track, got ${state}`);
      },
    },
    {
      title: 'Resident: the pool shows "Limited: water balancing in progress"; the gym is open',
      body: 'Layla opens the Pool: an amber Limited tag with the reason. The Sky Gym is open with its live occupancy ring.',
      setup: {
        devices: {
          A: {
            role: 'resident',
            actorId: PERSONA_IDS.layla,
            deepLink: 'amali://resident/amenity-detail?key=pool',
          },
        },
      },
      expect: (s) => {
        const pool = selectCurrentStatusEntry(s, 'pool', s.demo.clock.now);
        if (pool?.status !== 'limited' || !pool.reason?.toLowerCase().includes('water balancing')) {
          throw new Error('Expected the pool to read "Limited: water balancing in progress"');
        }
        const gym = selectCurrentStatusEntry(s, 'gym', s.demo.clock.now);
        if ((gym?.status ?? 'open') !== 'open') throw new Error('Expected the gym to be open');
      },
    },
    {
      title: 'Guard: pool occupancy counter +/−, and the resident ring updates live',
      body: 'Dual view: Sam taps + three times and − once on the guard counter. After the 1-second debounce, Layla’s pool ring moves to 2.',
      setup: {
        dualView: true,
        devices: {
          A: {
            role: 'resident',
            actorId: PERSONA_IDS.layla,
            deepLink: 'amali://resident/amenity-detail?key=pool',
          },
          B: { role: 'guard', actorId: STAFF_IDS.lifeguardSam },
        },
      },
      script: [
        { command: 'occupancy.adjust', input: { amenity: 'pool', delta: 3 }, actor: LIFEGUARD },
        { command: 'occupancy.adjust', input: { amenity: 'pool', delta: -1 }, actor: LIFEGUARD },
      ],
      expect: (s) => {
        if (s.occupancy.pool !== 2)
          throw new Error(`Expected pool occupancy 2, got ${s.occupancy.pool ?? 0}`);
      },
    },
    {
      title: 'AquaPure’s update resolves it; the supervisor verifies, closes, and reopens the pool',
      body: '13:00. A "Vendor update" from AquaPure marks the work order Resolved. The supervisor verifies and closes it with a resolution note and cost, then takes the suggested "Reopen Pool".',
      setup: {
        clock: VENDOR_UPDATE_AT,
        devices: {
          A: {
            role: 'console',
            actorId: STAFF_IDS.supervisorVictor,
            consoleRole: 'amenity_supervisor',
            deepLink: 'amali://console/work-orders',
          },
        },
      },
      script: [
        {
          command: 'workOrder.transition',
          input: (s: AppState) => ({
            workOrderId: waterWorkOrder(s).id,
            toState: 'in_progress',
            note: 'AquaPure on site',
          }),
          actor: SUPERVISOR,
          assignedAmenities: SUPERVISOR_AMENITIES,
        },
        {
          command: 'workOrder.transition',
          input: (s: AppState) => ({
            workOrderId: waterWorkOrder(s).id,
            toState: 'resolved',
            note: 'AquaPure: pH dosed back to 7.5, retested clean',
          }),
          actor: SUPERVISOR,
          assignedAmenities: SUPERVISOR_AMENITIES,
        },
        {
          command: 'workOrder.transition',
          input: (s: AppState) => ({
            workOrderId: waterWorkOrder(s).id,
            toState: 'closed',
            resolution: { note: 'Verified on site: pH 7.5.', costFils: 45000 },
          }),
          actor: SUPERVISOR,
          assignedAmenities: SUPERVISOR_AMENITIES,
        },
        {
          command: 'amenity.setStatus',
          input: (s: AppState) => ({
            amenity: 'pool',
            status: 'open',
            workOrderId: waterWorkOrder(s).id,
          }),
          actor: SUPERVISOR,
          assignedAmenities: SUPERVISOR_AMENITIES,
        },
      ],
      expect: (s) => {
        const wo = waterWorkOrder(s);
        if (wo.state !== 'closed')
          throw new Error(`Expected the work order closed, got ${wo.state}`);
        if (wo.sla.resolvedAt !== VENDOR_UPDATE_AT)
          throw new Error('Expected the resolve clock frozen at the vendor update');
        const state = resolveSlaState(
          wo.sla.resolveBy,
          wo.createdAt,
          wo.sla,
          s.demo.clock.now,
          rules.ops.slaAtRiskFraction,
          wo.sla.resolvedAt,
        );
        if (state === 'breached') throw new Error('Expected the work order resolved within SLA');

        const pool = selectCurrentStatusEntry(s, 'pool', s.demo.clock.now);
        if ((pool?.status ?? 'open') !== 'open') throw new Error('Expected the pool reopened');
      },
    },
  ],
};
