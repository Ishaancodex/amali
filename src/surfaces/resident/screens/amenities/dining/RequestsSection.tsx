'use client';

/** Occasion and special requests (PRD §8.4 step 4): dietary chips, free text, high chair, accessibility. */
import { Input } from '@/ui/Input';
import { Chip } from './Chip';
import { useT } from '@/i18n/hooks';

export interface Requests {
  occasion?: string;
  dietary: string[];
  text?: string;
  highChair: boolean;
  accessibility?: string;
}

/** Stored values stay English (staff read them on the F&B tablet); labels are translated. */
const OCCASIONS = {
  Birthday: 'birthday',
  Anniversary: 'anniversary',
  Business: 'business',
} as const;
const DIETARY = {
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  'gluten-free': 'glutenFree',
  'nut allergy': 'nutAllergy',
  'halal-only kitchen': 'halal',
} as const;

export function RequestsSection({
  value,
  onChange,
}: {
  value: Requests;
  onChange: (v: Requests) => void;
}) {
  const t = useT();
  const toggleDiet = (d: string) =>
    onChange({
      ...value,
      dietary: value.dietary.includes(d)
        ? value.dietary.filter((x) => x !== d)
        : [...value.dietary, d],
    });
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-label-1 text-text-title">{t('dining.requests.title')}</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(OCCASIONS).map(([o, key]) => (
          <Chip
            key={o}
            active={value.occasion === o}
            onClick={() => onChange({ ...value, occasion: value.occasion === o ? undefined : o })}
          >
            {t(`dining.occasion.${key}`)}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(DIETARY).map(([d, key]) => (
          <Chip key={d} active={value.dietary.includes(d)} onClick={() => toggleDiet(d)}>
            {t(`dining.diet.${key}`)}
          </Chip>
        ))}
      </div>
      <Input
        placeholder={t('dining.requests.other')}
        value={value.text ?? ''}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
      />
      <Input
        placeholder={t('dining.requests.accessibility')}
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
        <span className="text-label-2 text-text-body">{t('dining.requests.highChair')}</span>
      </label>
    </section>
  );
}
