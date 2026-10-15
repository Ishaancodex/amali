import { cn } from '@/lib/cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border-border-card bg-surface p-card border-[0.5px]', className)}
      {...props}
    />
  );
}
