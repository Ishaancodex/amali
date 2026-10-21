import { cn } from '@/lib/cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-tile border-border-card bg-surface border-[0.5px] p-4', className)}
      {...props}
    />
  );
}
