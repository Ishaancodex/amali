/**
 * The 6 complete personas and their directly-related records (PRD §3.2).
 * Applied on top of `buildCommunity`'s generated placeholders — these are
 * the only residents/units/wallets that need to be "real" for the demo
 * scenarios (PRD §15) to make sense.
 */
import type { Resident, Unit } from '@/types/community';
import type { Child, Guardian } from '@/types/creche';
import type { Wallet } from '@/types/wallet';
import { aedToFils } from '@/lib/money';
import { PERSONA_IDS, RELATED_IDS, CHILD_IDS, UNIT_IDS } from './personaIds';

function resident(
  now: string,
  id: string,
  overrides: Omit<Resident, 'id' | 'createdAt' | 'updatedAt' | 'avatar'> & { avatar?: string },
): Resident {
  const [first = '', last = ''] = overrides.name.split(' ', 2);
  return {
    id,
    createdAt: now,
    updatedAt: now,
    avatar: overrides.avatar ?? `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase(),
    ...overrides,
  };
}

export interface PersonaBuild {
  residents: Record<string, Resident>;
  children: Record<string, Child>;
  guardians: Record<string, Guardian>;
  wallets: Record<string, Wallet>;
  /** Unit field overrides (rights holder, lease end) keyed by unit id — merge onto buildCommunity's units. */
  unitOverrides: Record<string, Partial<Unit>>;
}

export function buildPersonas(now: string): PersonaBuild {
  const residents: Record<string, Resident> = {};
  const children: Record<string, Child> = {};
  const guardians: Record<string, Guardian> = {};
  const wallets: Record<string, Wallet> = {};
  const unitOverrides: Record<string, Partial<Unit>> = {};

  // --- Layla Al Mansoori — East 1804, owner, drives most scenarios -------
  residents[PERSONA_IDS.layla] = resident(now, PERSONA_IDS.layla, {
    name: 'Layla Al Mansoori',
    unitId: UNIT_IDS.layla,
    type: 'owner',
    phone: '+971 50 123 4567',
    email: 'layla.almansoori@example.com',
    channels: { appPush: true, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    locale: 'en',
    walletRole: 'primary',
  });
  residents[RELATED_IDS.khalid] = resident(now, RELATED_IDS.khalid, {
    name: 'Khalid Al Mansoori',
    unitId: UNIT_IDS.layla,
    type: 'household',
    phone: '+971 50 123 4568',
    email: 'khalid.almansoori@example.com',
    channels: { appPush: true, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    locale: 'en',
    walletRole: 'spender',
  });
  unitOverrides[UNIT_IDS.layla] = { amenityRightsHolderId: PERSONA_IDS.layla };
  wallets[UNIT_IDS.layla] = { unitId: UNIT_IDS.layla, balanceFils: aedToFils(2450) };

  children[CHILD_IDS.omar] = {
    id: CHILD_IDS.omar,
    createdAt: now,
    updatedAt: now,
    unitId: UNIT_IDS.layla,
    name: 'Omar Al Mansoori',
    dob: '2022-03-10',
    photo: 'OM',
    photoConsent: true,
    guardianIds: ['guardian_layla', 'guardian_khalid'],
    emergencyContact: { name: 'Layla Al Mansoori', phone: '+971 50 123 4567' },
  };
  children[CHILD_IDS.noor] = {
    id: CHILD_IDS.noor,
    createdAt: now,
    updatedAt: now,
    unitId: UNIT_IDS.layla,
    name: 'Noor Al Mansoori',
    dob: '2024-06-18',
    photo: 'NM',
    photoConsent: true,
    guardianIds: ['guardian_layla', 'guardian_khalid'],
    emergencyContact: { name: 'Layla Al Mansoori', phone: '+971 50 123 4567' },
  };
  guardians.guardian_layla = {
    id: 'guardian_layla',
    createdAt: now,
    updatedAt: now,
    childIds: [CHILD_IDS.omar, CHILD_IDS.noor],
    name: 'Layla Al Mansoori',
    relation: 'Mother',
    phone: '+971 50 123 4567',
    photo: 'LA',
    idLast4: '1234',
    residentId: PERSONA_IDS.layla,
    approval: 'approved',
  };
  guardians.guardian_khalid = {
    id: 'guardian_khalid',
    createdAt: now,
    updatedAt: now,
    childIds: [CHILD_IDS.omar, CHILD_IDS.noor],
    name: 'Khalid Al Mansoori',
    relation: 'Father',
    phone: '+971 50 123 4568',
    photo: 'KA',
    idLast4: '5678',
    residentId: RELATED_IDS.khalid,
    approval: 'approved',
  };

  // --- James Whitfield — West 2203, tenant, padel regular -----------------
  residents[PERSONA_IDS.james] = resident(now, PERSONA_IDS.james, {
    name: 'James Whitfield',
    unitId: UNIT_IDS.james,
    type: 'tenant',
    phone: '+971 55 234 5678',
    email: 'james.whitfield@example.com',
    channels: { appPush: true, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    locale: 'en',
    walletRole: 'primary',
  });
  unitOverrides[UNIT_IDS.james] = { amenityRightsHolderId: PERSONA_IDS.james };

  // --- Ahmed Khalil — East 0712, owner, push off / WhatsApp on -----------
  residents[PERSONA_IDS.ahmed] = resident(now, PERSONA_IDS.ahmed, {
    name: 'Ahmed Khalil',
    unitId: UNIT_IDS.ahmed,
    type: 'owner',
    phone: '+971 50 345 6789',
    email: 'ahmed.khalil@example.com',
    channels: { appPush: false, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    locale: 'en',
    walletRole: 'primary',
  });
  unitOverrides[UNIT_IDS.ahmed] = { amenityRightsHolderId: PERSONA_IDS.ahmed };

  // --- Priya Raman — PV-05 (North), owner, opted out of WhatsApp ---------
  residents[PERSONA_IDS.priya] = resident(now, PERSONA_IDS.priya, {
    name: 'Priya Raman',
    unitId: UNIT_IDS.priya,
    type: 'owner',
    phone: '+971 50 456 7890',
    email: 'priya.raman@example.com',
    channels: { appPush: true, whatsapp: false, whatsappOptIn: false, appInstalled: true },
    locale: 'en',
    walletRole: 'primary',
  });
  unitOverrides[UNIT_IDS.priya] = { amenityRightsHolderId: PERSONA_IDS.priya };

  // --- Sofia Marin — West PH-02, tenant, frequent diner, low balance -----
  residents[PERSONA_IDS.sofia] = resident(now, PERSONA_IDS.sofia, {
    name: 'Sofia Marin',
    unitId: UNIT_IDS.sofia,
    type: 'tenant',
    phone: '+971 55 567 8901',
    email: 'sofia.marin@example.com',
    channels: { appPush: true, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    locale: 'en',
    walletRole: 'primary',
  });
  unitOverrides[UNIT_IDS.sofia] = { amenityRightsHolderId: PERSONA_IDS.sofia };
  wallets[UNIT_IDS.sofia] = { unitId: UNIT_IDS.sofia, balanceFils: aedToFils(120) };

  // --- Rashid Al Suwaidi — West 1107, owner, unit leased out --------------
  residents[PERSONA_IDS.rashid] = resident(now, PERSONA_IDS.rashid, {
    name: 'Rashid Al Suwaidi',
    unitId: UNIT_IDS.rashid,
    type: 'owner',
    phone: '+971 50 678 9012',
    email: 'rashid.alsuwaidi@example.com',
    channels: { appPush: true, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    locale: 'en',
    walletRole: 'none',
  });
  residents[RELATED_IDS.rashidTenant] = resident(now, RELATED_IDS.rashidTenant, {
    name: 'Karim Haddad',
    unitId: UNIT_IDS.rashid,
    type: 'tenant',
    phone: '+971 55 789 0123',
    email: 'karim.haddad@example.com',
    channels: { appPush: true, whatsapp: true, whatsappOptIn: true, appInstalled: true },
    locale: 'en',
    walletRole: 'primary',
  });
  // PRD §11: "Amenities show 'Access is with your tenant until 31 Mar 2027'".
  unitOverrides[UNIT_IDS.rashid] = {
    amenityRightsHolderId: RELATED_IDS.rashidTenant,
    leaseEnd: '2027-03-31T23:59:59.000Z',
  };

  return { residents, children, guardians, wallets, unitOverrides };
}
