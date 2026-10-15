import { Plus, Minus } from './icons';

export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  label?: string;
}

export function Stepper({ value, min = 0, max = 99, onChange, label }: StepperProps) {
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-body-2 text-text-body">{label}</span>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label="Decrease"
          className="border-border-card text-brand flex h-8 w-8 items-center justify-center rounded-full border disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <span className="text-label-2 text-text-body w-5 text-center tabular-nums">{value}</span>
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label="Increase"
          className="border-border-card text-brand flex h-8 w-8 items-center justify-center rounded-full border disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
