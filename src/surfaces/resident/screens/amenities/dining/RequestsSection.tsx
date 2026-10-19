'use client';

/** Occasion and special requests (PRD §8.4 step 4): dietary chips, free text, high chair, accessibility. */
import { Input } from '@/ui/Input';
import { Chip } from './Chip';

export interface Requests {
  occasion?: string;
  dietary: string[];
  text?: string;
  highChair: boolean;
  accessibility?: string;
}

const OCCASIONS = ['Birthday', 'Anniversary', 'Business'];
const DIETARY = ['vegetarian', 'vegan', 'gluten-free', 'nut allergy', 'halal-only kitchen'];

export function RequestsSection({
  value,
  onChange,
}: {
  value: Requests;
  onChange: (v: Requests) => void;
}) {
  const toggleDiet = (d: string) =>
    onChange({
      ...value,
      dietary: value.dietary.includes(d)
        ? value.dietary.filter((x) => x !== d)
        : [...value.dietary, d],
    });
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label-1 text-text-title">Occasion &amp; requests</h2>
      <div className="flex flex-wrap gap-2">
        {OCCASIONS.map((o) => (
          <Chip
            key={o}
            active={value.occasion === o}
            onClick={() => onChange({ ...value, occasion: value.occasion === o ? undefined : o })}
          >
            {o}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {DIETARY.map((d) => (
          <Chip key={d} active={value.dietary.includes(d)} onClick={() => toggleDiet(d)}>
            {d}
          </Chip>
        ))}
      </div>
      <Input
        placeholder="Anything else? (e.g. a cake at dessert)"
        value={value.text ?? ''}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
      />
      <Input
        placeholder="Accessibility needs"
        value={value.accessibility ?? ''}
        onChange={(e) => onChange({ ...value, accessibility: e.target.value })}
      />
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="accent-brand h-5 w-5"
          checked={value.highChair}
          onChange={(e) => onChange({ ...value, highChair: e.target.checked })}
        />
        <span className="text-label-2 text-text-body">High chair</span>
      </label>
    </section>
  );
}
