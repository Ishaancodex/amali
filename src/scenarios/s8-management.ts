/**
 * S8 — Management: reports and access (PRD §15, C6). One console, the
 * demo's role sub-switch: Community Manager → Amenity Supervisor →
 * Call-centre Agent.
 */
import { PERSONA_IDS, STAFF_IDS } from '@/seed/personaIds';
import { can } from '@/domain/rbac/can';
import { canOpenRoute } from '@/config/consoleAccess';
import {
  buildReport,
  REPORT_AMENITIES,
  REPORT_SECTIONS,
  reportScope,
} from '@/store/selectors/report';
import { sheetsForRole } from '@/features/reports/workbook';
import type { AppState } from '@/store/types';
import type { Scenario } from './types';

const START = '2026-10-14T13:30:00.000Z'; // Wed 14 Oct, 17:30 Dubai
const SLOT = '2026-10-15T15:00:00.000Z'; // Thu 19:00 Dubai
const LAST_30 = {
  from: '2026-09-14',
  to: '2026-10-13',
  amenities: [...REPORT_AMENITIES],
  towers: [],
  sections: [...REPORT_SECTIONS],
};

const AS = (role: 'community_manager' | 'amenity_supervisor' | 'call_centre') => ({
  kind: 'staff' as const,
  id: STAFF_IDS.cmHana,
  role,
});

const report = (s: AppState, role: 'community_manager' | 'amenity_supervisor') =>
  buildReport(s, LAST_30, role, undefined, START);

export const s8Management: Scenario = {
  id: 'S8',
  title: 'Management: reports and access',
  capability: ['C6'],
  startAt: START,

  steps: [
    {
      title: 'Community Manager: generate the last 30 days, export to Excel',
      body: 'Reports → Generate (last 30 days, all amenities). Utilisation, the peak heatmap (padel peaks weekday evenings and weekend mornings), the no-show rate, booking trends and revenue. Export to Excel: all eight sheets.',
      setup: {
        devices: {
          A: {
            role: 'console',
            actorId: STAFF_IDS.cmHana,
            consoleRole: 'community_manager',
            deepLink: 'amali://console/reports',
          },
        },
      },
      script: [
        {
          command: 'report.logExport',
          input: {
            from: LAST_30.from,
            to: LAST_30.to,
            sheets: [...sheetsForRole('community_manager')],
          },
          actor: AS('community_manager'),
        },
      ],
      expect: (s) => {
        const r = report(s, 'community_manager');
        const padel = r.utilisation.find((u) => u.amenity === 'padel');
        if (!padel?.value || padel.value <= 0) throw new Error('Expected padel utilisation');
        const top = r.peaks.find((p) => p.amenity === 'padel')?.cells[0];
        if (
          !top ||
          !((top.weekday <= 4 && top.hour >= 18) || (top.weekday >= 5 && top.hour < 12))
        ) {
          throw new Error(
            `Expected the padel peak on a weekday evening or weekend morning, got ${JSON.stringify(top)}`,
          );
        }
        const ns = r.noShows.byAmenity.find((n) => n.amenity === 'padel')?.noShowRate ?? 0;
        if (ns < 0.06 || ns > 0.12)
          throw new Error(`Expected a padel no-show rate near 9%, got ${ns}`);
        if (!r.revenue || r.revenue.total <= 0) throw new Error('Expected revenue for the CM');
        if (r.trends.daily.length !== 30) throw new Error('Expected 30 days of booking trends');
        if (sheetsForRole('community_manager').length !== 8)
          throw new Error('Expected all eight sheets');
        if (!s.auditLog.some((a) => a.action === 'report.export'))
          throw new Error('Expected the export logged');
      },
    },
    {
      title: 'Switch to Amenity Supervisor: revenue and Roles disappear; only Pool, Gym and Padel',
      body: 'The role sub-switch → Amenity Supervisor. The revenue section and sheet are gone, Roles & access leaves the navigation, and the report only covers Pool, Gym and Padel.',
      setup: {
        devices: {
          A: {
            role: 'console',
            actorId: STAFF_IDS.cmHana,
            consoleRole: 'amenity_supervisor',
            deepLink: 'amali://console/reports',
          },
        },
      },
      expect: (s) => {
        const r = report(s, 'amenity_supervisor');
        if (r.revenue) throw new Error('Expected no revenue for the supervisor');
        if ([...r.amenities].sort().join() !== 'gym,padel,pool')
          throw new Error(`Expected Pool, Gym, Padel, got ${r.amenities}`);
        if (sheetsForRole('amenity_supervisor').includes('Revenue'))
          throw new Error('Expected no Revenue sheet');
        if (canOpenRoute('amenity_supervisor', 'roles'))
          throw new Error('Expected Roles & access hidden');
        if (reportScope('amenity_supervisor', undefined).offenders)
          throw new Error('Expected no repeat-offender list');
      },
    },
    {
      title:
        'Call-centre Agent: book padel for Layla (a reason is required); masked phone with a logged Reveal',
      body: 'Switch to Call-centre Agent → Residents → Layla. The phone shows +971 50 ••• ••67; Reveal is logged. Book padel on her behalf — the button stays disabled until a reason is given. Reports and Export are gone.',
      setup: {
        devices: {
          A: {
            role: 'console',
            actorId: STAFF_IDS.cmHana,
            consoleRole: 'call_centre',
            deepLink: 'amali://console/residents',
          },
        },
      },
      script: [
        {
          command: 'pii.reveal',
          input: { residentId: PERSONA_IDS.layla, field: 'phone' },
          actor: AS('call_centre'),
        },
        {
          command: 'booking.bookOnBehalf',
          input: {
            residentId: PERSONA_IDS.layla,
            start: SLOT,
            durationMinutes: 60,
            players: [],
            reason: 'Layla called — her app is logged out',
          },
          actor: AS('call_centre'),
        },
      ],
      expect: (s) => {
        const booking = Object.values(s.bookings).find(
          (b) => b.bookerId === PERSONA_IDS.layla && b.start === SLOT,
        );
        if (booking?.source !== 'agent')
          throw new Error('Expected Layla’s booking made by the agent');
        const logged = s.auditLog.find((a) => a.action === 'booking.bookOnBehalf');
        if (!logged?.reason || logged.actor.role !== 'call_centre')
          throw new Error('Expected the on-behalf booking logged with its reason');
        if (!s.auditLog.some((a) => a.action === 'pii.reveal' && a.target.id === PERSONA_IDS.layla))
          throw new Error('Expected the reveal logged');
        if (sheetsForRole('call_centre').length !== 0 || canOpenRoute('call_centre', 'reports'))
          throw new Error('Expected export hidden');
      },
    },
    {
      title: 'Agent tries to open a blackout: no-permission state',
      body: 'Following a link to the padel blackout page as the agent shows the no-permission state — “Ask a Community Manager”.',
      setup: {
        devices: {
          A: {
            role: 'console',
            actorId: STAFF_IDS.cmHana,
            consoleRole: 'call_centre',
            deepLink: 'amali://console/blackout',
          },
        },
      },
      expect: () => {
        if (
          canOpenRoute('call_centre', 'blackout') ||
          can({ consoleRole: 'call_centre', capability: 'blackout.create' })
        ) {
          throw new Error('Expected the agent to be refused the blackout page');
        }
      },
    },
  ],
};
