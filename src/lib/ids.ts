/**
 * Prefixed, readable IDs (TRD §2.1): `bk_xxxxxxxxxxxx`, `wo_xxxxxxxxxxxx`.
 * Used for entities created by live commands. Seed data uses
 * `lib/random.ts#seededId` instead, so the same seed is byte-identical.
 */
import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const generate = customAlphabet(alphabet, 12);

export type IdPrefix =
  | 'unit'
  | 'res' // resident
  | 'staff'
  | 'vendor'
  | 'child'
  | 'guardian'
  | 'bk' // booking
  | 'hold'
  | 'wl' // waitlist entry
  | 'strike'
  | 'susp' // suspension
  | 'evt' // programme event
  | 'show' // showtime
  | 'rsvp'
  | 'att' // rsvp attendee
  | 'season'
  | 'prog' // programme series
  | 'crsess' // creche session
  | 'crbk' // creche booking
  | 'approval'
  | 'res_dine' // dining reservation
  | 'table'
  | 'ledger'
  | 'checklist'
  | 'clog' // cleaning log
  | 'water'
  | 'shift'
  | 'inc' // incident
  | 'wo' // work order
  | 'audit'
  | 'ann' // announcement
  | 'delivery'
  | 'wa' // whatsapp message
  | 'post' // channel post
  | 'notif'
  | 'job'
  | 'blackout'
  | 'exc' // hours exception
  | 'status'
  | 'snap'; // snapshot

export function id(prefix: IdPrefix): string {
  return `${prefix}_${generate()}`;
}
