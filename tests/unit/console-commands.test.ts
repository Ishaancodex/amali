import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import { schedulerEngine } from '@/scheduler/engine';
import { buildSeed } from '@/seed';
import { PERSONA_IDS, STAFF_IDS } from '@/seed/personaIds';
import { canOpenRoute } from '@/config/consoleAccess';
import { buildReport, REPORT_AMENITIES, REPORT_SECTIONS } from '@/store/selectors/report';

const NOW = '2026-10-14T13:30:00.000Z';
const SLOT = '2026-10-15T15:00:00.000Z';
const as = (role: 'community_manager' | 'amenity_supervisor' | 'call_centre') => ({
  kind: 'staff' as const,
  id: STAFF_IDS.cmHana,
  role,
});
const s = () => useStore.getState();
const dispatch: ReturnType<typeof s>['dispatch'] = (...args) => s().dispatch(...args);

beforeEach(() => {
  useStore.setState(buildSeed('amali-2026', NOW));
  schedulerEngine.queue.clear();
});

describe('book / cancel on behalf', () => {
  const input = { residentId: PERSONA_IDS.layla, start: SLOT, durationMinutes: 60, players: [] };

  it('needs a reason, from every role', () => {
    for (const role of ['community_manager', 'amenity_supervisor', 'call_centre'] as const) {
      const r = dispatch('booking.bookOnBehalf', { ...input, reason: '  ' }, as(role));
      expect(!r.ok && r.error.code).toBe('REASON_REQUIRED');
    }
  });

  it('books as the resident (same rules), marks it as staff-made, and logs who, why and as which role', () => {
    const r = dispatch(
      'booking.bookOnBehalf',
      { ...input, reason: 'Phoned in' },
      as('call_centre'),
    );
    expect(r.ok && [r.value.bookerId, r.value.source]).toEqual([PERSONA_IDS.layla, 'agent']);
    const audit = s().auditLog.find((a) => a.action === 'booking.bookOnBehalf')!;
    expect(audit).toMatchObject({ reason: 'Phoned in', actor: { role: 'call_centre' } });
    const again = dispatch(
      'booking.bookOnBehalf',
      { ...input, reason: 'Again' },
      as('call_centre'),
    );
    expect(again.ok).toBe(false); // the resident's own rules still apply (the slot is taken)
  });

  it('cancels on behalf with a reason', () => {
    const r = dispatch(
      'booking.bookOnBehalf',
      { ...input, reason: 'Phoned in' },
      as('call_centre'),
    );
    const c = dispatch(
      'booking.cancelOnBehalf',
      { bookingId: r.ok ? r.value.id : '', reason: 'Changed plans' },
      as('call_centre'),
    );
    expect(c.ok && c.value.state).toMatch(/cancelled/);
    expect(
      s().auditLog.some(
        (a) => a.action === 'booking.cancelOnBehalf' && a.reason === 'Changed plans',
      ),
    ).toBe(true);
  });
});

describe('permissions at dispatch', () => {
  const blackout = {
    start: '2026-10-16T02:00:00.000Z',
    end: '2026-10-16T04:00:00.000Z',
    reason: 'Resurface',
    handling: 'cancel_priority_rebook' as const,
  };

  it('the agent can’t create a blackout; a supervisor can for padel (assigned)', () => {
    expect(dispatch('blackout.create', blackout, as('call_centre')).ok).toBe(false);
    expect(
      dispatch('blackout.create', blackout, as('amenity_supervisor'), {
        assignedAmenities: ['pool', 'gym', 'padel'],
      }).ok,
    ).toBe(true);
  });

  it('only the agent reveals a masked phone, and it is logged', () => {
    const r = dispatch(
      'pii.reveal',
      { residentId: PERSONA_IDS.layla, field: 'phone' },
      as('call_centre'),
    );
    expect(r.ok && r.value).toBe('+971 50 123 4567');
    expect(s().auditLog.some((a) => a.action === 'pii.reveal')).toBe(true);
    expect(
      dispatch(
        'pii.reveal',
        { residentId: PERSONA_IDS.layla, field: 'phone' },
        as('amenity_supervisor'),
      ).ok,
    ).toBe(false);
  });

  it('report schedules: an email is required; the agent can’t schedule', () => {
    const base = {
      name: 'Weekly',
      windowDays: 7,
      amenities: [],
      weekday: 1 as const,
      time: '08:00',
    };
    expect(
      dispatch('report.schedule', { ...base, email: 'nope' }, as('community_manager')).ok,
    ).toBe(false);
    const ok = dispatch(
      'report.schedule',
      { ...base, email: 'hana@amali.example' },
      as('community_manager'),
    );
    expect(ok.ok).toBe(true);
    expect(dispatch('report.schedule', { ...base, email: 'x@y.z' }, as('call_centre')).ok).toBe(
      false,
    );
    dispatch(
      'report.unschedule',
      { scheduleId: ok.ok ? ok.value.id : '' },
      as('community_manager'),
    );
    expect(Object.keys(s().reportSchedules)).toHaveLength(0);
  });
});

describe('console navigation by role', () => {
  it.each([
    [
      'community_manager',
      ['overview', 'home', 'ops', 'programme', 'residents', 'reports', 'roles', 'blackout'],
    ],
    [
      'amenity_supervisor',
      ['overview', 'home', 'ops', 'programme', 'residents', 'reports', 'blackout'],
    ],
    ['call_centre', ['overview', 'home', 'residents']],
  ] as const)('%s opens exactly %j', (role, routes) => {
    const all = [
      'overview',
      'home',
      'ops',
      'programme',
      'residents',
      'reports',
      'roles',
      'blackout',
    ];
    expect(all.filter((r) => canOpenRoute(role, r))).toEqual(routes);
  });
});

describe('report filters', () => {
  it('a tower filter narrows booking counts; amenities follow the role', () => {
    const req = {
      from: '2026-09-14',
      to: '2026-10-13',
      amenities: [...REPORT_AMENITIES],
      towers: [],
      sections: [...REPORT_SECTIONS],
    };
    const all = buildReport(s(), req, 'community_manager', undefined, NOW);
    const east = buildReport(
      s(),
      { ...req, towers: ['east'] },
      'community_manager',
      undefined,
      NOW,
    );
    const total = (r: typeof all) => r.trends.daily.reduce((n, p) => n + p.value, 0);
    expect(total(east)).toBeGreaterThan(0);
    expect(total(east)).toBeLessThan(total(all));
    expect(buildReport(s(), req, 'amenity_supervisor', undefined, NOW).amenities).toEqual([
      'padel',
      'pool',
      'gym',
    ]);
  });
});
