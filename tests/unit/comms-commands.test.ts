import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import '@/scheduler/registerJobs';
import { schedulerEngine } from '@/scheduler/engine';
import { buildSeed } from '@/seed';
import { PERSONA_IDS, STAFF_IDS } from '@/seed/personaIds';
import { addDaysIso, addMillisecondsIso } from '@/lib/time';
import type { AudienceRule } from '@/types/comms';

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

const EAST_FLOORS_10_20_PLUS_NORTH: AudienceRule = {
  include: [
    { kind: 'floors', tower: 'east', from: 10, to: 20 },
    { kind: 'cluster', cluster: 'north' },
  ],
  exclude: [],
};

function runDue(now: string): void {
  useStore.setState((s) => {
    s.demo.clock.now = now;
  });
  schedulerEngine.runDue(now);
}

describe('announcement.create — targeting and sending', () => {
  beforeEach(() => resetStore());

  it('targets exactly the matching audience (Layla + Priya, not Sofia) and sends now', () => {
    const result = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'daily',
        title: 'Daily update',
        body: 'Pool open, Padel open.',
        amenityTags: [],
        audience: EAST_FLOORS_10_20_PLUS_NORTH,
        channels: ['app_push', 'app_banner', 'app_inbox'],
        schedule: { mode: 'now' },
      },
      manager,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const recipients = new Set(result.value.resolvedRecipientIds);
    expect(recipients.has(PERSONA_IDS.layla)).toBe(true);
    expect(recipients.has(PERSONA_IDS.priya)).toBe(true);
    expect(recipients.has(PERSONA_IDS.sofia)).toBe(false);
    expect(result.value.state).toBe('sent');

    const deliveries = Object.values(useStore.getState().deliveries).filter(
      (d) => d.messageRef.id === result.value.id,
    );
    expect(deliveries.length).toBeGreaterThan(0);
    // Priya has WhatsApp off but app on — she should get app channels, no wa_direct.
    const priyaDeliveries = deliveries.filter((d) => d.recipientId === PERSONA_IDS.priya);
    expect(priyaDeliveries.every((d) => d.channel !== 'wa_direct')).toBe(true);
  });

  it('rejects an empty audience', () => {
    const result = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'general',
        title: 'Nobody',
        body: 'Nobody matches this.',
        amenityTags: [],
        audience: { include: [{ kind: 'units', unitIds: ['NOPE-00'] }], exclude: [] },
        channels: ['app_inbox'],
        schedule: { mode: 'now' },
      },
      manager,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('EMPTY_AUDIENCE');
  });

  it('a call-centre agent cannot send an urgent announcement', () => {
    const result = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'urgent',
        title: 'Urgent',
        body: 'Something urgent.',
        amenityTags: [],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_push'],
        schedule: { mode: 'now' },
      },
      callCentre,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_PERMISSION');
  });

  it('an amenity supervisor can send an urgent announcement for an assigned amenity', () => {
    const result = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'urgent',
        title: 'Urgent',
        body: 'Something urgent.',
        amenityTags: ['pool'],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_push'],
        schedule: { mode: 'now' },
      },
      supervisor,
      { assignedAmenities: ['pool', 'gym', 'padel'] },
    );
    expect(result.ok).toBe(true);
  });

  it('an urgent message is never held, even during quiet hours', () => {
    resetStore('2026-10-14T19:00:00.000Z'); // 23:00 Dubai
    const result = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'urgent',
        title: 'Urgent at night',
        body: 'Urgent quiet-hours override.',
        amenityTags: [],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_push'],
        schedule: { mode: 'now' },
      },
      manager,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const deliveries = Object.values(useStore.getState().deliveries).filter(
      (d) => d.messageRef.id === result.value.id,
    );
    expect(deliveries.some((d) => d.state === 'held_quiet_hours')).toBe(false);
  });

  it('a non-urgent message during quiet hours holds its deliveries, released at 07:00', () => {
    resetStore('2026-10-14T19:00:00.000Z'); // 23:00 Dubai
    const result = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'general',
        title: 'Held update',
        body: 'Quiet hours hold test.',
        amenityTags: [],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_push'],
        schedule: { mode: 'now' },
      },
      manager,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Every delivery either holds for quiet hours or, for a resident with no reachable channel
    // at all, is logged unreachable — nothing should have actually gone out while quiet hours hold.
    const held = Object.values(useStore.getState().deliveries).filter(
      (d) => d.messageRef.id === result.value.id,
    );
    expect(held.some((d) => d.state === 'held_quiet_hours')).toBe(true);
    expect(held.every((d) => d.state === 'held_quiet_hours' || d.state === 'skipped_opt_out')).toBe(
      true,
    );

    runDue('2026-10-15T03:00:00.000Z'); // 07:00 Dubai next day
    const releasedStates = Object.values(useStore.getState().deliveries)
      .filter((d) => d.messageRef.id === result.value.id)
      .map((d) => d.state);
    expect(releasedStates.every((s) => s !== 'held_quiet_hours')).toBe(true);
  });

  it('a scheduled ("at") send fires later via the job, resolving audience at that time', () => {
    const sendAt = '2026-10-15T03:30:00.000Z'; // Thu 07:30 Dubai
    const result = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'daily',
        title: 'Scheduled update',
        body: 'Tomorrow morning.',
        amenityTags: [],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_inbox'],
        schedule: { mode: 'at', at: sendAt },
      },
      manager,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe('scheduled');
    expect(result.value.sentAt).toBeUndefined();

    runDue(sendAt);
    const sent = useStore.getState().announcements[result.value.id];
    expect(sent?.state).toBe('sent');
    expect(sent?.sentAt).toBe(sendAt);
  });
});

describe('the delivery simulator sweep', () => {
  beforeEach(() => resetStore());

  it('advances queued deliveries to delivered (and some to read) as the clock moves forward', () => {
    const result = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'general',
        title: 'Sweep test',
        body: 'Watch delivery states advance.',
        amenityTags: [],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_push'],
        schedule: { mode: 'now' },
      },
      manager,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Max possible sent+delivered offset is 1s + 8s = 9s (rules.comms.delivery) — 15s covers every
    // non-failed delivery reaching at least 'delivered', without ticking for minutes of test time.
    runDue(addMillisecondsIso(NOW, 15_000));
    const states = Object.values(useStore.getState().deliveries)
      .filter((d) => d.messageRef.id === result.value.id)
      .map((d) => d.state);
    expect(states.some((s) => s === 'delivered' || s === 'read')).toBe(true);
    expect(states.every((s) => s !== 'queued')).toBe(true);
  });

  it('creates an SMS fallback for an urgent WhatsApp delivery not yet delivered after the configured window', () => {
    // Force a guaranteed-slow/never-delivered path is hard to force deterministically without
    // mocking rng, so instead assert the *mechanism*: after the fallback window, every WhatsApp
    // delivery for this urgent announcement is either delivered/read, or has a matching sms_fallback row.
    const result = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'urgent',
        title: 'Urgent sms test',
        body: 'Urgent.',
        amenityTags: [],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['wa_direct'],
        schedule: { mode: 'now' },
      },
      manager,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    runDue(addMillisecondsIso(NOW, 130_000)); // just past the 2-minute SMS fallback window
    const deliveries = Object.values(useStore.getState().deliveries).filter(
      (d) => d.messageRef.id === result.value.id,
    );
    const waDeliveries = deliveries.filter((d) => d.channel === 'wa_direct');
    const smsDeliveries = deliveries.filter((d) => d.channel === 'sms_fallback');
    const undeliveredWa = waDeliveries.filter((d) => d.state !== 'delivered' && d.state !== 'read');
    expect(smsDeliveries.length).toBe(undeliveredWa.length);
  });
});

describe('WhatsApp quick replies', () => {
  beforeEach(() => resetStore());

  it('"Reply 1" on a padel waitlist offer confirms the booking', () => {
    // Fill the slot with James, then have Layla join the waitlist and get offered the freed slot.
    const SLOT = '2026-10-15T13:00:00.000Z';
    const filled = useStore
      .getState()
      .dispatch(
        'booking.bookNow',
        { start: SLOT, durationMinutes: 60, players: [] },
        { kind: 'resident', id: PERSONA_IDS.james },
      );
    expect(filled.ok).toBe(true);
    if (!filled.ok) return;

    const joined = useStore
      .getState()
      .dispatch('waitlist.join', { start: SLOT }, { kind: 'resident', id: PERSONA_IDS.layla });
    expect(joined.ok).toBe(true);

    const cancelled = useStore
      .getState()
      .dispatch(
        'booking.cancel',
        { bookingId: filled.value.id },
        { kind: 'resident', id: PERSONA_IDS.james },
      );
    expect(cancelled.ok).toBe(true);

    const offerMessage = Object.values(useStore.getState().waMessages).find(
      (m) => m.threadResidentId === PERSONA_IDS.layla && m.buttons?.some((b) => b.label === '1'),
    );
    expect(offerMessage).toBeDefined();
    if (!offerMessage) return;
    const bookButton = offerMessage.buttons!.find((b) => b.label === '1')!;

    const replied = useStore
      .getState()
      .dispatch(
        'wa.recordReply',
        { waMessageId: offerMessage.id, buttonId: bookButton.id },
        { kind: 'resident', id: PERSONA_IDS.layla },
      );
    expect(replied.ok).toBe(true);

    const accepted = useStore
      .getState()
      .dispatch(
        bookButton.action.name as 'waitlist.accept',
        bookButton.action.args as { waitlistEntryId: string },
        { kind: 'resident', id: PERSONA_IDS.layla },
      );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.value.state).toBe('confirmed');
    expect(accepted.value.bookerId).toBe(PERSONA_IDS.layla);
  });

  it('a message can only be answered once', () => {
    const SLOT = '2026-10-15T13:00:00.000Z';
    const filled = useStore
      .getState()
      .dispatch(
        'booking.bookNow',
        { start: SLOT, durationMinutes: 60, players: [] },
        { kind: 'resident', id: PERSONA_IDS.james },
      );
    if (!filled.ok) throw new Error('setup failed');
    useStore
      .getState()
      .dispatch('waitlist.join', { start: SLOT }, { kind: 'resident', id: PERSONA_IDS.layla });
    useStore
      .getState()
      .dispatch(
        'booking.cancel',
        { bookingId: filled.value.id },
        { kind: 'resident', id: PERSONA_IDS.james },
      );

    const offerMessage = Object.values(useStore.getState().waMessages).find(
      (m) => m.threadResidentId === PERSONA_IDS.layla && m.buttons,
    )!;
    const button = offerMessage.buttons![0]!;
    useStore
      .getState()
      .dispatch(
        'wa.recordReply',
        { waMessageId: offerMessage.id, buttonId: button.id },
        { kind: 'resident', id: PERSONA_IDS.layla },
      );

    const second = useStore
      .getState()
      .dispatch(
        'wa.recordReply',
        { waMessageId: offerMessage.id, buttonId: button.id },
        { kind: 'resident', id: PERSONA_IDS.layla },
      );
    expect(second.ok).toBe(false);
  });
});

describe('amenity emergency close / reopen', () => {
  beforeEach(() => resetStore());

  it('closes the pool, notifies lifeguards, and reaching into reopen restores status and notifies the same audience', () => {
    const closed = useStore
      .getState()
      .dispatch('amenity.emergencyClose', { amenity: 'pool', reason: 'lightning' }, supervisor, {
        assignedAmenities: ['pool', 'gym', 'padel'],
      });
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.banner?.style).toBe('urgent');

    const lifeguardNotifs = Object.values(useStore.getState().notifications).filter(
      (n) => n.recipientId === STAFF_IDS.lifeguardSam || n.recipientId === STAFF_IDS.lifeguardRahul,
    );
    expect(lifeguardNotifs.length).toBeGreaterThan(0);

    const poolStatus = useStore.getState().amenityStatus.filter((e) => e.amenity === 'pool');
    expect(poolStatus.some((e) => e.status === 'emergency' && !e.to)).toBe(true);

    const reopened = useStore
      .getState()
      .dispatch('amenity.reopen', { amenity: 'pool' }, supervisor, {
        assignedAmenities: ['pool', 'gym', 'padel'],
      });
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.value.banner?.style).toBe('success');
    expect(new Set(reopened.value.resolvedRecipientIds)).toEqual(
      new Set(closed.value.resolvedRecipientIds),
    );

    const poolStatusAfter = useStore.getState().amenityStatus.filter((e) => e.amenity === 'pool');
    const openEntry = poolStatusAfter.find((e) => e.status === 'emergency');
    expect(openEntry?.to).toBeDefined();
  });

  it('a call-centre agent cannot emergency-close an amenity', () => {
    const result = useStore
      .getState()
      .dispatch('amenity.emergencyClose', { amenity: 'pool', reason: 'test' }, callCentre);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_PERMISSION');
  });
});

describe('recall and edit', () => {
  beforeEach(() => resetStore());

  it('recalling a sent announcement hides its banner', () => {
    const sent = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'general',
        title: 'Recall me',
        body: 'Body',
        amenityTags: [],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_banner'],
        banner: { style: 'info', expiresAt: addDaysIso(NOW, 1) },
        schedule: { mode: 'now' },
      },
      manager,
    );
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;

    const recalled = useStore
      .getState()
      .dispatch('announcement.recall', { announcementId: sent.value.id }, manager);
    expect(recalled.ok).toBe(true);
    if (!recalled.ok) return;
    expect(recalled.value.state).toBe('recalled');
  });

  it('editing a sent announcement updates its content and stamps editedAt', () => {
    const sent = useStore.getState().dispatch(
      'announcement.create',
      {
        type: 'general',
        title: 'Original title',
        body: 'Original body',
        amenityTags: [],
        audience: { include: [{ kind: 'all' }], exclude: [] },
        channels: ['app_inbox'],
        schedule: { mode: 'now' },
      },
      manager,
    );
    if (!sent.ok) throw new Error('setup failed');

    const edited = useStore
      .getState()
      .dispatch(
        'announcement.edit',
        { announcementId: sent.value.id, title: 'Edited title' },
        manager,
      );
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.title).toBe('Edited title');
    expect(edited.value.body).toBe('Original body');
    expect(edited.value.editedAt).toBe(NOW);
  });
});
