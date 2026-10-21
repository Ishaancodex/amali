import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's default `text-*` sizes, so without this it reads the
 * design system's type tokens (`text-label-3`, `text-body-2`, …) as text *colours* and drops
 * whichever of a type token and a colour (`text-brand`) comes first in a `cn()` call.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'title-l',
            'label-1',
            'label-2',
            'label-3',
            'body-2',
            'body-3',
            'button',
            'tag',
            'script-accent',
            'serif-hero',
            'serif-title',
            'serif-section',
            'serif-numeral',
            'eyebrow',
            'shell-body',
            'shell-heading',
            'shell-label',
            'shell-number',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
