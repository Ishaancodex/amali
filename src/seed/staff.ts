/**
 * Named staff (PRD §3.2). Fixed ids so scenario fixtures and the staff
 * persona picker can reference them directly.
 */
import type { Staff } from '@/types/community';
import { STAFF_IDS } from './personaIds';

function staff(now: string, id: string, overrides: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>): Staff {
  return { id, createdAt: now, updatedAt: now, ...overrides };
}

export function buildStaff(now: string): Record<string, Staff> {
  const list: Staff[] = [
    staff(now, STAFF_IDS.guardImran, {
      name: 'Imran',
      avatar: 'IM',
      role: 'guard',
      post: 'Main Lobby',
    }),
    staff(now, STAFF_IDS.guardJoseph, {
      name: 'Joseph',
      avatar: 'JO',
      role: 'guard',
      post: 'Amenity Deck, Level 6',
    }),
    staff(now, STAFF_IDS.crecheMaria, {
      name: 'Maria',
      avatar: 'MA',
      role: 'creche_lead',
      assignedAmenities: ['creche'],
    }),
    staff(now, STAFF_IDS.crecheGrace, {
      name: 'Grace',
      avatar: 'GR',
      role: 'creche_carer',
      assignedAmenities: ['creche'],
    }),
    staff(now, STAFF_IDS.crecheAisha, {
      name: 'Aisha',
      avatar: 'AI',
      role: 'creche_carer',
      assignedAmenities: ['creche'],
    }),
    staff(now, STAFF_IDS.fnbMarco, {
      name: 'Marco',
      avatar: 'MC',
      role: 'fnb_manager',
      post: 'Restaurant Manager',
      assignedAmenities: ['dining'],
    }),
    staff(now, STAFF_IDS.fnbKen, {
      name: 'Ken',
      avatar: 'KE',
      role: 'chef',
      post: 'Teppanyaki Chef',
      assignedAmenities: ['dining'],
    }),
    staff(now, STAFF_IDS.fnbElena, {
      name: 'Elena',
      avatar: 'EL',
      role: 'host',
      assignedAmenities: ['dining'],
    }),
    staff(now, STAFF_IDS.cmHana, {
      name: 'Hana',
      avatar: 'HA',
      role: 'community_manager',
    }),
    staff(now, STAFF_IDS.supervisorVictor, {
      name: 'Victor',
      avatar: 'VI',
      role: 'amenity_supervisor',
      post: 'Amenity Supervisor — Pool, Gym and Padel',
      assignedAmenities: ['pool', 'gym', 'padel'],
    }),
    staff(now, STAFF_IDS.agentDina, {
      name: 'Dina',
      avatar: 'DI',
      role: 'call_centre',
    }),
    staff(now, STAFF_IDS.lifeguardSam, {
      name: 'Sam',
      avatar: 'SA',
      role: 'lifeguard',
      assignedAmenities: ['pool'],
    }),
    staff(now, STAFF_IDS.lifeguardRahul, {
      name: 'Rahul',
      avatar: 'RA',
      role: 'lifeguard',
      assignedAmenities: ['pool'],
    }),
    staff(now, STAFF_IDS.gymLeo, {
      name: 'Leo',
      avatar: 'LE',
      role: 'gym_attendant',
      assignedAmenities: ['gym'],
    }),
    staff(now, STAFF_IDS.technicianRavi, {
      name: 'Ravi',
      avatar: 'RV',
      role: 'technician',
    }),
    staff(now, STAFF_IDS.housekeepingJoy, {
      name: 'Joy',
      avatar: 'JY',
      role: 'housekeeping',
    }),
    staff(now, STAFF_IDS.housekeepingMark, {
      name: 'Mark',
      avatar: 'MK',
      role: 'housekeeping',
    }),
  ];

  return Object.fromEntries(list.map((s) => [s.id, s]));
}
