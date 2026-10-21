/** Page-coloured sheet that slides up over a `HeaderBand`'s lower edge. */
import { cn } from '@/lib/cn';

export function BodySheet({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-bg-page rounded-t-sheet relative z-10 -mt-6 flex flex-col gap-7 px-4 pt-6 pb-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
