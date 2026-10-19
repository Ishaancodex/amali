import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import '@/scheduler/registerJobs';
import { schedulerEngine } from '@/scheduler/engine';
import { buildSeed } from '@/seed';
import { arriveSeededMorning, sessionId } from '@/seed/creche';
import { CHILD_IDS, PERSONA_IDS, STAFF_IDS, UNIT_IDS } from '@/seed/personaIds';
import { selectBandLoads, selectBoardSession } from '@/store/selectors/creche';

const DATE = '2026-10-14';
const EARLY = '2026-10-14T03:30:00.000Z'; // 07:30 Dubai
const IN_SESSION = '2026-10-14T05:10:00.000Z'; // 09:10
const MORNING = sessionId(DATE, 'morning');

const layla = { kind: 'resident' as const, id: PERSONA_IDS.layla };
const james = { kind: 'resident' as const, id: PERSONA_IDS.james };
const maria = { kind: 'staff' as const, id: STAFF_IDS.crecheMaria, role: 'creche_lead' };
const grace = { kind: 'staff' as const, id: STAFF_IDS.crecheGrace, role: 'creche_carer' };
const hana = { kind: 'staff' as const, id: STAFF_IDS.cmHana, role: 'community_manager' };

function reset(now = EARLY): void {
  useStore.setState(buildSeed('amali-2026', now));
  schedulerEngine.queue.clear();
}
const s = () => useStore.getState();
const dispatch: ReturnType<typeof s>['dispatch'] = (...args) => s().dispatch(...args);
function setNow(now: string) {
  useStore.setState((d) => {
    d.demo.clock.now = now;
  });
}
function kids() {
  return selectBandLoads(s(), selectBoardSession(s(), s().demo.clock.now)).find(
    (l) => l.band === 'kids',
  )!;
}
function bookOmar() {
  const r = dispatch('creche.book', { childIds: [CHILD_IDS.omar], sessionId: MORNING }, layla);
  if (!r.ok) throw new Error(r.error.message);
  return r.value[0]!;
}
function graceShift() {
  return Object.values(s().shifts).find(
    (x) => x.staffId === STAFF_IDS.crecheGrace && x.date === DATE,
  )!;
}

describe('seed', () => {
  beforeEach(() => reset());

  it('staffs Kids with Grace and Aisha (16) and books 11 Kids into this morning', () => {
    const morningKids = Object.values(s().crecheBookings).filter(
      (b) => b.sessionId === MORNING && b.band === 'kids' && b.state === 'confirmed',
    );
    expect(morningKids).toHaveLength(11);
    expect(kids().capacity).toBe(16);
  });
});

describe('booking', () => {
  beforeEach(() => reset());

  it('books siblings together, each against their own band', () => {
    const r = dispatch(
      'creche.book',
      { childIds: [CHILD_IDS.omar, CHILD_IDS.noor], sessionId: MORNING },
      layla,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((b) => [b.band, b.state])).toEqual([
      ['kids', 'confirmed'],
      ['toddlers', 'confirmed'],
    ]);
  });

  it('only the child’s own unit can book', () => {
    const r = dispatch('creche.book', { childIds: [CHILD_IDS.omar], sessionId: MORNING }, james);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_ELIGIBLE');
  });

  it('waitlists when the band is full', () => {
    useStore.setState((d) => {
      const kidsToday = d.bandAssignments.find((a) => a.date === DATE && a.band === 'kids')!;
      kidsToday.staffIds = [STAFF_IDS.crecheGrace]; // 8 places, 11 already booked
    });
    expect(bookOmar().state).toBe('waitlisted');
  });

  it('cancelling frees a place for the waitlist', () => {
    useStore.setState((d) => {
      d.bandAssignments.find((a) => a.date === DATE && a.band === 'toddlers')!.staffIds = [];
    });
    const noor = dispatch('creche.book', { childIds: [CHILD_IDS.noor], sessionId: MORNING }, layla);
    expect(noor.ok && noor.value[0]!.state).toBe('waitlisted');
    const r = dispatch('creche.cancel', { bookingId: noor.ok ? noor.value[0]!.id : '' }, layla);
    expect(r.ok && r.value.state).toBe('cancelled');
  });
});

describe('check-in', () => {
  beforeEach(() => {
    reset();
    bookOmar();
    setNow(IN_SESSION);
  });

  it('needs the severe-allergy acknowledgement, then checks in and pushes the parent', () => {
    const blocked = dispatch(
      'creche.checkIn',
      { childId: CHILD_IDS.omar, guardianId: 'guardian_layla' },
      maria,
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('ALLERGY_ACK_REQUIRED');

    const r = dispatch(
      'creche.checkIn',
      { childId: CHILD_IDS.omar, guardianId: 'guardian_layla', allergyAck: true },
      maria,
    );
    expect(r.ok && r.value.state).toBe('checked_in');
    expect(
      Object.values(s().notifications).some(
        (n) => n.recipientId === PERSONA_IDS.layla && n.body.includes('by Maria'),
      ),
    ).toBe(true);
    expect(s().jobs['creche-late:' + (r.ok ? r.value.id : '')]).toBeDefined();
  });

  it('blocks an unauthorised guardian and non-staff', () => {
    const r = dispatch(
      'creche.checkIn',
      { childId: CHILD_IDS.omar, guardianId: 'guardian_seed_0', allergyAck: true },
      maria,
    );
    expect(!r.ok && r.error.code).toBe('GUARDIAN_NOT_AUTHORISED');
    const asResident = dispatch(
      'creche.checkIn',
      { childId: CHILD_IDS.omar, guardianId: 'guardian_layla', allergyAck: true },
      layla,
    );
    expect(!asResident.ok && asResident.error.code).toBe('NO_PERMISSION');
  });

  it('a sick carer drops capacity, blocks check-ins, and cover restores it', () => {
    useStore.setState((d) => arriveSeededMorning(d, DATE));
    expect(dispatch('roster.markSick', { shiftId: graceShift().id }, hana).ok).toBe(true);
    expect(kids()).toMatchObject({ capacity: 8, inRoom: 11, overBy: 3 });

    const blocked = dispatch(
      'creche.checkIn',
      { childId: CHILD_IDS.omar, guardianId: 'guardian_layla', allergyAck: true },
      maria,
    );
    // Omar hadn't arrived, so the roster change already moved him to the waitlist.
    expect(!blocked.ok && blocked.error.message).toBe(
      'Omar Al Mansoori is on the waitlist for this session.',
    );

    expect(
      dispatch('creche.addCover', { band: 'kids', staffId: STAFF_IDS.crecheMaria }, grace).ok,
    ).toBe(false);
    expect(
      dispatch('creche.addCover', { band: 'kids', staffId: STAFF_IDS.crecheMaria }, maria).ok,
    ).toBe(true);
    expect(kids()).toMatchObject({ capacity: 16, overBy: 0 });
    expect(
      dispatch(
        'creche.checkIn',
        { childId: CHILD_IDS.omar, guardianId: 'guardian_layla', allergyAck: true },
        maria,
      ).ok,
    ).toBe(true);
  });

  it('a walk-in with spare capacity becomes a booking on the running session', () => {
    const r = dispatch(
      'creche.checkIn',
      { childId: CHILD_IDS.noor, guardianId: 'guardian_layla' },
      maria,
    );
    expect(r.ok).toBe(true);
    if (r.ok)
      expect([r.value.sessionId, r.value.band, r.value.state]).toEqual([
        MORNING,
        'toddlers',
        'checked_in',
      ]);
  });
});

describe('sick carer before arrivals', () => {
  beforeEach(() => reset());

  it('moves the latest bookings to the waitlist, notifies, and confirms them again on recovery', () => {
    const omar = bookOmar(); // 12th Kids booking, the latest
    dispatch('roster.markSick', { shiftId: graceShift().id }, hana);
    const waitlisted = Object.values(s().crecheBookings).filter(
      (b) => b.sessionId === MORNING && b.band === 'kids' && b.state === 'waitlisted',
    );
    expect(waitlisted).toHaveLength(4);
    expect(s().crecheBookings[omar.id]!.state).toBe('waitlisted');
    expect(
      Object.values(s().waMessages).some(
        (m) => m.threadResidentId === PERSONA_IDS.layla && m.text.includes('waitlist'),
      ),
    ).toBe(true);

    dispatch(
      'roster.assignBand',
      { date: DATE, band: 'kids', staffIds: [STAFF_IDS.crecheAisha, STAFF_IDS.crecheMaria] },
      hana,
    );
    expect(s().crecheBookings[omar.id]!.state).toBe('confirmed');
  });
});

describe('check-out', () => {
  let bookingId = '';
  beforeEach(() => {
    reset();
    bookingId = bookOmar().id;
    setNow(IN_SESSION);
    dispatch(
      'creche.checkIn',
      { childId: CHILD_IDS.omar, guardianId: 'guardian_layla', allergyAck: true },
      maria,
    );
  });

  it('an unauthorised collector waits for the parent; deny blocks, approve completes', () => {
    const req = dispatch(
      'creche.requestCollectorApproval',
      { bookingId, collectorName: 'Joy', collectorPhoto: 'JS' },
      maria,
    );
    expect(req.ok).toBe(true);
    const approvalId = req.ok ? req.value.id : '';
    expect(!dispatch('creche.checkOut', { bookingId }, maria).ok).toBe(true);
    expect(
      dispatch('creche.decideApproval', { bookingId, approvalId, decision: 'approved' }, james).ok,
    ).toBe(false);
    expect(
      dispatch('creche.decideApproval', { bookingId, approvalId, decision: 'denied' }, layla).ok,
    ).toBe(true);
    const denied = dispatch('creche.checkOut', { bookingId }, maria);
    expect(!denied.ok && denied.error.message).toBe('The parent denied this pickup.');
  });

  it('blocks an expired guardian with the reason', () => {
    useStore.setState((d) => {
      d.children[CHILD_IDS.omar]!.guardianIds.push('guardian_seed_1_nanny');
    });
    const r = dispatch(
      'creche.checkOut',
      { bookingId, guardianId: 'guardian_seed_1_nanny' },
      maria,
    );
    expect(!r.ok && r.error.message).toBe("Rosa Dela Cruz's authorisation expired.");
  });

  it('charges the late fee to the wallet after grace, and the job chases the parent', () => {
    const before = s().wallets[UNIT_IDS.layla]!.balanceFils;
    schedulerEngine.runDue('2026-10-14T08:10:00.000Z'); // 12:10 — grace just over
    expect(s().crecheBookings[bookingId]!.latePickupNotifiedAt).toBeDefined();
    setNow('2026-10-14T08:26:00.000Z'); // 16 min past grace → 2 × AED 50
    const r = dispatch('creche.checkOut', { bookingId, guardianId: 'guardian_khalid' }, maria);
    expect(r.ok && r.value.lateFeeFils).toBe(10000);
    expect(s().wallets[UNIT_IDS.layla]!.balanceFils).toBe(before - 10000);
  });

  it('tells the parent about a Low incident at check-out; Medium goes straight away', () => {
    dispatch(
      'creche.logIncident',
      {
        childId: CHILD_IDS.omar,
        type: 'minor_injury',
        severity: 'low',
        description: 'Scrape.',
        firstAid: true,
      },
      maria,
    );
    dispatch(
      'creche.logIncident',
      {
        childId: CHILD_IDS.omar,
        type: 'illness',
        severity: 'medium',
        description: 'Temperature.',
        firstAid: false,
      },
      maria,
    );
    const [low, medium] = Object.values(s().incidents).sort((a, b) =>
      a.severity.localeCompare(b.severity),
    );
    expect(low!.parentNotifiedAt).toBeUndefined();
    expect(medium!.parentNotifiedAt).toBeDefined();
    dispatch('creche.checkOut', { bookingId, guardianId: 'guardian_layla' }, maria);
    expect(s().incidents[low!.id]!.parentNotifiedAt).toBeDefined();
    expect(dispatch('creche.acknowledgeIncident', { incidentId: low!.id }, layla).ok).toBe(true);
    expect(s().incidents[low!.id]!.parentAck?.by).toBe(PERSONA_IDS.layla);
  });

  it('the end-of-day sweep flags a child still checked in for the lead to resolve', () => {
    schedulerEngine.runDue('2026-10-14T14:30:00.000Z'); // 18:30
    expect(s().crecheBookings[bookingId]!.flaggedAtSweep).toBeDefined();
    expect(
      Object.values(s().notifications).some(
        (n) => n.recipientId === STAFF_IDS.crecheMaria && n.title === 'End-of-day sweep',
      ),
    ).toBe(true);
    expect(
      dispatch('creche.resolveSweep', { bookingId, note: 'Parent collected, not scanned' }, maria)
        .ok,
    ).toBe(true);
  });
});

describe('registration and guardians', () => {
  beforeEach(() => reset());

  it('registers a child against the unit with its residents as guardians; rejects under 2 and over 12', () => {
    const base = { photoConsent: true, emergencyContact: { name: 'Layla', phone: '1' } };
    const r = dispatch('creche.registerChild', { ...base, name: 'Sara', dob: '2020-01-01' }, layla);
    expect(r.ok && r.value.unitId).toBe(UNIT_IDS.layla);
    if (r.ok)
      expect(r.value.guardianIds).toEqual(
        expect.arrayContaining(['guardian_layla', 'guardian_khalid']),
      );
    const baby = dispatch(
      'creche.registerChild',
      { ...base, name: 'Baby', dob: '2025-06-01' },
      layla,
    );
    expect(!baby.ok && baby.error.code).toBe('AGE_RESTRICTED');
    const teen = dispatch(
      'creche.registerChild',
      { ...base, name: 'Teen', dob: '2012-01-01' },
      layla,
    );
    expect(!teen.ok && teen.error.message).toBe('Teen zone is not supervised.');
  });

  it('a nanny needs a photo and the lead’s approval', () => {
    const input = {
      childId: CHILD_IDS.omar,
      name: 'Joy Santos',
      relation: 'Nanny',
      phone: '1',
      photo: '',
      idLast4: '4321',
    };
    expect(dispatch('creche.addGuardian', input, layla).ok).toBe(false);
    const r = dispatch('creche.addGuardian', { ...input, photo: 'JS' }, layla);
    expect(r.ok && r.value.approval).toBe('pending');
    const id = r.ok ? r.value.id : '';
    expect(
      dispatch('creche.decideGuardian', { guardianId: id, decision: 'approved' }, grace).ok,
    ).toBe(false);
    expect(
      dispatch('creche.decideGuardian', { guardianId: id, decision: 'approved' }, maria).ok,
    ).toBe(true);
  });
});
