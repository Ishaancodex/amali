import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import '@/scheduler/registerJobs';
import { schedulerEngine } from '@/scheduler/engine';
import { buildSeed } from '@/seed';
import { SEEDED_NO_SHOW_ID } from '@/seed/dining';
import { PERSONA_IDS, STAFF_IDS, UNIT_IDS } from '@/seed/personaIds';
import { availableFils } from '@/domain/wallet/holds';
import { aedToFils } from '@/lib/money';
import { dubaiDateTimeToIso } from '@/lib/time';

const DATE = '2026-10-16';
const at = (hhmm: string, date = DATE) => dubaiDateTimeToIso(date, hhmm);
const NOW = at('17:00');

const sofia = { kind: 'resident' as const, id: PERSONA_IDS.sofia };
const james = { kind: 'resident' as const, id: PERSONA_IDS.james };
const layla = { kind: 'resident' as const, id: PERSONA_IDS.layla };
const elena = { kind: 'staff' as const, id: STAFF_IDS.fnbElena, role: 'host' };
const marco = { kind: 'staff' as const, id: STAFF_IDS.fnbMarco, role: 'fnb_manager' };

function reset(now = NOW): void {
  useStore.setState(buildSeed('amali-2026', now));
  schedulerEngine.queue.clear();
  for (const job of Object.values(useStore.getState().jobs))
    schedulerEngine.queue.enqueue({ ...job });
}
const s = () => useStore.getState();
const dispatch: ReturnType<typeof s>['dispatch'] = (...args) => s().dispatch(...args);
const setNow = (now: string) =>
  useStore.setState((d) => {
    d.demo.clock.now = now;
  });
const avail = (unit: string) =>
  availableFils(s().wallets[unit], Object.values(s().walletHolds), unit);
const sofiaTopUp = (aed: number) =>
  dispatch('wallet.topUp', { unitId: UNIT_IDS.sofia, amountFils: aedToFils(aed) }, sofia);
const teppanyaki4 = () =>
  dispatch('dining.reserve', { venue: 'teppanyaki', start: at('21:00'), partySize: 4 }, sofia);

describe('reserve', () => {
  beforeEach(() => reset());

  it('asks Sofia for a top-up when AED 120 cannot hold the AED 400 deposit', () => {
    const r = teppanyaki4();
    expect(!r.ok && r.error).toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
      params: { shortfallFils: 28000 },
    });
    sofiaTopUp(500);
    const ok = teppanyaki4();
    expect(ok.ok).toBe(true);
    expect(avail(UNIT_IDS.sofia)).toBe(aedToFils(220));
    expect(Object.values(s().ledger).some((e) => e.kind === 'hold' && e.fils === -40000)).toBe(
      true,
    );
    expect(s().jobs[`dining-noshow:${ok.ok ? ok.value.id : ''}`]).toBeDefined();
  });

  it('a Restaurant table for 2 needs no deposit and honours a canal preference', () => {
    const r = dispatch(
      'dining.reserve',
      {
        venue: 'restaurant',
        start: at('19:15'),
        partySize: 2,
        seatingPref: 'canal',
        dietary: ['nut allergy'],
      },
      layla,
    );
    expect(r.ok && [r.value.state, r.value.zoneHonoured, r.value.depositHoldId]).toEqual([
      'confirmed',
      true,
      undefined,
    ]);
  });

  it('a party of 10 is a request: only the manager can accept or decline', () => {
    const r = dispatch(
      'dining.reserve',
      { venue: 'restaurant', start: at('12:30', '2026-10-18'), partySize: 10 },
      layla,
    );
    expect(r.ok && r.value.state).toBe('requested');
    const id = r.ok ? r.value.id : '';
    expect(dispatch('dining.approveRequest', { reservationId: id }, elena).ok).toBe(false);
    const approved = dispatch(
      'dining.approveRequest',
      { reservationId: id, message: 'See you Sunday' },
      marco,
    );
    expect(approved.ok && approved.value.state).toBe('confirmed');
    expect(approved.ok && approved.value.tableIds.length).toBe(2);
  });
});

describe('cancel', () => {
  beforeEach(() => {
    reset(at('09:00'));
    sofiaTopUp(500);
  });

  it('a Teppanyaki cancellation within 24h forfeits the deposit', () => {
    const r = teppanyaki4();
    const cancelled = dispatch('dining.cancel', { reservationId: r.ok ? r.value.id : '' }, sofia);
    expect(cancelled.ok && cancelled.value.state).toBe('late_cancelled');
    expect(s().wallets[UNIT_IDS.sofia]?.balanceFils).toBe(aedToFils(620 - 400));
  });

  it('an on-time cancellation releases it', () => {
    const r = dispatch(
      'dining.reserve',
      { venue: 'teppanyaki', start: at('21:00', '2026-10-18'), partySize: 4 },
      sofia,
    );
    dispatch('dining.cancel', { reservationId: r.ok ? r.value.id : '' }, sofia);
    expect(avail(UNIT_IDS.sofia)).toBe(aedToFils(620));
  });
});

describe('party size', () => {
  beforeEach(() => {
    reset(at('09:00'));
    sofiaTopUp(500);
  });

  it('a cut more than 24h ahead refunds the deposit difference; within 24h it doesn’t', () => {
    const far = dispatch(
      'dining.reserve',
      { venue: 'teppanyaki', start: at('19:00', '2026-10-18'), partySize: 4 },
      sofia,
    );
    dispatch(
      'dining.changePartySize',
      { reservationId: far.ok ? far.value.id : '', partySize: 2 },
      sofia,
    );
    expect(avail(UNIT_IDS.sofia)).toBe(aedToFils(620 - 200));
    const near = dispatch(
      'dining.reserve',
      { venue: 'teppanyaki', start: at('21:00'), partySize: 2 },
      sofia,
    );
    dispatch(
      'dining.changePartySize',
      { reservationId: near.ok ? near.value.id : '', partySize: 1 },
      sofia,
    );
    expect(avail(UNIT_IDS.sofia)).toBe(aedToFils(620 - 200 - 200));
  });

  it('a party that outgrows its table on arrival is moved to one that fits', () => {
    const r = dispatch(
      'dining.reserve',
      { venue: 'restaurant', start: at('19:15'), partySize: 2 },
      layla,
    );
    const grown = dispatch(
      'dining.changePartySize',
      { reservationId: r.ok ? r.value.id : '', partySize: 5 },
      elena,
    );
    expect(
      grown.ok && grown.value.tableIds.reduce((n, t) => n + (s().tables[t]?.seats ?? 0), 0),
    ).toBeGreaterThanOrEqual(5);
  });
});

describe('the floor', () => {
  beforeEach(() => reset());

  it('moving to a table booked at the same time is refused', () => {
    const terrace = Object.values(s().reservations).find(
      (r) => r.start === at('20:00') && r.tableIds[0] === 'T11',
    )!;
    const clash = dispatch(
      'dining.moveTables',
      { reservationId: terrace.id, tableIds: ['T14'] },
      elena,
    );
    expect(!clash.ok && clash.error.code).toBe('SLOT_FULL');
    expect(
      dispatch('dining.moveTables', { reservationId: terrace.id, tableIds: ['T17'] }, elena).ok,
    ).toBe(true);
    expect(
      dispatch('dining.moveTables', { reservationId: terrace.id, tableIds: ['T1'] }, elena).ok,
    ).toBe(false); // 2 seats for 4
  });

  it('a walk-in takes a free table now', () => {
    const r = dispatch('dining.walkIn', { venue: 'restaurant', partySize: 3 }, elena);
    expect(r.ok && [r.value.state, r.value.walkIn]).toEqual(['seated', true]);
  });

  it('residents can’t run floor commands', () => {
    const terrace = Object.values(s().reservations).find((r) => r.start === at('20:00'))!;
    expect(dispatch('dining.seat', { reservationId: terrace.id }, sofia).ok).toBe(false);
  });
});

describe('no-shows', () => {
  beforeEach(() => reset());

  it('the job flags at +30; the host confirms; the Teppanyaki deposit is forfeited and the guest told', () => {
    const r = s().reservations[SEEDED_NO_SHOW_ID]!;
    setNow(at('21:10'));
    expect(dispatch('dining.markNoShow', { reservationId: r.id }, elena).ok).toBe(false); // still in grace
    const before = s().wallets[r.unitId]!.balanceFils;
    schedulerEngine.runDue(at('21:31'));
    expect(s().reservations[r.id]!.noShowFlaggedAt).toBe(at('21:30'));
    setNow(at('21:31'));
    expect(dispatch('dining.markNoShow', { reservationId: r.id }, elena).ok).toBe(true);
    expect(s().wallets[r.unitId]!.balanceFils).toBe(before - 20000);
    expect(
      Object.values(s().waMessages).some(
        (m) => m.threadResidentId === r.residentId && m.text.includes('deposit is kept'),
      ),
    ).toBe(true);
  });

  it('a second Restaurant no-show in 60 days puts a deposit on the next booking', () => {
    for (const [date, table] of [
      ['2026-10-17', 'T1'],
      ['2026-10-18', 'T2'],
    ] as const) {
      const r = dispatch(
        'dining.reserve',
        { venue: 'restaurant', start: at('19:00', date), partySize: 2 },
        james,
      );
      setNow(at('19:20', date));
      dispatch('dining.markNoShow', { reservationId: r.ok ? r.value.id : '' }, elena);
      void table;
    }
    dispatch('wallet.topUp', { unitId: UNIT_IDS.james, amountFils: aedToFils(500) }, james);
    const next = dispatch(
      'dining.reserve',
      { venue: 'restaurant', start: at('19:00', '2026-10-20'), partySize: 2 },
      james,
    );
    expect(next.ok && next.value.depositHoldId).toBeTruthy();
    expect(
      Object.values(s().notifications).some(
        (n) =>
          n.recipientId === PERSONA_IDS.james && n.body.includes('next 3 Restaurant reservations'),
      ),
    ).toBe(true);
  });

  it('the T−3h reminder goes to WhatsApp with Confirm / Cancel', () => {
    const r = s().reservations[SEEDED_NO_SHOW_ID]!;
    schedulerEngine.runDue(at('18:00'));
    const wa = Object.values(s().waMessages).find(
      (m) => m.threadResidentId === r.residentId && m.buttons?.length,
    );
    expect(wa?.buttons?.map((b) => b.label)).toEqual(['Confirm', 'Cancel']);
  });
});

describe('settlement', () => {
  function seatedSofia(topUp: number) {
    reset();
    sofiaTopUp(topUp);
    const r = teppanyaki4();
    setNow(at('21:02'));
    dispatch('dining.seat', { reservationId: r.ok ? r.value.id : '' }, elena);
    setNow(at('22:50'));
    return r.ok ? r.value.id : '';
  }

  it('applies the deposit and charges the rest to the wallet, with a receipt', () => {
    const id = seatedSofia(2000);
    const r = dispatch('dining.settle', { reservationId: id, totalFils: aedToFils(1520) }, elena);
    expect(r.ok && r.value.bill).toMatchObject({
      method: 'wallet',
      depositAppliedFils: 40000,
      chargedFils: 112000,
    });
    expect(s().wallets[UNIT_IDS.sofia]?.balanceFils).toBe(aedToFils(600));
    expect(avail(UNIT_IDS.sofia)).toBe(aedToFils(600));
    expect(Object.values(s().notifications).some((n) => n.title === 'Receipt · Teppanyaki')).toBe(
      true,
    );
  });

  it('PRD S5 as written (AED 500 top-up) falls back to the unit account, flagged', () => {
    const id = seatedSofia(500);
    const r = dispatch('dining.settle', { reservationId: id, totalFils: aedToFils(1520) }, elena);
    expect(r.ok && r.value.bill).toMatchObject({
      method: 'unit_account',
      depositAppliedFils: 40000,
      chargedFils: 112000,
    });
    expect(r.ok && r.value.bill?.flagged).toContain('unit account');
    expect(s().wallets[UNIT_IDS.sofia]?.balanceFils).toBe(aedToFils(220));
  });
});
