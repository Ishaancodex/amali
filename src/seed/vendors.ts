/**
 * Fictional vendors (PRD §3.2). SLA terms default to the ops rules
 * (`config/rules.ts`) unless a vendor's contract is notably different.
 */
import type { Vendor } from '@/types/community';
import { rules } from '@/config/rules';

function vendorId(name: string): string {
  return `vendor_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

function defaultSla(): Vendor['sla'] {
  const toVendorTerms = (band: { respondMinutes: number; resolveMinutes: number }) => ({
    respondMins: band.respondMinutes,
    resolveMins: band.resolveMinutes,
  });
  return {
    P1: toVendorTerms(rules.ops.sla.P1),
    P2: toVendorTerms(rules.ops.sla.P2),
    P3: toVendorTerms(rules.ops.sla.P3),
  };
}

export function buildVendors(now: string): Record<string, Vendor> {
  const contract = { start: '2025-01-01T00:00:00.000Z', end: '2027-12-31T23:59:59.000Z' };

  const list: Vendor[] = [
    {
      id: vendorId('AquaPure Pools LLC'),
      createdAt: now,
      updatedAt: now,
      name: 'AquaPure Pools LLC',
      services: ['Pool maintenance', 'Water chemicals'],
      contact: { name: 'Fahad Noor', phone: '+971 4 123 4001' },
      contract,
      sla: defaultSla(),
      rateCard: [
        { item: 'Routine chemical balancing', fils: 35000 },
        { item: 'Filtration system service', fils: 120000 },
      ],
    },
    {
      id: vendorId('CourtPro Sports'),
      createdAt: now,
      updatedAt: now,
      name: 'CourtPro Sports',
      services: ['Padel surface resurfacing', 'Court lighting'],
      contact: { name: 'Lucia Fernandes', phone: '+971 4 123 4002' },
      contract,
      sla: defaultSla(),
      rateCard: [
        { item: 'Surface resurfacing (per court)', fils: 450000 },
        { item: 'Lighting repair', fils: 60000 },
      ],
    },
    {
      id: vendorId('FitServe Equipment'),
      createdAt: now,
      updatedAt: now,
      name: 'FitServe Equipment',
      services: ['Gym equipment maintenance'],
      contact: { name: 'Tariq Yousef', phone: '+971 4 123 4003' },
      contract,
      sla: defaultSla(),
      rateCard: [
        { item: 'Treadmill service call', fils: 25000 },
        { item: 'Annual equipment inspection', fils: 180000 },
      ],
    },
    {
      id: vendorId('CoolAir HVAC'),
      createdAt: now,
      updatedAt: now,
      name: 'CoolAir HVAC',
      services: ['HVAC repair and servicing'],
      contact: { name: 'Benjamin Clarke', phone: '+971 4 123 4004' },
      contract,
      sla: defaultSla(),
      rateCard: [{ item: 'AC unit service call', fils: 40000 }],
    },
    {
      id: vendorId('Lumen AV'),
      createdAt: now,
      updatedAt: now,
      name: 'Lumen AV',
      services: ['Screening room AV systems'],
      contact: { name: 'Nadia Farah', phone: '+971 4 123 4005' },
      contract,
      sla: defaultSla(),
      rateCard: [{ item: 'Projector calibration', fils: 55000 }],
    },
  ];

  return Object.fromEntries(list.map((v) => [v.id, v]));
}
