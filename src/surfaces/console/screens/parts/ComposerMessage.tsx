'use client';

/** The composer's message (PRD §8.7): type, title, body with the WhatsApp length check, and amenity tags. */
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { rules } from '@/config/rules';
import { useAmenityLabel, useT } from '@/i18n/hooks';
import type { AmenityKey } from '@/types/amenity';
import type { AnnouncementType } from '@/types/comms';

const TYPES: AnnouncementType[] = ['daily', 'event', 'closure', 'urgent', 'general'];
const AMENITIES: AmenityKey[] = ['padel', 'screening', 'music', 'creche', 'dining', 'pool', 'gym'];
export const chip = (on: boolean) =>
  `rounded-tag text-label-3 px-3 py-1.5 ${on ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`;

export interface Message {
  type: AnnouncementType;
  title: string;
  body: string;
  amenityTags: AmenityKey[];
}

export function ComposerMessage({
  value,
  onChange,
  waSelected,
  onFillDaily,
}: {
  value: Message;
  onChange: (next: Message) => void;
  waSelected: boolean;
  onFillDaily: () => void;
}) {
  const t = useT();
  const amenityLabel = useAmenityLabel();
  const set = (patch: Partial<Message>) => onChange({ ...value, ...patch });
  const overLimit = waSelected && value.body.length > rules.comms.waCharacterLimit;
  const toggleTag = (key: AmenityKey) =>
    set({
      amenityTags: value.amenityTags.includes(key)
        ? value.amenityTags.filter((k) => k !== key)
        : [...value.amenityTags, key],
    });

  return (
    <>
      <section>
        <h2 className="text-label-1 text-text-title mb-2">{t('creche.type')}</h2>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={value.type === k}
              onClick={() => set({ type: k })}
              className={chip(value.type === k)}
            >
              {t(`console.comms.type.${k}`)}
            </button>
          ))}
          {value.type === 'daily' && (
            <Button variant="tertiary" onClick={onFillDaily}>
              {t('console.composer.fillLive')}
            </Button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Input
          label={t('console.incidents.title')}
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t('console.composer.titleHint')}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="composer-body" className="text-label-3 text-text-muted">
            {t('console.composer.body')}
          </label>
          <textarea
            id="composer-body"
            value={value.body}
            onChange={(e) => set({ body: e.target.value })}
            rows={5}
            className="rounded-input border-border-card bg-surface text-body-2 text-text-body placeholder:text-text-placeholder border px-3 py-2.5"
            placeholder={t('console.composer.bodyHint')}
          />
          <span className={`text-body-3 self-end ${overLimit ? 'text-danger' : 'text-text-muted'}`}>
            {t('console.composer.characters', { count: value.body.length })}
            {waSelected
              ? ` ${t('console.composer.waLimit', { limit: rules.comms.waCharacterLimit })}`
              : ''}
          </span>
        </div>
      </section>

      <section>
        <h2 className="text-label-1 text-text-title mb-2">{t('console.composer.tags')}</h2>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={value.amenityTags.includes(key)}
              onClick={() => toggleTag(key)}
              className={chip(value.amenityTags.includes(key))}
            >
              {amenityLabel(key)}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
