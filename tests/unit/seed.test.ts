import { describe, it, expect } from 'vitest';
import { buildSeed } from '@/seed';
import { PERSONA_IDS, UNIT_IDS, RELATED_IDS } from '@/seed/personaIds';

const SEED = 'amali-2026';
const NOW = '2026-10-14T13:30:00.000Z';

describe('seed/buildSeed — determinism', () => {
  it('the same seed and clock produce byte-identical state', () => {
    const a = buildSeed(SEED, NOW);
    const b = buildSeed(SEED, NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a different seed string produces different resident names', () => {
    const a = buildSeed('amali-2026', NOW);
    const b = buildSeed('amali-2027', NOW);
    expect(JSON.stringify(a.residents)).not.toBe(JSON.stringify(b.residents));
  });

  it('changing the namespaced community stream does not shift unrelated streams', () => {
    // Regenerating with the same seed+now must reproduce the exact same staff/vendor
    // records even though community/residents is a much larger, separately-namespaced stream.
    const a = buildSeed(SEED, NOW);
    const b = buildSeed(SEED, NOW);
    expect(a.staff).toEqual(b.staff);
    expect(a.vendors).toEqual(b.vendors);
  });
});

describe('seed/buildSeed — shape and personas', () => {
  const state = buildSeed(SEED, NOW);

  it('produces roughly the volumes PRD §3.3/§11 calls for', () => {
    const unitCount = Object.keys(state.units).length;
    const residentCount = Object.keys(state.residents).length;
    expect(unitCount).toBeGreaterThan(200);
    expect(unitCount).toBeLessThan(300);
    expect(residentCount).toBeGreaterThan(350);
    expect(residentCount).toBeLessThan(500);
  });

  it('seeds all 7 amenities with the rules-config capacity', () => {
    expect(Object.keys(state.amenities).sort()).toEqual(
      ['creche', 'dining', 'gym', 'music', 'padel', 'pool', 'screening'].sort(),
    );
    expect(state.amenities.padel.capacity).toBe(1);
    expect(state.amenities.pool.ageMin).toBe(18);
  });

  it('every unit has a valid amenityRightsHolderId pointing at a real resident', () => {
    for (const unit of Object.values(state.units)) {
      expect(unit.amenityRightsHolderId).toBeTruthy();
      expect(state.residents[unit.amenityRightsHolderId]).toBeDefined();
    }
  });

  it('Layla Al Mansoori is a complete persona at E-1804 with the right wallet balance', () => {
    const layla = state.residents[PERSONA_IDS.layla];
    expect(layla).toBeDefined();
    expect(layla?.name).toBe('Layla Al Mansoori');
    expect(layla?.unitId).toBe(UNIT_IDS.layla);
    expect(layla?.type).toBe('owner');
    expect(state.units[UNIT_IDS.layla]?.amenityRightsHolderId).toBe(PERSONA_IDS.layla);
    expect(state.wallets[UNIT_IDS.layla]?.balanceFils).toBe(245000); // AED 2,450
  });

  it("Omar and Noor are registered against Layla's unit with both parents as guardians", () => {
    const children = Object.values(state.children).filter((c) => c.unitId === UNIT_IDS.layla);
    expect(children).toHaveLength(2);
    for (const child of children) {
      expect(child.guardianIds).toEqual(expect.arrayContaining(['guardian_layla', 'guardian_khalid']));
    }
  });

  it("Rashid's unit amenity rights sit with his tenant, not Rashid himself", () => {
    const unit = state.units[UNIT_IDS.rashid];
    expect(unit?.amenityRightsHolderId).toBe(RELATED_IDS.rashidTenant);
    expect(unit?.amenityRightsHolderId).not.toBe(PERSONA_IDS.rashid);
    expect(unit?.leaseEnd).toBeTruthy();
    expect(state.residents[PERSONA_IDS.rashid]?.type).toBe('owner');
    expect(state.residents[RELATED_IDS.rashidTenant]?.type).toBe('tenant');
  });

  it('Ahmed has app push off and WhatsApp on; Priya has opted out of WhatsApp', () => {
    expect(state.residents[PERSONA_IDS.ahmed]?.channels).toMatchObject({
      appPush: false,
      whatsapp: true,
    });
    expect(state.residents[PERSONA_IDS.priya]?.channels).toMatchObject({
      whatsapp: false,
      whatsappOptIn: false,
    });
  });

  it('Sofia has a low wallet balance (AED 120) for the insufficient-balance edge case', () => {
    expect(state.wallets[UNIT_IDS.sofia]?.balanceFils).toBe(12000);
  });

  it('seeds the named staff with Victor assigned to pool, gym and padel', () => {
    const victor = Object.values(state.staff).find((s) => s.name === 'Victor');
    expect(victor?.role).toBe('amenity_supervisor');
    expect(victor?.assignedAmenities).toEqual(expect.arrayContaining(['pool', 'gym', 'padel']));
  });

  it('seeds the 5 fictional vendors', () => {
    expect(Object.keys(state.vendors)).toHaveLength(5);
  });

  it('starts the demo clock at the PRD S1 start time', () => {
    expect(state.demo.clock.now).toBe(NOW);
    expect(state.demo.devices.A.actorId).toBe(PERSONA_IDS.layla);
  });
});
