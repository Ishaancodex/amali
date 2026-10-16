/**
 * S7 — Communication: the daily update and an urgent closure (PRD §15, C4).
 */
import { PERSONA_IDS, STAFF_IDS } from '@/seed/personaIds';
import { addHoursIso } from '@/lib/time';
import type { Scenario } from './types';
import type { AudienceRule } from '@/types/comms';

const MANAGER = { kind: 'staff' as const, id: STAFF_IDS.cmHana, role: 'community_manager' };
const SUPERVISOR = {
  kind: 'staff' as const,
  id: STAFF_IDS.supervisorVictor,
  role: 'amenity_supervisor',
};

const START = '2026-10-14T13:30:00.000Z'; // Wed 14 Oct, 17:30 Dubai
const TOMORROW_0730_DUBAI = '2026-10-15T03:30:00.000Z';

const EAST_10_20_PLUS_NORTH: AudienceRule = {
  include: [
    { kind: 'floors', tower: 'east', from: 10, to: 20 },
    { kind: 'cluster', cluster: 'north' },
  ],
  exclude: [],
};

export const s7Comms: Scenario = {
  id: 'S7',
  title: 'Communication: the daily update and an urgent closure',
  capability: ['C4'],
  startAt: START,

  steps: [
    {
      title:
        'Console schedules the Daily update for tomorrow 07:30, then sends a second update now',
      body: 'Target East Tower floors 10-20 + North villas. Schedule the Daily template for 07:30 tomorrow, then send a second, immediate update to the same audience.',
      setup: {
        devices: {
          A: { role: 'console', actorId: STAFF_IDS.cmHana, consoleRole: 'community_manager' },
        },
      },
      script: [
        {
          command: 'announcement.create',
          input: {
            type: 'daily',
            title: 'Daily amenity update',
            body: 'Good morning, Amali. Today: Pool open, Padel open, Screening Room open.',
            amenityTags: [],
            audience: EAST_10_20_PLUS_NORTH,
            channels: ['app_push', 'app_banner', 'app_inbox'],
            schedule: { mode: 'at', at: TOMORROW_0730_DUBAI },
          },
          actor: MANAGER,
        },
        {
          command: 'announcement.create',
          input: {
            type: 'general',
            title: 'Lobby carpet cleaning tonight',
            body: 'The East lobby carpet will be cleaned between 22:00-23:00 tonight. Please use the side entrance.',
            amenityTags: [],
            audience: EAST_10_20_PLUS_NORTH,
            channels: ['app_push', 'app_banner', 'app_inbox', 'wa_direct', 'wa_channel'],
            banner: { style: 'info', expiresAt: addHoursIso(START, 12) },
            schedule: { mode: 'now' },
          },
          actor: MANAGER,
        },
      ],
      expect: (s) => {
        const scheduled = Object.values(s.announcements).find(
          (a) => a.title === 'Daily amenity update',
        );
        if (scheduled?.state !== 'scheduled')
          throw new Error('Expected the daily update to be scheduled, not sent');

        const sent = Object.values(s.announcements).find(
          (a) => a.title === 'Lobby carpet cleaning tonight',
        );
        if (sent?.state !== 'sent')
          throw new Error('Expected the second update to have sent immediately');
        const recipients = new Set(sent.resolvedRecipientIds);
        if (!recipients.has(PERSONA_IDS.layla))
          throw new Error('Expected Layla (East 18) to be targeted');
        if (!recipients.has(PERSONA_IDS.priya))
          throw new Error('Expected Priya (North villa) to be targeted');
        if (recipients.has(PERSONA_IDS.sofia))
          throw new Error('Expected Sofia (West) to NOT be targeted');
      },
    },
    {
      title:
        'Dual view: Layla and Priya both get the banner; Sofia does not; Priya gets no WhatsApp',
      body: "Switch between personas to prove targeting: Layla and Priya (East 18 / North villa) see the banner, Sofia (West) doesn't. Priya is opted out of WhatsApp, so she only gets the app channels.",
      setup: {
        dualView: true,
        devices: {
          A: { role: 'resident', actorId: PERSONA_IDS.layla },
          B: { role: 'resident', actorId: PERSONA_IDS.priya },
        },
      },
      expect: (s) => {
        const sent = Object.values(s.announcements).find(
          (a) => a.title === 'Lobby carpet cleaning tonight',
        );
        if (!sent) throw new Error('Expected the sent announcement to exist');

        const priyaDeliveries = Object.values(s.deliveries).filter(
          (d) => d.messageRef.id === sent.id && d.recipientId === PERSONA_IDS.priya,
        );
        if (priyaDeliveries.some((d) => d.channel === 'wa_direct')) {
          throw new Error(
            "Expected Priya to get no wa_direct delivery — she's opted out of WhatsApp",
          );
        }
        if (priyaDeliveries.length === 0)
          throw new Error('Expected Priya to still get app channels');

        const sofiaReached = (sent.resolvedRecipientIds ?? []).includes(PERSONA_IDS.sofia);
        if (sofiaReached) throw new Error('Expected Sofia to be outside the targeted audience');
      },
    },
    {
      title: 'The delivery funnel fills live — Channel views vs 1:1 read receipts',
      body: 'Show the difference: the WhatsApp Channel post counts aggregate views only; the 1:1 template shows per-recipient delivered/read ticks.',
      setup: {
        clock: '2026-10-14T13:31:00.000Z',
        devices: {
          A: { role: 'console', actorId: STAFF_IDS.cmHana, consoleRole: 'community_manager' },
        },
      },
      expect: (s) => {
        const sent = Object.values(s.announcements).find(
          (a) => a.title === 'Lobby carpet cleaning tonight',
        );
        if (!sent) throw new Error('Expected the sent announcement to exist');
        const post = Object.values(s.channelPosts).find((p) => p.announcementId === sent.id);
        if (!post) throw new Error('Expected a Channel post for the broadcast channel');
        const waDeliveries = Object.values(s.deliveries).filter(
          (d) => d.messageRef.id === sent.id && d.channel === 'wa_direct',
        );
        if (waDeliveries.length === 0)
          throw new Error('Expected at least one 1:1 WhatsApp delivery');
      },
    },
    {
      title: 'Supervisor emergency-closes the Pool',
      body: 'Lightning. Every channel, island notification, pinned red banner, and the guard\'s "Clear the pool" alert all appear at once.',
      setup: {
        dualView: true,
        devices: {
          A: { role: 'resident', actorId: PERSONA_IDS.layla },
          B: { role: 'guard', actorId: 'staff_sam' },
        },
      },
      script: [
        {
          command: 'amenity.emergencyClose',
          input: { amenity: 'pool', reason: 'lightning' },
          actor: SUPERVISOR,
          assignedAmenities: ['pool', 'gym', 'padel'],
        },
      ],
      expect: (s) => {
        const poolStatus = s.amenityStatus.filter((e) => e.amenity === 'pool');
        if (!poolStatus.some((e) => e.status === 'emergency' && !e.to))
          throw new Error('Expected the pool to be in emergency status');

        const closure = Object.values(s.announcements).find(
          (a) => a.type === 'urgent' && a.amenityTags.includes('pool'),
        );
        if (!closure || closure.state !== 'sent')
          throw new Error('Expected an urgent closure announcement to have sent');
        if (!(closure.resolvedRecipientIds ?? []).includes(PERSONA_IDS.layla)) {
          throw new Error('Expected Layla to be reached by the closure');
        }

        const guardAlert = Object.values(s.notifications).find(
          (n) => n.recipientId === 'staff_sam' && n.title.toLowerCase().includes('clear'),
        );
        if (!guardAlert) throw new Error("Expected the lifeguard to get a 'Clear the pool' alert");
      },
    },
    {
      title: 'Reopened — the banner turns green',
      body: 'Send "Reopened": the pinned red banner is replaced by a green Reopened banner.',
      setup: {
        devices: {
          A: {
            role: 'console',
            actorId: STAFF_IDS.supervisorVictor,
            consoleRole: 'amenity_supervisor',
          },
        },
      },
      script: [
        {
          command: 'amenity.reopen',
          input: { amenity: 'pool' },
          actor: SUPERVISOR,
          assignedAmenities: ['pool', 'gym', 'padel'],
        },
      ],
      expect: (s) => {
        const poolStatus = s.amenityStatus.filter((e) => e.amenity === 'pool');
        const emergencyEntry = poolStatus.find((e) => e.status === 'emergency');
        if (!emergencyEntry?.to)
          throw new Error('Expected the emergency status entry to be closed off');
        if (!poolStatus.some((e) => e.status === 'open' && !e.to))
          throw new Error('Expected the pool to be open again');

        const reopened = Object.values(s.announcements).find((a) => a.title.includes('reopened'));
        if (reopened?.banner?.style !== 'success')
          throw new Error('Expected the reopened banner to be green ("success")');
      },
    },
  ],
};
