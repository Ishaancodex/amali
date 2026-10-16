/**
 * Guest fee for an RSVP party (PRD §8.2 attendee categories). Pure.
 */
import type { AttendeeCategory } from '@/types/event';

export interface AttendeeInput {
  category: AttendeeCategory;
}

export function partyFeeFils(
  attendees: readonly AttendeeInput[],
  pricing: Record<AttendeeCategory, number>,
): number {
  return attendees.reduce((sum, a) => sum + (pricing[a.category] ?? 0), 0);
}
