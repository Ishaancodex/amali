/** Initials avatar for a child or guardian (photos are mocked as initials across the demo). */

const SIZE = {
  sm: 'text-label-3 h-7 w-7',
  md: 'text-label-3 h-9 w-9',
  lg: 'text-label-1 h-14 w-14',
} as const;

export function ChildAvatar({
  initials,
  size = 'md',
  className = '',
}: {
  initials: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  // Plain concatenation, not `cn`: tailwind-merge reads `text-label-3` (a type token) and
  // `text-brand` (a colour) as the same group and would drop the colour.
  return (
    <span
      className={`bg-brand-tint text-brand flex shrink-0 items-center justify-center rounded-full ${SIZE[size]} ${className}`}
    >
      {initials}
    </span>
  );
}
