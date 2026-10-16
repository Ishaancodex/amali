/**
 * Active-banner selection for a resident's Home screen (PRD §8.7's
 * "targeted, with expiry" banners + M14). A newer banner that shares an
 * amenity tag set with an older one supersedes it — this is how the
 * "Reopened" banner replaces the "Closed" one without an explicit recall.
 */
import type { Announcement } from '@/types/comms';

export function selectActiveBannersForResident(
  announcements: Record<string, Announcement>,
  residentId: string,
  now: string,
): Announcement[] {
  const candidates = Object.values(announcements).filter(
    (a) =>
      a.state === 'sent' &&
      a.banner &&
      a.banner.expiresAt > now &&
      (a.resolvedRecipientIds ?? []).includes(residentId),
  );

  const latestByTagSet = new Map<string, Announcement>();
  for (const a of candidates) {
    const key = [...a.amenityTags].sort().join(',');
    const existing = latestByTagSet.get(key);
    // >= (not >): two sends can share the same `sentAt` when the demo clock hasn't moved between
    // them (e.g. emergency-close immediately followed by reopen) — `Object.values` iterates
    // insertion order, so the later-created announcement should still win a same-timestamp tie.
    if (!existing || (a.sentAt ?? '') >= (existing.sentAt ?? '')) {
      latestByTagSet.set(key, a);
    }
  }

  return [...latestByTagSet.values()].sort((a, b) =>
    (b.sentAt ?? '').localeCompare(a.sentAt ?? ''),
  );
}
