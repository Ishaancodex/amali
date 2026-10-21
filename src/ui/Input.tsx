import { cn } from '@/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className, ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="font-wide text-eyebrow text-text-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'rounded-tile border-border-card bg-surface text-body-2 text-text-body placeholder:text-text-placeholder h-12 border px-4',
          error && 'border-danger',
          className,
        )}
        aria-invalid={!!error}
        {...props}
      />
      {error && <span className="text-body-3 text-danger">{error}</span>}
    </div>
  );
}
