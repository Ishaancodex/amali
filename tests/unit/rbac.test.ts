import { describe, it, expect } from 'vitest';
import { can } from '@/domain/rbac/can';

describe('domain/rbac/can — PRD §8.11 matrix', () => {
  it('community manager can view revenue; amenity supervisor cannot', () => {
    expect(can({ consoleRole: 'community_manager', capability: 'revenue.view' })).toBe(true);
    expect(can({ consoleRole: 'amenity_supervisor', capability: 'revenue.view' })).toBe(false);
  });

  it('amenity supervisor can change status only for assigned amenities', () => {
    expect(
      can({
        consoleRole: 'amenity_supervisor',
        capability: 'amenity_status_hours.change',
        amenity: 'pool',
        assignedAmenities: ['pool', 'gym', 'padel'],
      }),
    ).toBe(true);
    expect(
      can({
        consoleRole: 'amenity_supervisor',
        capability: 'amenity_status_hours.change',
        amenity: 'dining',
        assignedAmenities: ['pool', 'gym', 'padel'],
      }),
    ).toBe(false);
  });

  it('call-centre agent can book on behalf but cannot create blackouts or export reports', () => {
    expect(can({ consoleRole: 'call_centre', capability: 'booking.on_behalf' })).toBe(true);
    expect(can({ consoleRole: 'call_centre', capability: 'blackout.create' })).toBe(false);
    expect(can({ consoleRole: 'call_centre', capability: 'reports.export' })).toBe(false);
  });

  it('only the community manager can edit booking rules or manage roles/access', () => {
    expect(can({ consoleRole: 'community_manager', capability: 'booking_rules.edit' })).toBe(true);
    expect(can({ consoleRole: 'amenity_supervisor', capability: 'booking_rules.edit' })).toBe(false);
    expect(can({ consoleRole: 'community_manager', capability: 'roles_access.manage' })).toBe(true);
    expect(can({ consoleRole: 'call_centre', capability: 'roles_access.manage' })).toBe(false);
  });

  it('amenity supervisor can send urgent announcements community-wide', () => {
    expect(can({ consoleRole: 'amenity_supervisor', capability: 'announcement.compose_urgent' })).toBe(
      true,
    );
  });
});
