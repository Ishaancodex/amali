import { describe, it, expect } from 'vitest';
import { buildOccupancyEstimate, adjustOccupancy, occupancyBand } from '@/domain/ops/occupancy';
import { isChecklistLate } from '@/domain/ops/checklist';
import { outOfRangeParams, isWaterReadingOverdue } from '@/domain/ops/water';
import { findCoverageGaps } from '@/domain/ops/roster';
import { computeSlaDeadlines, resolveSlaState, pausedMsAt } from '@/domain/ops/sla';
import { findDuplicateIncident } from '@/domain/ops/incidents';
import { rules } from '@/config/rules';
import type { Shift } from '@/types/ops';
import type { Incident } from '@/types/ops';

const NOW = '2026-10-14T13:30:00.000Z';

describe('domain/ops/occupancy', () => {
  it('bands fractions into quiet/moderate/busy', () => {
    expect(occupancyBand(0.1)).toBe('quiet');
    expect(occupancyBand(0.5)).toBe('moderate');
    expect(occupancyBand(0.9)).toBe('busy');
  });

  it('builds an estimate from a raw count and capacity', () => {
    const est = buildOccupancyEstimate(20, 40);
    expect(est).toEqual({ count: 20, capacity: 40, fraction: 0.5, band: 'moderate' });
  });

  it('never adjusts the counter below 0', () => {
    expect(adjustOccupancy(2, -1)).toBe(1);
    expect(adjustOccupancy(0, -1)).toBe(0);
    expect(adjustOccupancy(5, 3)).toBe(8);
  });
});

describe('domain/ops/checklist', () => {
  it('flags a checklist completed after its due time as late', () => {
    expect(isChecklistLate('2026-10-14', '05:45', '2026-10-14T02:10:00.000Z')).toBe(true); // 06:10 Dubai
    expect(isChecklistLate('2026-10-14', '05:45', '2026-10-14T01:30:00.000Z')).toBe(false); // 05:30 Dubai
  });
});

describe('domain/ops/water', () => {
  it('flags every out-of-range parameter', () => {
    const out = outOfRangeParams(
      { ph: 8.1, freeChlorine: 2.0, tempC: 27, clarity: 'pass' },
      rules.pool.waterQuality,
    );
    expect(out).toEqual(['ph']);
  });

  it('flags clarity fail and multiple out-of-range params together', () => {
    const out = outOfRangeParams(
      { ph: 8.1, freeChlorine: 0.5, tempC: 31, clarity: 'fail' },
      rules.pool.waterQuality,
    );
    expect(out).toEqual(['ph', 'freeChlorine', 'tempC', 'clarity']);
  });

  it('a clean reading has no out-of-range params', () => {
    expect(
      outOfRangeParams(
        { ph: 7.4, freeChlorine: 2.0, tempC: 27, clarity: 'pass' },
        rules.pool.waterQuality,
      ),
    ).toEqual([]);
  });

  it('is not overdue with no prior reading, and becomes overdue after interval + grace', () => {
    expect(isWaterReadingOverdue(undefined, NOW, 2, 30)).toBe(false);
    const last = '2026-10-14T11:00:00.000Z';
    expect(isWaterReadingOverdue(last, '2026-10-14T13:00:00.000Z', 2, 30)).toBe(false); // exactly 2h, within grace
    expect(isWaterReadingOverdue(last, '2026-10-14T13:31:00.000Z', 2, 30)).toBe(true); // 2h31m
  });
});

describe('domain/ops/roster', () => {
  const staffRoleById = new Map<string, 'lifeguard' | 'gym_attendant'>([
    ['sam', 'lifeguard'],
    ['rahul', 'lifeguard'],
  ]);

  function shift(id: string, staffId: string, start: string, end: string): Shift {
    return {
      id,
      createdAt: NOW,
      updatedAt: NOW,
      staffId,
      date: '2026-10-14',
      start,
      end,
      amenity: 'pool',
      state: 'scheduled',
    };
  }

  it('finds no gap when shifts fully cover the window', () => {
    const shifts = [
      shift('s1', 'sam', '2026-10-14T02:00:00.000Z', '2026-10-14T10:00:00.000Z'),
      shift('s2', 'rahul', '2026-10-14T10:00:00.000Z', '2026-10-14T18:00:00.000Z'),
    ];
    const gaps = findCoverageGaps(
      shifts,
      'pool',
      'lifeguard',
      staffRoleById,
      '2026-10-14T02:00:00.000Z',
      '2026-10-14T18:00:00.000Z',
    );
    expect(gaps).toEqual([]);
  });

  it('finds the PRD-quoted gap: no lifeguard 13:30-14:00', () => {
    // Sam covers 06:00-13:30 Dubai, Rahul covers 14:00-22:00 Dubai (both in UTC).
    const shifts = [
      shift('s1', 'sam', '2026-10-14T02:00:00.000Z', '2026-10-14T09:30:00.000Z'),
      shift('s2', 'rahul', '2026-10-14T10:00:00.000Z', '2026-10-14T18:00:00.000Z'),
    ];
    const gaps = findCoverageGaps(
      shifts,
      'pool',
      'lifeguard',
      staffRoleById,
      '2026-10-14T02:00:00.000Z',
      '2026-10-14T18:00:00.000Z',
    );
    expect(gaps).toEqual([{ start: '2026-10-14T09:30:00.000Z', end: '2026-10-14T10:00:00.000Z' }]);
  });

  it('a shift of the wrong role does not count as coverage', () => {
    const wrongRole = new Map([['leo', 'gym_attendant' as const]]);
    const shifts = [shift('s1', 'leo', '2026-10-14T02:00:00.000Z', '2026-10-14T18:00:00.000Z')];
    const gaps = findCoverageGaps(
      shifts,
      'pool',
      'lifeguard',
      wrongRole,
      '2026-10-14T02:00:00.000Z',
      '2026-10-14T18:00:00.000Z',
    );
    expect(gaps).toEqual([{ start: '2026-10-14T02:00:00.000Z', end: '2026-10-14T18:00:00.000Z' }]);
  });
});

describe('domain/ops/sla', () => {
  const createdAt = NOW;
  const emptySla = { pausedMs: 0, pausedSince: undefined };

  it('computes respond/resolve deadlines from priority', () => {
    const d = computeSlaDeadlines('P2', createdAt, rules.ops);
    expect(d.respondBy).toBe('2026-10-14T15:30:00.000Z'); // +2h
    expect(d.resolveBy).toBe('2026-10-15T13:30:00.000Z'); // +24h
  });

  it('is on_track early, at_risk past 75%, breached past 100%', () => {
    const deadline = computeSlaDeadlines('P1', createdAt, rules.ops).resolveBy; // +4h
    expect(resolveSlaState(deadline, createdAt, emptySla, '2026-10-14T14:30:00.000Z', 0.75)).toBe(
      'on_track',
    ); // 1h/4h = 25%
    expect(resolveSlaState(deadline, createdAt, emptySla, '2026-10-14T16:30:00.000Z', 0.75)).toBe(
      'at_risk',
    ); // 3h/4h = 75%
    expect(resolveSlaState(deadline, createdAt, emptySla, '2026-10-14T17:31:00.000Z', 0.75)).toBe(
      'breached',
    ); // 4h1m/4h
  });

  it('a pause extends the effective runway — paused time does not count against the SLA', () => {
    const deadline = computeSlaDeadlines('P1', createdAt, rules.ops).resolveBy; // +4h, breaches at 17:30
    // Paused 14:30-18:30 (4h). By wall-clock, 18:30 is 5h after creation (past the 4h deadline) — but
    // only 1h of that was active (0h-1h, before the pause started), so this should still be on_track.
    const paused = { pausedMs: 0, pausedSince: '2026-10-14T14:30:00.000Z' };
    expect(resolveSlaState(deadline, createdAt, paused, '2026-10-14T18:30:00.000Z', 0.75)).toBe(
      'on_track',
    );
  });

  it('a completed pause (resumed) is credited via pausedMs', () => {
    expect(pausedMsAt({ pausedMs: 30 * 60 * 1000, pausedSince: undefined }, NOW)).toBe(
      30 * 60 * 1000,
    );
    expect(
      pausedMsAt(
        { pausedMs: 0, pausedSince: '2026-10-14T13:00:00.000Z' },
        '2026-10-14T13:30:00.000Z',
      ),
    ).toBe(30 * 60 * 1000);
  });

  it('freezing at respondedAt stops the clock even if now has moved past the deadline', () => {
    const deadline = computeSlaDeadlines('P1', createdAt, rules.ops).respondBy; // +30min
    const respondedAt = '2026-10-14T13:45:00.000Z'; // 15 min in, on time
    expect(
      resolveSlaState(deadline, createdAt, emptySla, '2026-10-15T00:00:00.000Z', 0.75, respondedAt),
    ).toBe('on_track');
  });
});

describe('domain/ops/incidents', () => {
  function incident(
    id: string,
    amenity: Incident['amenity'],
    category: string,
    at: string,
  ): Incident {
    return {
      id,
      createdAt: at,
      updatedAt: at,
      amenity,
      category,
      severity: 'medium',
      description: 'x',
      raisedBy: 'staff_1',
      raisedVia: 'guard',
      at,
    };
  }

  it('finds a duplicate within the 2h window, same amenity and category', () => {
    const existing = [incident('inc1', 'pool', 'water_quality', '2026-10-14T12:00:00.000Z')];
    const dup = findDuplicateIncident(
      existing,
      'pool',
      'water_quality',
      '2026-10-14T13:30:00.000Z',
    );
    expect(dup?.id).toBe('inc1');
  });

  it('does not match outside the window, a different category, or an already-merged incident', () => {
    const existing = [
      incident('old', 'pool', 'water_quality', '2026-10-14T10:00:00.000Z'), // 3.5h ago
      incident('diffCat', 'pool', 'equipment', '2026-10-14T13:00:00.000Z'),
      {
        ...incident('merged', 'pool', 'water_quality', '2026-10-14T13:00:00.000Z'),
        mergedInto: 'inc1',
      },
    ];
    expect(
      findDuplicateIncident(existing, 'pool', 'water_quality', '2026-10-14T13:30:00.000Z'),
    ).toBeUndefined();
  });
});
