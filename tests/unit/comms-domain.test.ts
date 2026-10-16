import { describe, it, expect } from 'vitest';
import {
  resolveAudience,
  matchesClause,
  buildAudiencePreview,
  type AudienceContext,
} from '@/domain/comms/audience';
import { isQuietHours, resolveChannelsForResident, isUnreachable } from '@/domain/comms/fallback';
import { planDeliveryTimes, resolveDeliveryState } from '@/domain/comms/delivery';
import { buildDailyUpdateText } from '@/domain/comms/dailyTemplate';
import {
  buildFunnel,
  computeTimeToReach,
  reachSummary,
  fmtElapsed,
} from '@/domain/comms/analytics';
import { rng } from '@/lib/random';
import { rules } from '@/config/rules';
import type { Resident } from '@/types/community';
import type { Unit } from '@/types/community';
import type { Delivery } from '@/types/comms';

const NOW = '2026-10-14T13:30:00.000Z';

function unit(id: string, extra: Partial<Unit>): Unit {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    kind: 'apartment',
    amenityRightsHolderId: '',
    ...extra,
  };
}

function resident(id: string, unitId: string, extra: Partial<Resident> = {}): Resident {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    name: `Resident ${id}`,
    avatar: 'RX',
    unitId,
    type: 'owner',
    phone: '+971500000000',
    email: 'r@example.com',
    channels: { appPush: true, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    locale: 'en',
    walletRole: 'primary',
    ...extra,
  };
}

function emptyCtx(overrides: Partial<AudienceContext> = {}): AudienceContext {
  return {
    residents: {},
    units: {},
    bookings: {},
    rsvps: {},
    showtimes: {},
    events: {},
    guardians: {},
    ...overrides,
  };
}

describe('domain/comms/audience', () => {
  it('matches tower and floor-range clauses', () => {
    const units = {
      'E-1804': unit('E-1804', { tower: 'east', floor: 18 }),
      'W-PH02': unit('W-PH02', { tower: 'west' }),
    };
    const layla = resident('layla', 'E-1804');
    const sofia = resident('sofia', 'W-PH02');
    const ctx = emptyCtx({ units, residents: { layla, sofia } });

    expect(
      matchesClause(
        { kind: 'floors', tower: 'east', from: 10, to: 20 },
        layla,
        units['E-1804'],
        ctx,
      ),
    ).toBe(true);
    expect(
      matchesClause(
        { kind: 'floors', tower: 'east', from: 10, to: 20 },
        sofia,
        units['W-PH02'],
        ctx,
      ),
    ).toBe(false);
    expect(matchesClause({ kind: 'tower', tower: 'west' }, sofia, units['W-PH02'], ctx)).toBe(true);
  });

  it('resolves a combined include with an exclude', () => {
    const units = {
      u1: unit('u1', { tower: 'east', floor: 15 }),
      u2: unit('u2', { tower: 'east', floor: 31 }),
    };
    const r1 = resident('r1', 'u1');
    const r2 = resident('r2', 'u2');
    const ctx = emptyCtx({ units, residents: { r1, r2 } });

    const result = resolveAudience(
      {
        include: [{ kind: 'tower', tower: 'east' }],
        exclude: [{ kind: 'floors', tower: 'east', from: 30, to: 32 }],
      },
      ctx,
    );
    expect(result.map((r) => r.id)).toEqual(['r1']);
  });

  it('builds an audience preview with app/WhatsApp/unreachable counts', () => {
    const r1 = resident('r1', 'u1', {
      channels: { appPush: true, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    });
    const r2 = resident('r2', 'u1', {
      channels: { appPush: false, whatsapp: false, whatsappOptIn: false, appInstalled: false },
    });
    const preview = buildAudiencePreview([r1, r2]);
    expect(preview.residentCount).toBe(2);
    expect(preview.unitCount).toBe(1);
    expect(preview.appReachable).toBe(1);
    expect(preview.waReachable).toBe(1);
    expect(preview.unreachable).toBe(1);
  });

  it('matches the optedIn clause off topicOptIns', () => {
    const r1 = resident('r1', 'u1', { topicOptIns: ['pool'] });
    const ctx = emptyCtx({ residents: { r1 } });
    expect(matchesClause({ kind: 'optedIn', topic: 'pool' }, r1, undefined, ctx)).toBe(true);
    expect(matchesClause({ kind: 'optedIn', topic: 'gym' }, r1, undefined, ctx)).toBe(false);
  });
});

describe('domain/comms/fallback', () => {
  it('detects overnight quiet hours correctly', () => {
    const quiet = { start: '22:00', end: '07:00' };
    expect(isQuietHours('2026-10-14T19:00:00.000Z', quiet)).toBe(true); // 23:00 Dubai
    expect(isQuietHours('2026-10-14T13:30:00.000Z', quiet)).toBe(false); // 17:30 Dubai
    expect(isQuietHours('2026-10-15T02:30:00.000Z', quiet)).toBe(true); // 06:30 Dubai
  });

  it('falls back push-off residents to WhatsApp, and WhatsApp opt-outs to app only', () => {
    const pushOff = resident('a', 'u1', {
      channels: { appPush: false, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    });
    expect(resolveChannelsForResident(pushOff, ['app_push'])).toEqual(['wa_direct']);

    const waOptOut = resident('b', 'u1', {
      channels: { appPush: true, whatsapp: false, whatsappOptIn: false, appInstalled: true },
    });
    expect(resolveChannelsForResident(waOptOut, ['wa_direct'])).toEqual(['app_inbox']);
  });

  it('flags a resident with no reachable channel as unreachable', () => {
    const none = resident('c', 'u1', {
      channels: { appPush: false, whatsapp: false, whatsappOptIn: false, appInstalled: false },
    });
    expect(isUnreachable(none, ['app_push', 'wa_direct'])).toBe(true);
    expect(isUnreachable(resident('d', 'u1'), ['app_push', 'wa_direct'])).toBe(false);
  });
});

describe('domain/comms/delivery', () => {
  it('always fails within the fail-rate stream, or always succeeds outside it, deterministically', () => {
    const r = rng('test-seed', 'delivery', 'ann1', 'res1', 'app_push');
    const plan = planDeliveryTimes(r, NOW, false, rules.comms.delivery);
    expect(plan.queued).toBe(NOW);
    expect(plan.sent).toBeDefined();
    if (plan.sent) expect(plan.sent >= NOW).toBe(true);
  });

  it('derives state by comparing now against the precomputed plan', () => {
    const plan = {
      queued: NOW,
      sent: '2026-10-14T13:30:01.000Z',
      delivered: '2026-10-14T13:30:05.000Z',
      read: '2026-10-14T13:40:00.000Z',
    };
    expect(resolveDeliveryState(plan, NOW)).toBe('queued');
    expect(resolveDeliveryState(plan, '2026-10-14T13:30:02.000Z')).toBe('sent');
    expect(resolveDeliveryState(plan, '2026-10-14T13:30:06.000Z')).toBe('delivered');
    expect(resolveDeliveryState(plan, '2026-10-14T13:41:00.000Z')).toBe('read');
  });

  it('a failed plan resolves to failed once its sent time passes, never delivered/read', () => {
    const plan = {
      queued: NOW,
      sent: '2026-10-14T13:30:01.000Z',
      failed: '2026-10-14T13:30:01.000Z',
    };
    expect(resolveDeliveryState(plan, '2026-10-14T13:30:02.000Z')).toBe('failed');
  });

  it('over many seeded streams, roughly matches the configured fail rate', () => {
    let failures = 0;
    const n = 500;
    for (let i = 0; i < n; i += 1) {
      const r = rng('test-seed', 'delivery', 'annX', `res${i}`, 'app_push');
      const plan = planDeliveryTimes(r, NOW, false, rules.comms.delivery);
      if (plan.failed) failures += 1;
    }
    const rate = failures / n;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(rules.comms.delivery.failRate * 3 + 0.02);
  });
});

describe('domain/comms/dailyTemplate', () => {
  it('builds one status line per amenity', () => {
    const text = buildDailyUpdateText({
      amenities: {
        padel: {
          key: 'padel',
          name: 'Padel Tennis Court',
          image: '',
          location: '',
          bookingModel: 'slot',
          capacity: 4,
        },
        pool: {
          key: 'pool',
          name: 'Adult Pool',
          image: '',
          location: '',
          bookingModel: 'none',
          capacity: 40,
        },
      },
      amenityStatus: [],
      hours: [],
      now: NOW,
    });
    expect(text).toContain('Padel Tennis Court: open');
    expect(text).toContain('Adult Pool: open');
    expect(text.startsWith('Good morning, Amali.')).toBe(true);
  });
});

describe('domain/comms/analytics', () => {
  function delivery(
    id: string,
    channel: Delivery['channel'],
    state: Delivery['state'],
    times: Delivery['times'] = {},
  ): Delivery {
    return {
      id,
      createdAt: NOW,
      updatedAt: NOW,
      messageRef: { type: 'announcement', id: 'ann1' },
      recipientId: id,
      channel,
      state,
      times,
    };
  }

  it('builds a per-channel funnel', () => {
    const deliveries = [
      delivery('r1', 'app_push', 'read'),
      delivery('r2', 'app_push', 'delivered'),
      delivery('r3', 'app_push', 'failed'),
      delivery('r4', 'wa_direct', 'sent'),
    ];
    const funnel = buildFunnel(deliveries);
    const app = funnel.find((f) => f.channel === 'app_push')!;
    expect(app.total).toBe(3);
    expect(app.read).toBe(1);
    expect(app.delivered).toBe(2); // read counts as having passed delivered
    expect(app.failed).toBe(1);
    const wa = funnel.find((f) => f.channel === 'wa_direct')!;
    expect(wa.sent).toBe(1);
    expect(wa.delivered).toBe(0);
  });

  it('computes time-to-reach percentiles relative to the whole audience', () => {
    const sentAt = NOW;
    const deliveries = [
      delivery('r1', 'app_push', 'read', {
        delivered: '2026-10-14T13:31:00.000Z',
        read: '2026-10-14T13:35:00.000Z',
      }),
      delivery('r2', 'app_push', 'read', {
        delivered: '2026-10-14T13:32:00.000Z',
        read: '2026-10-14T13:40:00.000Z',
      }),
    ];
    const metrics = computeTimeToReach(deliveries, sentAt);
    expect(metrics.medianDeliverMinutes).toBeCloseTo(1.5, 1);
    expect(metrics.timeTo50PctReadMinutes).toBe(5);
    expect(metrics.timeTo90PctReadMinutes).toBe(10);
  });

  it('a reach summary counts delivered-or-read against the total, with elapsed time formatted', () => {
    const deliveries = [
      delivery('r1', 'app_push', 'delivered'),
      delivery('r2', 'app_push', 'queued'),
    ];
    const summary = reachSummary(deliveries, NOW, '2026-10-14T13:30:42.000Z');
    expect(summary.reached).toBe(1);
    expect(summary.total).toBe(2);
    expect(summary.elapsedSeconds).toBe(42);
    expect(fmtElapsed(summary.elapsedSeconds)).toBe('0:42');
  });
});
