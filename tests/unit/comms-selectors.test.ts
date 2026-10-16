import { describe, it, expect } from 'vitest';
import { selectActiveBannersForResident } from '@/store/selectors/comms';
import type { Announcement } from '@/types/comms';

const NOW = '2026-10-14T13:30:00.000Z';

function announcement(id: string, overrides: Partial<Announcement> = {}): Announcement {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    type: 'general',
    title: id,
    body: 'body',
    amenityTags: ['pool'],
    audience: { include: [{ kind: 'all' }], exclude: [] },
    channels: ['app_banner'],
    banner: { style: 'info', expiresAt: '2026-10-15T00:00:00.000Z' },
    schedule: { mode: 'now' },
    state: 'sent',
    sentAt: NOW,
    resolvedRecipientIds: ['res_layla'],
    createdBy: 'staff_1',
    ...overrides,
  };
}

describe('store/selectors/comms#selectActiveBannersForResident', () => {
  it('only returns banners targeted at this resident, not expired, not recalled', () => {
    const announcements: Record<string, Announcement> = {
      a1: announcement('a1'),
      a2: announcement('a2', { resolvedRecipientIds: ['res_sofia'] }),
      a3: announcement('a3', { banner: { style: 'info', expiresAt: '2026-10-14T00:00:00.000Z' } }),
      a4: announcement('a4', { state: 'recalled' }),
    };
    const result = selectActiveBannersForResident(announcements, 'res_layla', NOW);
    expect(result.map((a) => a.id)).toEqual(['a1']);
  });

  it('a later announcement with the same amenity tags supersedes an earlier one (e.g. "Reopened" over "Closed")', () => {
    const announcements: Record<string, Announcement> = {
      closed: announcement('closed', {
        amenityTags: ['pool'],
        banner: { style: 'urgent', expiresAt: '9999-12-31T23:59:59.000Z' },
      }),
      reopened: announcement('reopened', {
        amenityTags: ['pool'],
        banner: { style: 'success', expiresAt: '2026-10-15T00:00:00.000Z' },
      }),
    };
    const result = selectActiveBannersForResident(announcements, 'res_layla', NOW);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('reopened');
  });

  it('supersedes correctly even when both share the exact same sentAt (no clock movement between sends)', () => {
    const announcements: Record<string, Announcement> = {
      closed: announcement('closed', {
        sentAt: NOW,
        banner: { style: 'urgent', expiresAt: '9999-12-31T23:59:59.000Z' },
      }),
      reopened: announcement('reopened', {
        sentAt: NOW,
        banner: { style: 'success', expiresAt: '2026-10-15T00:00:00.000Z' },
      }),
    };
    const result = selectActiveBannersForResident(announcements, 'res_layla', NOW);
    expect(result[0]?.id).toBe('reopened');
  });

  it('keeps banners with different amenity tags separate', () => {
    const announcements: Record<string, Announcement> = {
      pool: announcement('pool', { amenityTags: ['pool'] }),
      gym: announcement('gym', { amenityTags: ['gym'] }),
    };
    const result = selectActiveBannersForResident(announcements, 'res_layla', NOW);
    expect(result.map((a) => a.id).sort()).toEqual(['gym', 'pool']);
  });
});
