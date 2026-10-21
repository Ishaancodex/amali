'use client';

/**
 * Raise an incident (PRD §8.9): amenity, category, severity, description.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { useUiStore } from '@/store/uiStore';
import type { DeviceSlotId } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';
import type { Incident } from '@/types/ops';
import { useAmenityLabel, useErrorText, useT } from '@/i18n/hooks';

const AMENITIES: AmenityKey[] = ['padel', 'pool', 'gym', 'screening', 'music', 'creche', 'dining'];
const SEVERITIES: Incident['severity'][] = ['low', 'medium', 'high'];

export function RaiseIncidentScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const errorText = useErrorText();
  const amenityLabel = useAmenityLabel();
  const { pop, replace } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const staffMember = useStore((s) => s.staff[actorId]);
  const dispatch = useStore((s) => s.dispatch);

  const [amenity, setAmenity] = useState<AmenityKey>('pool');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState<Incident['severity']>('medium');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!staffMember) return null;

  function handleSubmit() {
    const result = dispatch(
      'incident.raise',
      {
        amenity,
        category: category.trim() || 'general',
        severity,
        description,
        raisedVia: 'guard',
      },
      { kind: 'staff', id: staffMember!.id, role: staffMember!.role },
    );
    if (result.ok) {
      setSubmitted(true);
    } else {
      pushToast(slot, errorText(result.error), 'error');
    }
  }

  if (submitted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-title-l text-text-title">{t('guard.incidentRaised')}</p>
        <Button onClick={() => replace('home')}>{t('common.done')}</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('guard.raiseIncident')} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <h2 className="text-label-1 text-text-title mt-4 mb-2">{t('guard.amenity')}</h2>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmenity(a)}
              className={`rounded-tag text-label-3 px-3 py-1.5 ${amenity === a ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
            >
              {amenityLabel(a, 'short')}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <Input
            label={t('guard.category')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t('guard.categoryHint')}
          />
        </div>

        <h2 className="text-label-1 text-text-title mt-5 mb-2">{t('guard.severity')}</h2>
        <div className="flex gap-2">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={`rounded-tag text-label-3 flex-1 px-3 py-1.5 text-center ${severity === s ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
            >
              {t(`kids.severity.${s}`)}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          <label htmlFor="incident-description" className="text-label-3 text-text-muted">
            {t('guard.description')}
          </label>
          <textarea
            id="incident-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="rounded-input border-border-card bg-surface text-body-2 text-text-body placeholder:text-text-placeholder border px-3 py-2.5"
            placeholder={t('guard.whatsWrong')}
          />
        </div>

        {!description.trim() && (
          <div className="mt-4">
            <Banner style="info">{t('guard.descriptionHint')}</Banner>
          </div>
        )}

        <Button fullWidth disabled={!description.trim()} onClick={handleSubmit} className="mt-6">
          {t('guard.raiseIncident')}
        </Button>
      </div>
    </div>
  );
}
