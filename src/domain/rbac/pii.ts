/**
 * Resident PII by role (PRD §8.11): a Community Manager sees everything; an
 * Amenity Supervisor sees name, unit and phone; a Call-centre Agent sees
 * name and unit with the phone masked (`+971 50 ••• ••67`) and a logged
 * "Reveal". Pure.
 */
import type { ConsoleRole } from '@/types/demo';
import { grantFor } from './can';

export type PiiLevel = 'full' | 'contact' | 'masked' | 'none';

export function piiLevel(role: ConsoleRole): PiiLevel {
  if (grantFor(role, 'resident_pii.view_full')) return 'full';
  if (grantFor(role, 'resident_pii.view_contact')) return 'contact';
  if (grantFor(role, 'resident_pii.view_masked')) return 'masked';
  return 'none';
}

/** `+971 50 123 4567` → `+971 50 ••• ••67`: keeps the country and network code and the last two digits. */
export function maskPhone(phone: string): string {
  const parts = phone.trim().split(/\s+/);
  const digits = phone.replace(/\D/g, '');
  if (parts.length < 3) return `••• ••${digits.slice(-2)}`;
  return `${parts[0]} ${parts[1]} ••• ••${digits.slice(-2)}`;
}

export interface ResidentView {
  name: string;
  unitId: string;
  /** Undefined when the role mayn't see it at all. */
  phone?: string;
  email?: string;
  /** True when the phone is masked and can be revealed (logged). */
  canReveal: boolean;
}

export function residentView(
  resident: { name: string; unitId: string; phone: string; email: string },
  role: ConsoleRole,
  revealed = false,
): ResidentView {
  const level = piiLevel(role);
  const base = { name: resident.name, unitId: resident.unitId, canReveal: false };
  if (level === 'full') return { ...base, phone: resident.phone, email: resident.email };
  if (level === 'contact') return { ...base, phone: resident.phone };
  if (level === 'masked') {
    return {
      ...base,
      phone: revealed ? resident.phone : maskPhone(resident.phone),
      canReveal: !revealed && !!grantFor(role, 'resident_pii.reveal'),
    };
  }
  return base;
}
