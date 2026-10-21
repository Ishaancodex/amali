import type { T } from '@/i18n/hooks';

/**
 * The activity line staff set for the room (PRD §8.3). The stored label stays
 * English — it is data the parent's device shows — and each device
 * translates the known ones for display.
 */
export const ACTIVITIES = {
  'Free play': 'freePlay',
  'Story time': 'storyTime',
  'Arts & crafts': 'arts',
  Snack: 'snack',
  'Outdoor play': 'outdoor',
  'Quiet time': 'quiet',
} as const;

export function activityLabel(label: string, t: T): string {
  const key = ACTIVITIES[label as keyof typeof ACTIVITIES];
  return key ? t(`creche.activity.${key}`) : label;
}
