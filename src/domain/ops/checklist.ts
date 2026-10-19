/**
 * Checklist timing (PRD §8.5: "shows who completed it, when, and any time
 * it was late — due 05:45, done 06:10 shows amber"). Pure.
 */
import { dubaiDateTimeToIso } from '@/lib/time';

export function isChecklistLate(dateKey: string, dueTime: string, completedAt: string): boolean {
  return completedAt > dubaiDateTimeToIso(dateKey, dueTime);
}
